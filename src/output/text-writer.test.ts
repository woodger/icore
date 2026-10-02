import assert from 'node:assert';
import { EventEmitter, once } from 'node:events';
import { Writable } from 'node:stream';
import { describe, test } from 'node:test';
import { createBackpressureTextWriter } from './text-writer';

function createEventedBackpressureSink() {
  const events = new EventEmitter();

  return {
    write() {
      return false;
    },
    once: events.once.bind(events),
    off: events.off.bind(events),
    emit: events.emit.bind(events),
    listenerCount: events.listenerCount.bind(events)
  };
}

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

  test('removes lifecycle listeners after an evented sink drains', async () => {
    const sink = createEventedBackpressureSink();
    const writer = createBackpressureTextWriter(sink);
    const write = Promise.resolve(writer.write('hello'));

    sink.emit('drain');
    await write;

    assert.equal(sink.listenerCount('drain'), 0);
    assert.equal(sink.listenerCount('error'), 0);
    assert.equal(sink.listenerCount('close'), 0);
  });

  test('rejects when an evented sink errors before drain', async () => {
    const sink = createEventedBackpressureSink();
    const writer = createBackpressureTextWriter(sink);
    const error = new Error('write failed');
    const write = Promise.resolve(writer.write('hello'));

    sink.emit('error', error);

    await assert.rejects(write, (received) => {
      assert.strictEqual(received, error);

      return true;
    });
    assert.equal(sink.listenerCount('drain'), 0);
    assert.equal(sink.listenerCount('error'), 0);
    assert.equal(sink.listenerCount('close'), 0);
  });

  test('rejects when an evented sink closes before drain', async () => {
    const sink = createEventedBackpressureSink();
    const writer = createBackpressureTextWriter(sink);
    const write = Promise.resolve(writer.write('hello'));

    sink.emit('close');

    await assert.rejects(write, /Writable sink closed before drain/);
    assert.equal(sink.listenerCount('drain'), 0);
    assert.equal(sink.listenerCount('error'), 0);
    assert.equal(sink.listenerCount('close'), 0);
  });

  test('rejects writes after a Node stream has closed', async () => {
    const sink = new Writable({
      write(chunk, encoding, callback) {
        void chunk;
        void encoding;
        callback();
      }
    });
    const closed = once(sink, 'close');

    sink.destroy();
    await closed;

    const writer = createBackpressureTextWriter(sink);

    await assert.rejects(
      Promise.resolve(writer.write('after close')),
      /Writable sink closed before write/
    );
  });

  test('rejects writes after a Node stream has ended without closing', async () => {
    const sink = new Writable({
      autoDestroy: false,
      write(chunk, encoding, callback) {
        void chunk;
        void encoding;
        callback();
      }
    });
    const finished = once(sink, 'finish');

    sink.end();
    await finished;

    const writer = createBackpressureTextWriter(sink);

    await assert.rejects(
      Promise.resolve(writer.write('after end')),
      /Writable sink closed before write/
    );
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
