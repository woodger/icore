import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  createTerminalOutput,
  createTerminalProgress,
  formatTerminalCount,
  formatTerminalDuration,
  renderTerminalProgress,
  type TerminalLineOutput,
  type TerminalProgressSnapshot,
  type TerminalProgressState
} from '../index';

function createProgress(
  overrides: Partial<TerminalProgressState> = {}
): TerminalProgressState {
  return {
    label: '[1/1] FIGI1',
    current: 0,
    total: 100,
    details: ['saved 0', 'retries 0'],
    elapsedMs: 0,
    ...overrides
  };
}

function createLineOutput(
  operations: string[],
  options: {
    isInteractive?: boolean;
    columns?: number;
    flush?: () => Promise<void>;
  } = {}
): TerminalLineOutput {
  return {
    isInteractive: options.isInteractive ?? true,
    columns: options.columns,
    writeLine(line) {
      operations.push(`line:${line}`);
    },
    replaceLine(line) {
      operations.push(`replace:${line}`);
    },
    finishLine() {
      operations.push('finish');
    },
    flush: options.flush ?? (() => Promise.resolve())
  };
}

describe('createTerminalProgress', () => {
  test('redraws throttled progress and restores it after a line', async () => {
    const operations: string[] = [];
    let time = 0;
    const progress = createTerminalProgress({
      output: createLineOutput(operations, { columns: 160 }),
      refreshIntervalMs: 250,
      now: () => time
    });

    progress.start(createProgress());
    time = 249;
    progress.update(createProgress({
      current: 49,
      details: ['saved 100', 'retries 0'],
      elapsedMs: 249
    }));
    time = 250;
    progress.update(createProgress({
      current: 50,
      details: ['saved 123', 'retries 0'],
      elapsedMs: 10_000
    }));
    progress.writeLine('Retrying FIGI1');
    progress.complete(createProgress({
      current: 3_050,
      total: 3_050,
      details: ['saved 1,135,932', 'retries 0'],
      elapsedMs: 613_000
    }));
    await progress.close();

    assert.deepStrictEqual(operations, [
      'replace:[1/1] FIGI1 0.0% 0/100 saved 0 retries 0 elapsed 0s',
      'replace:[1/1] FIGI1 50.0% 50/100 saved 123 retries 0 elapsed 10s eta 10s',
      'finish',
      'line:Retrying FIGI1',
      'replace:[1/1] FIGI1 50.0% 50/100 saved 123 retries 0 elapsed 10s eta 10s',
      'replace:[1/1] FIGI1 100.0% 3,050/3,050 saved 1,135,932 retries 0 elapsed 10m 13s',
      'finish'
    ]);
  });

  test('passes fresh derived snapshots to a custom renderer', async () => {
    const operations: string[] = [];
    const received: TerminalProgressSnapshot[] = [];
    const details = ['saved 1'];
    const progress = createTerminalProgress({
      output: createLineOutput(operations),
      render(snapshot) {
        received.push(snapshot);

        return snapshot.label;
      },
      refreshIntervalMs: 0,
      now: () => 0
    });

    progress.start(createProgress({
      current: 1,
      total: 4,
      details,
      elapsedMs: 1_000
    }));
    details.push('mutated');
    progress.writeLine('message');
    progress.complete(createProgress({
      current: 1,
      total: 4,
      details: [],
      elapsedMs: 1_000
    }));
    await progress.close();

    assert.equal(received.length, 3);
    assert.notStrictEqual(received[0], received[1]);
    assert.notStrictEqual(received[0]?.details, received[1]?.details);
    assert.deepStrictEqual(received[0], {
      label: '[1/1] FIGI1',
      current: 1,
      total: 4,
      details: ['saved 1'],
      elapsedMs: 1_000,
      percentage: 25,
      etaMs: 3_000
    });
    assert.deepStrictEqual(received[1], received[0]);
    assert.deepStrictEqual(received[2], {
      label: '[1/1] FIGI1',
      current: 1,
      total: 4,
      details: [],
      elapsedMs: 1_000,
      percentage: 25
    });
  });

  test('uses zero percentage for an empty total', async () => {
    const snapshots: TerminalProgressSnapshot[] = [];
    const progress = createTerminalProgress({
      output: createLineOutput([]),
      render(snapshot) {
        snapshots.push(snapshot);

        return 'empty';
      }
    });

    progress.complete(createProgress({
      current: 0,
      total: 0,
      details: [],
      elapsedMs: 10_000
    }));
    await progress.close();

    assert.equal(snapshots[0]?.percentage, 0);
    assert.equal(snapshots[0]?.etaMs, undefined);
  });

  test('truncates plain renderer output after rendering', async () => {
    const operations: string[] = [];
    let rendered = '';
    const progress = createTerminalProgress({
      output: createLineOutput(operations, { columns: 10 }),
      render(snapshot) {
        rendered = `${snapshot.label}-full-renderer-output`;

        return rendered;
      }
    });

    progress.start(createProgress({ label: 'progress' }));
    await progress.close();

    assert.equal(rendered, 'progress-full-renderer-output');
    assert.deepStrictEqual(operations, [
      'replace:progress-',
      'finish'
    ]);
  });

  test('writes only explicit lines in non-interactive output', async () => {
    const operations: string[] = [];
    const progress = createTerminalProgress({
      output: createLineOutput(operations, {
        isInteractive: false
      })
    });

    progress.start(createProgress());
    progress.update(createProgress({ current: 50 }));
    progress.writeLine('Progress message');
    progress.complete(createProgress({ current: 100 }));
    await progress.close();

    assert.deepStrictEqual(operations, ['line:Progress message']);
  });

  test('throws renderer errors synchronously without poisoning output', async () => {
    const operations: string[] = [];
    const failure = new Error('renderer failed');
    const progress = createTerminalProgress({
      output: createLineOutput(operations),
      render() {
        throw failure;
      }
    });

    assert.throws(() => {
      progress.start(createProgress());
    }, (error) => {
      assert.strictEqual(error, failure);

      return true;
    });

    progress.writeLine('still writable');
    await progress.close();

    assert.deepStrictEqual(operations, ['line:still writable']);
  });

  test('validates progress values synchronously', async () => {
    const progress = createTerminalProgress({
      output: createLineOutput([])
    });

    assert.throws(
      () => progress.start(createProgress({ current: -1 })),
      /Expected current to be a finite non-negative number/
    );
    assert.throws(
      () => progress.update(createProgress({ total: Number.NaN })),
      /Expected total to be a finite non-negative number/
    );
    assert.throws(
      () => progress.complete(createProgress({
        elapsedMs: Number.POSITIVE_INFINITY
      })),
      /Expected elapsedMs to be a finite non-negative number/
    );

    await progress.close();

    assert.doesNotThrow(() => {
      progress.start(createProgress({ current: -1 }));
    });
  });

  test('closes once, finishes the active line, and ignores later operations', async () => {
    const operations: string[] = [];
    let resolveFlush: (() => void) | undefined;
    let flushCalls = 0;
    const flush = new Promise<void>((resolve) => {
      resolveFlush = resolve;
    });
    const progress = createTerminalProgress({
      output: createLineOutput(operations, {
        flush() {
          flushCalls += 1;

          return flush;
        }
      })
    });

    progress.start(createProgress());

    const firstClose = progress.close();
    const secondClose = progress.close();

    progress.update(createProgress({ current: -1 }));
    progress.writeLine('ignored');
    progress.complete(createProgress());

    assert.strictEqual(firstClose, secondClose);
    assert.equal(flushCalls, 1);
    assert.deepStrictEqual(operations, [
      'replace:[1/1] FIGI1 0.0% 0/100 saved 0 retries 0 elapsed 0s',
      'finish'
    ]);

    resolveFlush?.();
    await firstClose;
  });

  test('close rejects with the sticky stdout failure', async () => {
    const failure = new Error('stdout failed');
    const chunks: string[] = [];
    const terminal = createTerminalOutput({
      stdout: {
        isTTY: true,
        write(chunk) {
          chunks.push(chunk);

          return Promise.reject(failure);
        }
      }
    });
    const progress = createTerminalProgress({
      output: terminal.lines
    });

    progress.start(createProgress());

    const firstClose = progress.close();
    const secondClose = progress.close();

    assert.strictEqual(firstClose, secondClose);
    await assert.rejects(firstClose, (error) => {
      assert.strictEqual(error, failure);

      return true;
    });
    assert.deepStrictEqual(chunks, [
      '\u001B[1G\u001B[2K[1/1] FIGI1 0.0% 0/100 saved 0 retries 0 elapsed 0s'
    ]);
  });

  test('memoizes synchronous line failures as a close rejection', async () => {
    const failure = new Error('finish failed');
    const output = createLineOutput([]);

    output.finishLine = () => {
      throw failure;
    };

    const progress = createTerminalProgress({ output });

    progress.start(createProgress());

    const firstClose = progress.close();
    const secondClose = progress.close();

    assert.strictEqual(firstClose, secondClose);
    await assert.rejects(firstClose, (error) => {
      assert.strictEqual(error, failure);

      return true;
    });
  });
});

describe('terminal progress formatting', () => {
  test('formats counts and compact durations deterministically', () => {
    assert.equal(formatTerminalCount(1_250_000), '1,250,000');
    assert.equal(formatTerminalDuration(0), '0s');
    assert.equal(formatTerminalDuration(61_000), '1m 1s');
    assert.equal(formatTerminalDuration(3_660_000), '1h 1m');
    assert.equal(formatTerminalDuration(90_000_000), '1d 1h');
  });

  test('renders the default English progress line', () => {
    assert.equal(renderTerminalProgress({
      label: 'Syncing',
      current: 25,
      total: 100,
      details: ['saved 20'],
      elapsedMs: 5_000,
      percentage: 25,
      etaMs: 15_000
    }), 'Syncing 25.0% 25/100 saved 20 elapsed 5s eta 15s');
  });
});
