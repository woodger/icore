/**
 * The output facade exposes semantic stdout and stderr write operations.
 *
 * Allowed here:
 * - creating stdout/stderr writer channels;
 * - delegating `write` to stdout and `error` to stderr;
 *
 * This file must not contain command semantics, rendering rules, or
 * application-specific diagnostics.
 */

import {
  createStderrWriter,
  createStdoutWriter
} from './node-writer';
import type {
  BackpressureTextSink,
  TextWriter
} from './text-writer';

export type Output = {
  /** Writes regular output. */
  write(chunk: string): unknown | Promise<unknown>;
  /** Writes diagnostic output. */
  error(chunk: string): unknown | Promise<unknown>;
  stdout: TextWriter;
  stderr: TextWriter;
};

export type OutputOptions = {
  stdout?: BackpressureTextSink;
  stderr?: BackpressureTextSink;
};

/**
 * Creates semantic output methods while keeping raw stdout/stderr channels
 * available for lower-level integrations.
 */
export function createOutput(options: OutputOptions = {}): Output {
  const stdout = createStdoutWriter(options.stdout);
  const stderr = createStderrWriter(options.stderr);

  return {
    write(chunk) {
      return stdout.write(chunk);
    },
    error(chunk) {
      return stderr.write(chunk);
    },
    stdout,
    stderr
  };
}
