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
