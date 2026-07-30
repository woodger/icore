/**
 * The text writer module adapts writable text sinks to backpressure-aware
 * writer contracts.
 *
 * Allowed here:
 * - the minimal text writer contract;
 * - promise-returning sink support;
 * - Node-style backpressure and writable lifecycle handling;
 *
 * This file must not contain stdout/stderr selection or command semantics.
 */

export type TextWriter = {
  write(chunk: string): unknown | Promise<unknown>;
};

/**
 * Minimal writable stream shape accepted by icore output adapters.
 */
export type BackpressureTextSink = {
  write(chunk: string): unknown;
  /** Optional `drain` event hook. */
  once?(event: 'drain', listener: () => void): unknown;
};

type TextSinkLifecycleEvent = 'drain' | 'error' | 'close';
type TextSinkLifecycleListener = (() => void) | ((error: unknown) => void);

type EventedBackpressureTextSink = BackpressureTextSink & {
  once(
    event: TextSinkLifecycleEvent,
    listener: TextSinkLifecycleListener
  ): unknown;
  off(
    event: TextSinkLifecycleEvent,
    listener: TextSinkLifecycleListener
  ): unknown;
};

/**
 * Creates a text writer that preserves writable-stream backpressure.
 *
 * Promise-returning sinks are awaited. Node-style sinks returning `false` are
 * resumed after their next `drain` event when they expose a drain hook; without
 * that hook, `false` is treated as synchronous completion. EventEmitter-
 * compatible sinks reject when they emit `error` or `close` before draining.
 */
export function createBackpressureTextWriter(
  sink: BackpressureTextSink
): TextWriter {
  return {
    async write(chunk: string): Promise<void> {
      const writeResult = sink.write(chunk);

      if (isPromiseLike(writeResult)) {
        await writeResult;

        return;
      }

      if (writeResult !== false) {
        return;
      }

      if (typeof sink.once !== 'function') {
        return;
      }

      if (isEventedBackpressureTextSink(sink)) {
        await waitForEventedDrain(sink);

        return;
      }

      await waitForDrain(sink.once.bind(sink));
    }
  };
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && 'then' in value
    && typeof value.then === 'function'
  );
}

function waitForDrain(
  onceDrain: (event: 'drain', listener: () => void) => unknown
): Promise<void> {
  return new Promise((resolve) => {
    onceDrain('drain', resolve);
  });
}

function waitForEventedDrain(
  sink: EventedBackpressureTextSink
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    function cleanup(): void {
      sink.off('drain', handleDrain);
      sink.off('error', handleError);
      sink.off('close', handleClose);
    }

    function settle(action: () => void): void {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      action();
    }

    function handleDrain(): void {
      settle(resolve);
    }

    function handleError(error: unknown): void {
      settle(() => reject(error));
    }

    function handleClose(): void {
      settle(() => reject(new Error('Writable sink closed before drain')));
    }

    sink.once('error', handleError);
    sink.once('close', handleClose);
    sink.once('drain', handleDrain);
  });
}

function isEventedBackpressureTextSink(
  sink: BackpressureTextSink
): sink is EventedBackpressureTextSink {
  const candidate = sink as BackpressureTextSink & {
    off?: unknown;
  };

  return (
    typeof sink.once === 'function'
    && typeof candidate.off === 'function'
  );
}
