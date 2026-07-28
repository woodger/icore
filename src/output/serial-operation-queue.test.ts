import assert from 'node:assert';
import { describe, test } from 'node:test';
import { createSerialOperationQueue } from './serial-operation-queue';

type Deferred = {
  promise: Promise<void>;
  resolve(): void;
};

function createDeferred(): Deferred {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve() {
      resolvePromise?.();
    }
  };
}

describe('createSerialOperationQueue', () => {
  test('runs operations serially', async () => {
    const queue = createSerialOperationQueue();
    const firstOperation = createDeferred();
    const calls: string[] = [];
    const firstRun = queue.run(async () => {
      calls.push('first:start');
      await firstOperation.promise;
      calls.push('first:end');
    });
    const secondRun = queue.run(() => {
      calls.push('second');
    });

    await Promise.resolve();

    assert.deepStrictEqual(calls, ['first:start']);

    firstOperation.resolve();
    await Promise.all([firstRun, secondRun]);

    assert.deepStrictEqual(calls, [
      'first:start',
      'first:end',
      'second'
    ]);
  });

  test('flush waits only for operations queued before its call', async () => {
    const queue = createSerialOperationQueue();
    const beforeBarrier = createDeferred();
    const afterBarrier = createDeferred();
    let laterOperationCompleted = false;

    queue.enqueue(() => beforeBarrier.promise);
    const barrier = queue.flush();
    queue.enqueue(async () => {
      await afterBarrier.promise;
      laterOperationCompleted = true;
    });

    beforeBarrier.resolve();
    await barrier;

    assert.equal(laterOperationCompleted, false);

    afterBarrier.resolve();
    await queue.flush();

    assert.equal(laterOperationCompleted, true);
  });

  test('retains the first failure and skips later operations', async () => {
    const queue = createSerialOperationQueue();
    const failure = new Error('write failed');
    let laterCalls = 0;

    queue.enqueue(() => {
      throw failure;
    });
    queue.enqueue(() => {
      laterCalls += 1;
    });

    await assert.rejects(queue.flush(), (error) => {
      assert.strictEqual(error, failure);

      return true;
    });
    await assert.rejects(queue.run(() => {
      laterCalls += 1;
    }), (error) => {
      assert.strictEqual(error, failure);

      return true;
    });

    assert.equal(laterCalls, 0);
  });
});
