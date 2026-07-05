/**
 * The terminal app module composes command, presentation, and output mechanics.
 *
 * Allowed here:
 * - preparing and running command facades;
 * - rendering presentation results;
 * - writing command output through the output facade;
 *
 * This file must not contain argv tokenization, option validation internals,
 * domain behavior, or application-specific report mapping.
 */

import type {
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
 * Supported handler result shapes for the terminal app boundary.
 *
 * Domain commands may return ready text, streaming text, a presentation view,
 * or no output. Other result shapes are rejected before writing to stdout.
 */
export type TerminalCommandOutput =
  | string
  | AsyncIterable<string>
  | PresentationResult
  | undefined;

type BivariantCallback<TInput, TOutput> = {
  bivarianceHack(input: TInput): TOutput;
}['bivarianceHack'];

type TerminalCommandDefinition = {
  path: readonly [string, ...string[]];
  options: OptionsSchema;
  metadata?: unknown;
  allowExtraPositionals?: boolean;
  prepare?: BivariantCallback<
    PreparedCommandInput,
    unknown | Promise<unknown>
  >;
  handle: BivariantCallback<
    TerminalCommandInput,
    TerminalCommandOutput | Promise<TerminalCommandOutput>
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
 */
export function createTerminalApp<
  const TCommands extends readonly TerminalCommandDefinition[]
>(
  options: TerminalAppOptions<TCommands>
): TerminalApp<TCommands> {
  const presentation = options.presentation ?? createPresentation();
  const output = options.output ?? createOutput();
  const resolveFormat = options.resolveFormat ?? resolvePreparedFormat;

  async function runPrepared(
    prepared: PreparedCommand<TCommands[number]>,
    context: CommandContext<TCommands[number]>
  ): Promise<number> {
    try {
      const result = await options.commands.run(prepared, context);
      const format = resolveFormat(prepared);

      await writeTerminalOutput(result, format, presentation, output);

      return 0;
    }
    catch (error) {
      await output.error(renderTerminalError(error));

      return 1;
    }
  }

  return {
    commands: options.commands,
    presentation,
    output,
    prepare(args, commandOptions) {
      return options.commands.prepare(args, commandOptions);
    },
    runPrepared,
    async run(args, context, commandOptions) {
      try {
        const prepared = await options.commands.prepare(args, commandOptions);

        return runPrepared(prepared, context);
      }
      catch (error) {
        await output.error(renderTerminalError(error));

        return 1;
      }
    }
  };
}

/**
 * Writes only terminal-supported command output shapes.
 *
 * This keeps the terminal boundary explicit: application objects must be
 * mapped to text or presentation views before they reach stdout.
 */
async function writeTerminalOutput(
  result: TerminalCommandOutput,
  format: PresentationFormat | undefined,
  presentation: Presentation,
  output: Output
): Promise<void> {
  if (result === undefined) {
    return;
  }

  if (typeof result === 'string') {
    await output.write(result);

    return;
  }

  if (isAsyncIterable(result)) {
    for await (const chunk of result) {
      await output.write(chunk);
    }

    return;
  }

  if (isPresentationResult(result)) {
    await output.write(presentation.render(result, format));

    return;
  }

  throw new Error('Expected terminal command output');
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

function isAsyncIterable(value: unknown): value is AsyncIterable<string> {
  return (
    typeof value === 'object'
    && value !== null
    && Symbol.asyncIterator in value
  );
}
