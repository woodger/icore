import assert from 'node:assert';
import { describe, test } from 'node:test';
import { createBackpressureTextWriter } from '../cli';

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

  test('waits for promise-returning sinks', async () => {
    let finishWrite: (() => void) | undefined;
    let completed = false;
    const writer = createBackpressureTextWriter({
      write() {
        return new Promise<void>((resolve) => {
          finishWrite = resolve;
        });
      }
    });

    const write = Promise.resolve(writer.write('hello')).then(() => {
      completed = true;
    });

    await Promise.resolve();

    assert.equal(completed, false);

    if (finishWrite === undefined) {
      throw new Error('Expected write to start');
    }

    finishWrite();
    await write;
    assert.equal(completed, true);
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
