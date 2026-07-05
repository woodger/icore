/**
 * The text writer module adapts writable text sinks to backpressure-aware
 * writer contracts.
 *
 * Allowed here:
 * - the minimal text writer contract;
 * - promise-returning sink support;
 * - Node-style `drain` waiting when a writable sink reports backpressure;
 *
 * This file must not contain stdout/stderr selection or command semantics.
 */

export type TextWriter = {
  write(chunk: string): unknown | Promise<unknown>;
};

export type BackpressureTextSink = {
  write(chunk: string): unknown;
  once?(event: 'drain', listener: () => void): unknown;
};

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
