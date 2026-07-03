import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  createBackpressureTextWriter,
  createOutput,
  createStderrWriter,
  createStdoutWriter
} from './cli';

describe('createOutput', () => {
  test('creates stdout and stderr writer channels', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const output = createOutput({
      stdout: {
        write(chunk) {
          stdout.push(chunk);

          return true;
        }
      },
      stderr: {
        write(chunk) {
          stderr.push(chunk);

          return true;
        }
      }
    });

    await output.stdout.write('ok\n');
    await output.stderr.write('warning\n');

    assert.deepStrictEqual(stdout, ['ok\n']);
    assert.deepStrictEqual(stderr, ['warning\n']);
  });
});

describe('output writers', () => {
  describe('createBackpressureTextWriter', () => {
    test('writes chunks to the sink', async () => {
      const chunks: string[] = [];
      const writer = createBackpressureTextWriter({
        write(chunk) {
          chunks.push(chunk);

          return true;
        }
      });

      await writer.write('hello');

      assert.deepStrictEqual(chunks, ['hello']);
    });

    test('waits for drain when the sink reports backpressure', async () => {
      let drained = false;
      let drainListener: (() => void) | undefined;
      const writer = createBackpressureTextWriter({
        write() {
          return false;
        },
        once(event, listener) {
          assert.equal(event, 'drain');
          drainListener = listener;
        }
      });

      const write = Promise.resolve(writer.write('hello')).then(() => {
        drained = true;
      });

      await new Promise<void>((resolve) => {
        queueMicrotask(resolve);
      });

      assert.equal(drained, false);
      drainListener?.();
      await write;
      assert.equal(drained, true);
    });

    test('does not require drain support for simple sinks', async () => {
      const writer = createBackpressureTextWriter({
        write() {
          return false;
        }
      });

      await writer.write('hello');
    });
  });

  describe('createStdoutWriter', () => {
    test('adapts stdout-compatible sinks', async () => {
      const chunks: string[] = [];
      const writer = createStdoutWriter({
        write(chunk) {
          chunks.push(chunk);

          return true;
        }
      });

      await writer.write('stdout');

      assert.deepStrictEqual(chunks, ['stdout']);
    });
  });

  describe('createStderrWriter', () => {
    test('adapts stderr-compatible sinks', async () => {
      const chunks: string[] = [];
      const writer = createStderrWriter({
        write(chunk) {
          chunks.push(chunk);

          return true;
        }
      });

      await writer.write('stderr');

      assert.deepStrictEqual(chunks, ['stderr']);
    });
  });
});
