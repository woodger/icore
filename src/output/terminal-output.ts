/**
 * Legacy terminal output composes semantic output and interactive line
 * mechanics.
 *
 * Allowed here:
 * - creating one shared stdout queue for regular and interactive output;
 * - exposing terminal capabilities;
 * - serializing atomic terminal line operations;
 *
 * This file must not contain progress rendering or process lifecycle policy.
 * The module remains only as a `2.x` compatibility implementation; new
 * consumers should own interactive line output in their terminal boundary.
 */

import {
  createStderrWriter,
  createStdoutWriter
} from './node-writer';
import {
  createSerialOperationQueue,
  type SerialOperationQueue
} from './serial-operation-queue';
import type { Output } from './facade';
import type {
  BackpressureTextSink,
  TextWriter
} from './text-writer';

const moveCursorToLineStart = '\u001B[1G';
const clearTerminalLine = '\u001B[2K';

/**
 * Writable stdout shape used to discover interactive terminal capabilities.
 *
 * @deprecated Use an application-owned terminal sink.
 */
export type TerminalTextSink = BackpressureTextSink & {
  readonly isTTY?: boolean;
  readonly columns?: number;
};

/**
 * Interactive terminal capabilities exposed to line-oriented consumers.
 *
 * @deprecated Use an application-owned terminal capability contract.
 */
export type TerminalCapabilities = {
  readonly isInteractive: boolean;
  readonly columns: number | undefined;
};

/**
 * Ordered, line-oriented stdout operations.
 *
 * Line methods enqueue work synchronously. Write failures are retained and
 * reported by `flush()`.
 *
 * @deprecated Use an application-owned line output contract.
 */
export type TerminalLineOutput = TerminalCapabilities & {
  /** Writes one line and appends a newline. */
  writeLine(line: string): void;
  /** Replaces the active interactive line as one queued operation. */
  replaceLine(line: string): void;
  /** Finishes the active interactive line with a newline. */
  finishLine(): void;
  /** Waits for stdout operations enqueued before this call. */
  flush(): Promise<void>;
};

/**
 * @deprecated Use `createOutput()` together with application-owned terminal
 * output composition.
 */
export type TerminalOutput = {
  /** Semantic stdout/stderr output sharing the terminal queues. */
  output: Output;
  /** Interactive line operations sharing the semantic stdout queue. */
  lines: TerminalLineOutput;
};

/**
 * @deprecated Use `createOutput()` options and an application-owned terminal
 * sink.
 */
export type TerminalOutputOptions = {
  stdout?: TerminalTextSink;
  stderr?: BackpressureTextSink;
};

/**
 * Creates one output owner for a CLI invocation.
 *
 * Regular stdout writes and interactive line operations share one queue.
 * Stderr uses a separate queue so diagnostics are not blocked by stdout
 * backpressure.
 *
 * @deprecated Use `createOutput()` and keep interactive terminal output in
 * the consuming application. This compatibility export will be removed in
 * the next major.
 */
export function createTerminalOutput(
  options: TerminalOutputOptions = {}
): TerminalOutput {
  const stdoutSink = options.stdout ?? process.stdout;
  const stderrSink = options.stderr ?? process.stderr;
  const stdoutQueue = createSerialOperationQueue();
  const stderrQueue = createSerialOperationQueue();
  const stdoutWriter = createStdoutWriter(stdoutSink);
  const stderrWriter = createStderrWriter(stderrSink);
  const stdout = createQueuedTextWriter(
    stdoutWriter,
    stdoutQueue
  );
  const stderr = createQueuedTextWriter(
    stderrWriter,
    stderrQueue
  );
  const output = createOutputFacade(stdout, stderr);

  return {
    output,
    lines: {
      get isInteractive() {
        return stdoutSink.isTTY === true;
      },
      get columns() {
        return normalizeTerminalColumns(stdoutSink.columns);
      },
      writeLine(line) {
        stdoutQueue.enqueue(() => stdoutWriter.write(`${line}\n`));
      },
      replaceLine(line) {
        if (stdoutSink.isTTY !== true) {
          return;
        }

        stdoutQueue.enqueue(() => stdoutWriter.write(
          `${moveCursorToLineStart}${clearTerminalLine}${line}`
        ));
      },
      finishLine() {
        if (stdoutSink.isTTY !== true) {
          return;
        }

        stdoutQueue.enqueue(() => stdoutWriter.write('\n'));
      },
      flush() {
        return stdoutQueue.flush();
      }
    }
  };
}

function createQueuedTextWriter(
  writer: TextWriter,
  queue: SerialOperationQueue
): TextWriter {
  return {
    write(chunk) {
      return queue.run(() => writer.write(chunk));
    }
  };
}

function createOutputFacade(
  stdout: TextWriter,
  stderr: TextWriter
): Output {
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

function normalizeTerminalColumns(
  columns: number | undefined
): number | undefined {
  if (
    columns === undefined
    || !Number.isFinite(columns)
    || columns <= 0
  ) {
    return undefined;
  }

  return Math.floor(columns);
}
