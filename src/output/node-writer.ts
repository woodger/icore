/**
 * The Node writer module exposes stdout and stderr text writer factories.
 *
 * Allowed here:
 * - binding Node-compatible writable streams to text writers;
 *
 * This file must not contain rendering rules or command semantics.
 */

import {
  createBackpressureTextWriter,
  type BackpressureTextSink,
  type TextWriter
} from './text-writer';

/**
 * Creates a stdout writer from an already selected Node-compatible sink.
 */
export function createStdoutWriter(
  stdout: BackpressureTextSink = process.stdout
): TextWriter {
  return createBackpressureTextWriter(stdout);
}

/**
 * Creates a stderr writer from an already selected Node-compatible sink.
 */
export function createStderrWriter(
  stderr: BackpressureTextSink = process.stderr
): TextWriter {
  return createBackpressureTextWriter(stderr);
}
