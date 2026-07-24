import assert from 'node:assert';
import { describe, test } from 'node:test';
import { createTerminalOutput } from '../index';

type Deferred = {
  promise: Promise<void>;
  resolve(): void;
  reject(error: unknown): void;
};

function createDeferred(): Deferred {
  let resolvePromise: (() => void) | undefined;
  let rejectPromise: ((error: unknown) => void) | undefined;
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve() {
      resolvePromise?.();
    },
    reject(error) {
      rejectPromise?.(error);
    }
  };
}

function waitForTurn(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

describe('createTerminalOutput', () => {
  test('shares ordered stdout between semantic and line output', async () => {
    const chunks: string[] = [];
    const firstWrite = createDeferred();
    const terminal = createTerminalOutput({
      stdout: {
        isTTY: true,
        columns: 80,
        write(chunk) {
          chunks.push(chunk);

          return chunks.length === 1 ? firstWrite.promise : true;
        }
      },
      stderr: {
        write() {
          return true;
        }
      }
    });

    const regularWrite = Promise.resolve(terminal.output.write('help\n'));

    terminal.lines.replaceLine('progress');
    terminal.lines.finishLine();
    await waitForTurn();

    assert.deepStrictEqual(chunks, ['help\n']);
    assert.equal(terminal.lines.isInteractive, true);
    assert.equal(terminal.lines.columns, 80);

    firstWrite.resolve();
    await regularWrite;
    await terminal.lines.flush();

    assert.deepStrictEqual(chunks, [
      'help\n',
      '\u001B[1G\u001B[2Kprogress',
      '\n'
    ]);
  });

  test('enqueues replaceLine as one atomic sink write', async () => {
    const chunks: string[] = [];
    const terminal = createTerminalOutput({
      stdout: {
        isTTY: true,
        write(chunk) {
          chunks.push(chunk);

          return true;
        }
      }
    });

    terminal.lines.replaceLine('working');
    await terminal.lines.flush();

    assert.deepStrictEqual(chunks, [
      '\u001B[1G\u001B[2Kworking'
    ]);
  });

  test('leaves non-interactive line policy to the caller', async () => {
    const chunks: string[] = [];
    const stdout = {
      isTTY: false,
      columns: 40,
      write(chunk: string) {
        chunks.push(chunk);

        return true;
      }
    };
    const terminal = createTerminalOutput({ stdout });

    terminal.lines.replaceLine('working');
    terminal.lines.finishLine();
    terminal.lines.writeLine('plain progress');
    stdout.columns = 60;
    await terminal.lines.flush();

    assert.equal(terminal.lines.isInteractive, false);
    assert.equal(terminal.lines.columns, 60);
    assert.deepStrictEqual(chunks, ['plain progress\n']);
  });

  test('flush is a barrier for operations queued before its call', async () => {
    const chunks: string[] = [];
    const beforeWrite = createDeferred();
    const afterWrite = createDeferred();
    const terminal = createTerminalOutput({
      stdout: {
        write(chunk) {
          chunks.push(chunk);

          return chunks.length === 1
            ? beforeWrite.promise
            : afterWrite.promise;
        }
      }
    });

    terminal.lines.writeLine('before');
    const barrier = terminal.lines.flush();
    let barrierResolved = false;

    void barrier.then(() => {
      barrierResolved = true;
    });

    terminal.lines.writeLine('after');
    beforeWrite.resolve();
    await waitForTurn();

    assert.equal(barrierResolved, true);
    assert.deepStrictEqual(chunks, ['before\n', 'after\n']);

    const finalBarrier = terminal.lines.flush();
    const laterFailure = new Error('later write failed');

    afterWrite.reject(laterFailure);
    await assert.rejects(finalBarrier, (error) => {
      assert.strictEqual(error, laterFailure);

      return true;
    });
  });

  test('retains the first stdout failure and skips later writes', async () => {
    const chunks: string[] = [];
    const diagnostics: string[] = [];
    const failure = new Error('stdout failed');
    const terminal = createTerminalOutput({
      stdout: {
        write(chunk) {
          chunks.push(chunk);

          return Promise.reject(failure);
        }
      },
      stderr: {
        write(chunk) {
          diagnostics.push(chunk);

          return true;
        }
      }
    });

    terminal.lines.writeLine('first');
    terminal.lines.writeLine('second');

    await assert.rejects(terminal.lines.flush(), (error) => {
      assert.strictEqual(error, failure);

      return true;
    });
    assert.deepStrictEqual(chunks, ['first\n']);

    terminal.lines.writeLine('third');

    await assert.rejects(terminal.lines.flush(), (error) => {
      assert.strictEqual(error, failure);

      return true;
    });
    await assert.rejects(
      Promise.resolve(terminal.output.write('fourth\n')),
      (error) => {
        assert.strictEqual(error, failure);

        return true;
      }
    );
    await terminal.output.error('diagnostic\n');

    assert.deepStrictEqual(chunks, ['first\n']);
    assert.deepStrictEqual(diagnostics, ['diagnostic\n']);
  });

  test('keeps stderr independent from stdout backpressure', async () => {
    const stdoutWrite = createDeferred();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const terminal = createTerminalOutput({
      stdout: {
        write(chunk) {
          stdout.push(chunk);

          return stdoutWrite.promise;
        }
      },
      stderr: {
        write(chunk) {
          stderr.push(chunk);

          return true;
        }
      }
    });

    const pendingStdout = Promise.resolve(terminal.output.write('working'));

    await waitForTurn();
    await terminal.output.error('failed\n');

    assert.deepStrictEqual(stdout, ['working']);
    assert.deepStrictEqual(stderr, ['failed\n']);

    stdoutWrite.resolve();
    await pendingStdout;
  });
});
