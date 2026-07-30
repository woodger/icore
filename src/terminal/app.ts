/**
 * The terminal app module composes command, presentation, and output mechanics.
 *
 * Allowed here:
 * - preparing and running command facades;
 * - rendering presentation results;
 * - writing command output through the output facade;
 * - reporting terminal errors through caller-configured policy;
 *
 * This file must not contain argv tokenization, option validation internals,
 * domain behavior, or application-specific report mapping.
 */

import type {
  CommandPath,
  CommandContext,
  CommandResolutionOptions,
  Commands,
  PreparedCommand
} from '../command/mechanics';
import type { OptionsSchema } from '../options/schema';
import {
  createPresentation,
  type Presentation,
  type PresentationResult
} from '../presentation/facade';
import {
  isPresentationFormat,
  type PresentationFormat
} from '../presentation/format-options';
import { isPresentationResult } from '../presentation/result-renderer';
import {
  createOutput,
  type Output
} from '../output/facade';

/**
 * Supported terminal output shapes for the terminal app boundary.
 *
 * Terminal output may be ready text, streaming text, a presentation view, or
 * no output. Other result shapes are rejected before writing to stdout.
 */
export type TerminalCommandOutput =
  | string
  | AsyncIterable<string>
  | PresentationResult
  | undefined;

/** Checks whether an unknown value has a supported terminal output shape. */
export function isTerminalCommandOutput(
  value: unknown
): value is TerminalCommandOutput {
  return value === undefined
    || typeof value === 'string'
    || isAsyncIterable(value)
    || isPresentationResult(value);
}

/** Terminal operation in which an error was observed. */
export type TerminalErrorPhase =
  | 'prepare'
  | 'execute'
  | 'render'
  | 'write'
  | 'external';

/**
 * Context supplied to terminal error policy callbacks.
 *
 * Prepared command data is guaranteed for command execution and terminal
 * output phases. Errors outside terminal app operations may provide either
 * arguments, prepared command data, or neither.
 */
export type TerminalErrorContext<TPrepared> =
  | {
    phase: 'prepare';
    args: readonly string[];
  }
  | {
    phase: 'execute' | 'render' | 'write';
    prepared: TPrepared;
    args?: readonly string[];
  }
  | {
    phase: 'external';
    args?: readonly string[];
    prepared?: TPrepared;
  };

/** Caller-owned terminal error rendering and process exit-code policy. */
export type TerminalErrorPolicy<TPrepared> = {
  renderError?(
    error: unknown,
    context: TerminalErrorContext<TPrepared>
  ): string;
  resolveExitCode?(
    error: unknown,
    context: TerminalErrorContext<TPrepared>
  ): number;
};

// Method syntax keeps callbacks bivariant: terminal composition erases command
// shapes but must still accept handlers with their concrete inferred inputs.
type BivariantCallback<TInput, TOutput> = {
  bivarianceHack(input: TInput): TOutput;
}['bivarianceHack'];

type TerminalCommandDefinition = {
  path: CommandPath;
  aliases?: readonly CommandPath[];
  options: OptionsSchema;
  metadata?: unknown;
  allowExtraPositionals?: boolean;
  prepare?: BivariantCallback<
    PreparedCommandInput,
    unknown | Promise<unknown>
  >;
  handle: BivariantCallback<
    TerminalCommandInput,
    unknown | Promise<unknown>
  >;
};

type PreparedCommandInput = {
  options: Record<string, unknown>;
  provided: Record<string, boolean>;
  positionals: string[];
};

type TerminalCommandInput = PreparedCommandInput & {
  context: unknown;
  payload?: unknown;
};

export type TerminalAppOptions<
  TCommands extends readonly TerminalCommandDefinition[]
> = {
  commands: Commands<TCommands>;
  /** Custom presentation facade. */
  presentation?: Presentation;
  /** Custom output facade. */
  output?: Output;
  /** Custom terminal error rendering and exit-code policy. */
  errorPolicy?: TerminalErrorPolicy<PreparedCommand<TCommands[number]>>;
  /** Resolves output format. */
  resolveFormat?(
    prepared: PreparedCommand<TCommands[number]>
  ): PresentationFormat | undefined;
};

export type TerminalApp<
  TCommands extends readonly TerminalCommandDefinition[]
> = {
  commands: Commands<TCommands>;
  presentation: Presentation;
  output: Output;
  /** Renders an error to stderr and returns its process-style exit code. */
  reportError(
    error: unknown,
    context?: TerminalErrorContext<PreparedCommand<TCommands[number]>>
  ): Promise<number>;
  /** No application context required. */
  prepare(
    args: readonly string[],
    options?: CommandResolutionOptions
  ): Promise<PreparedCommand<TCommands[number]>>;
  /** Runs an already prepared command through terminal rendering and output. */
  runPrepared(
    prepared: PreparedCommand<TCommands[number]>,
    context: CommandContext<TCommands[number]>
  ): Promise<number>;
  /**
   * Renders and writes already obtained terminal output.
   *
   * String output is written exactly as provided; add a trailing newline in the
   * command result when line output is desired.
   */
  writePreparedOutput(
    prepared: PreparedCommand<TCommands[number]>,
    output: TerminalCommandOutput
  ): Promise<void>;
  /** Returns a process-style exit code. */
  run(
    args: readonly string[],
    context: CommandContext<TCommands[number]>,
    options?: CommandResolutionOptions
  ): Promise<number>;
};

/**
 * Composes command mechanics, presentation rendering, and output delivery into
 * a terminal application boundary.
 *
 * Command handlers keep ownership of application work; this facade only
 * prepares commands, renders supported terminal results, and writes output.
 *
 * An empty command registry is supported for bootstrap-only presentation,
 * output, and error reporting. It does not provide resolvable commands.
 */
export function createTerminalApp<
  const TCommands extends readonly TerminalCommandDefinition[]
>(
  options: TerminalAppOptions<TCommands>
): TerminalApp<TCommands> {
  type TPrepared = PreparedCommand<TCommands[number]>;

  const presentation = options.presentation ?? createPresentation();
  const output = options.output ?? createOutput();
  const resolveFormat = options.resolveFormat ?? resolvePreparedFormat;

  async function reportError(
    error: unknown,
    context: TerminalErrorContext<TPrepared> = {
      phase: 'external'
    }
  ): Promise<number> {
    const renderedError = options.errorPolicy?.renderError === undefined
      ? renderTerminalError(error)
      : options.errorPolicy.renderError(error, context);

    await output.error(renderedError);

    return options.errorPolicy?.resolveExitCode === undefined
      ? resolveTerminalExitCode()
      : options.errorPolicy.resolveExitCode(error, context);
  }

  async function writePreparedOutput(
    prepared: TPrepared,
    terminalOutput: TerminalCommandOutput
  ): Promise<void> {
    const renderedOutput = renderTerminalOutput(
      terminalOutput,
      resolveFormat(prepared),
      presentation
    );

    await writeTerminalOutput(renderedOutput, output);
  }

  async function runPrepared(
    prepared: TPrepared,
    context: CommandContext<TCommands[number]>
  ): Promise<number> {
    return runPreparedTerminalCommand(prepared, context);
  }

  async function runPreparedTerminalCommand(
    prepared: TPrepared,
    context: CommandContext<TCommands[number]>,
    sourceArgs?: readonly string[]
  ): Promise<number> {
    let result: unknown;

    try {
      result = await options.commands.run(prepared, context);
    }
    catch (error) {
      return reportError(error, createPreparedErrorContext(
        'execute',
        prepared,
        sourceArgs
      ));
    }

    let renderedOutput: RenderedTerminalOutput;

    try {
      renderedOutput = renderTerminalOutput(
        result,
        resolveFormat(prepared),
        presentation
      );
    }
    catch (error) {
      return reportError(error, createPreparedErrorContext(
        'render',
        prepared,
        sourceArgs
      ));
    }

    try {
      await writeTerminalOutput(renderedOutput, output);

      return 0;
    }
    catch (error) {
      return reportError(error, createPreparedErrorContext(
        'write',
        prepared,
        sourceArgs
      ));
    }
  }

  return {
    commands: options.commands,
    presentation,
    output,
    reportError,
    prepare(args, commandOptions) {
      return options.commands.prepare(args, commandOptions);
    },
    runPrepared,
    writePreparedOutput,
    async run(args, context, commandOptions) {
      let prepared: TPrepared;

      try {
        prepared = await options.commands.prepare(args, commandOptions);
      }
      catch (error) {
        return reportError(error, {
          phase: 'prepare',
          args
        });
      }

      return runPreparedTerminalCommand(prepared, context, args);
    }
  };
}

/**
 * Converts terminal-supported command output to text or a text stream.
 *
 * This keeps the terminal boundary explicit: application objects must be
 * mapped to text or presentation views before they reach stdout.
 */
type RenderedTerminalOutput =
  | string
  | AsyncIterable<string>
  | undefined;

function renderTerminalOutput(
  result: unknown,
  format: PresentationFormat | undefined,
  presentation: Presentation
): RenderedTerminalOutput {
  if (!isTerminalCommandOutput(result)) {
    throw new Error('Expected terminal command output');
  }

  if (
    result === undefined
    || typeof result === 'string'
    || isAsyncIterable(result)
  ) {
    return result;
  }

  return presentation.render(result, format);
}

/** Writes already rendered terminal text while preserving stream backpressure. */
async function writeTerminalOutput(
  result: RenderedTerminalOutput,
  output: Output
): Promise<void> {
  if (result === undefined) {
    return;
  }

  if (typeof result === 'string') {
    await output.write(result);

    return;
  }

  for await (const chunk of result) {
    await output.write(chunk);
  }
}

function createPreparedErrorContext<TPrepared>(
  phase: 'execute' | 'render' | 'write',
  prepared: TPrepared,
  args: readonly string[] | undefined
): TerminalErrorContext<TPrepared> {
  if (args === undefined) {
    return {
      phase,
      prepared
    };
  }

  return {
    phase,
    prepared,
    args
  };
}

/**
 * Keeps the default format convention local to terminal composition.
 */
function resolvePreparedFormat(
  prepared: PreparedCommand<TerminalCommandDefinition>
): PresentationFormat | undefined {
  const options = prepared.options as Record<string, unknown>;
  const format = options['format'];

  return isPresentationFormat(format) ? format : undefined;
}

/**
 * Converts thrown values to terminal error text without changing the error
 * contract exposed to command handlers.
 */
function renderTerminalError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}\n`;
  }

  return `${String(error)}\n`;
}

function resolveTerminalExitCode(): number {
  return 1;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<string> {
  if (
    (typeof value !== 'object' || value === null)
    && typeof value !== 'function'
  ) {
    return false;
  }

  return typeof (
    value as { [Symbol.asyncIterator]?: unknown }
  )[Symbol.asyncIterator] === 'function';
}
