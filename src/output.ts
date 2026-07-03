/**
 * The output module adapts writable text sinks to reusable CLI output writers.
 *
 * Allowed here:
 * - the minimal text writer contract;
 * - backpressure-aware writes for Node-style writable streams;
 * - stdout and stderr writer factories;
 *
 * This file must not contain command semantics, rendering rules, or
 * application-specific diagnostics.
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
      if (sink.write(chunk) !== false) {
        return;
      }

      if (typeof sink.once !== 'function') {
        return;
      }

      await waitForDrain(sink.once.bind(sink));
    }
  };
}

export function createStdoutWriter(
  stdout: BackpressureTextSink = process.stdout
): TextWriter {
  return createBackpressureTextWriter(stdout);
}

export function createStderrWriter(
  stderr: BackpressureTextSink = process.stderr
): TextWriter {
  return createBackpressureTextWriter(stderr);
}

function waitForDrain(
  onceDrain: (event: 'drain', listener: () => void) => unknown
): Promise<void> {
  return new Promise((resolve) => {
    onceDrain('drain', resolve);
  });
}
