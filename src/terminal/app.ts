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
  CommandDefinition,
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

export type TerminalCommandOutput =
  | string
  | AsyncIterable<string>
  | PresentationResult
  | undefined;

type TerminalCommandDefinition<TContext> = CommandDefinition<
  OptionsSchema,
  TContext,
  TerminalCommandOutput,
  readonly [string, ...string[]],
  unknown,
  unknown
>;

export type TerminalAppOptions<
  TContext,
  TCommands extends readonly TerminalCommandDefinition<TContext>[]
> = {
  commands: Commands<TCommands>;
  presentation?: Presentation;
  output?: Output;
  resolveFormat?(
    prepared: PreparedCommand<TCommands[number]>
  ): PresentationFormat | undefined;
};

export type TerminalApp<
  TContext,
  TCommands extends readonly TerminalCommandDefinition<TContext>[]
> = {
  commands: Commands<TCommands>;
  presentation: Presentation;
  output: Output;
  prepare(
    args: readonly string[],
    options?: CommandResolutionOptions
  ): Promise<PreparedCommand<TCommands[number]>>;
  run(
    args: readonly string[],
    context: TContext,
    options?: CommandResolutionOptions
  ): Promise<number>;
};

export function createTerminalApp<
  TContext,
  const TCommands extends readonly TerminalCommandDefinition<TContext>[]
>(
  options: TerminalAppOptions<TContext, TCommands>
): TerminalApp<TContext, TCommands> {
  const presentation = options.presentation ?? createPresentation();
  const output = options.output ?? createOutput();
  const resolveFormat = options.resolveFormat ?? resolvePreparedFormat;

  return {
    commands: options.commands,
    presentation,
    output,
    prepare(args, commandOptions) {
      return options.commands.prepare(args, commandOptions);
    },
    async run(args, context, commandOptions) {
      try {
        const prepared = await options.commands.prepare(args, commandOptions);
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
  };
}

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

function resolvePreparedFormat(
  prepared: PreparedCommand<TerminalCommandDefinition<unknown>>
): PresentationFormat | undefined {
  const options = prepared.options as Record<string, unknown>;
  const format = options['format'];

  return isPresentationFormat(format) ? format : undefined;
}

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
