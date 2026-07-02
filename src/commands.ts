/**
 * The command mechanics module resolves command paths and runs typed command
 * handlers after argv and option validation.
 *
 * Allowed here:
 * - defining command and registry contracts;
 * - resolving the most specific command path match;
 * - passing parsed options, provided metadata, positionals, and context to handlers;
 *
 * This file must not contain raw token parsing, option schema validation,
 * domain behavior, SDK calls, or output formatting.
 */

import { parseArgv } from './argv';
import { IcoreError } from './errors';
import {
  parseOptionsDetailed,
  type InferOptions,
  type InferProvidedOptions,
  type OptionsSchema,
  type RawOptionValue
} from './options';

/**
 * Input produced after command path and option validation, before runtime
 * context is attached.
 */
export type PreparedCommandInput<TSchema extends OptionsSchema> = {
  options: InferOptions<TSchema>;
  provided: InferProvidedOptions<TSchema>;
  positionals: string[];
};

/**
 * Input passed to a command handler after command path and option validation.
 */
export type CommandInput<
  TSchema extends OptionsSchema,
  TContext
> = PreparedCommandInput<TSchema> & {
  context: TContext;
};

/**
 * Declarative command contract.
 *
 * `icore` owns command mechanics. The handler remains responsible for
 * application-specific work such as API calls, request building, and output
 * formatting.
 */
export type CommandDefinition<
  TSchema extends OptionsSchema,
  TContext,
  TResult,
  TPath extends readonly [string, ...string[]] = readonly [string, ...string[]],
  TMetadata = unknown
> = {
  path: TPath;
  options: TSchema;
  metadata?: TMetadata;
  allowExtraPositionals?: boolean;
  prepare?(input: PreparedCommandInput<TSchema>): void | Promise<void>;
  handle(input: CommandInput<TSchema, TContext>): TResult | Promise<TResult>;
};

type AnyCommandDefinition = CommandDefinition<
  OptionsSchema,
  unknown,
  unknown,
  readonly [string, ...string[]],
  unknown
>;

type CommandPathName<TPath extends readonly string[]> =
  number extends TPath['length']
    ? string
    : TPath extends readonly [infer THead extends string]
      ? THead
      : TPath extends readonly [
        infer THead extends string,
        ...infer TRest extends readonly string[]
      ]
        ? `${THead} ${CommandPathName<TRest>}`
        : never;

type CommandContext<TCommand extends AnyCommandDefinition> =
  TCommand extends CommandDefinition<OptionsSchema, infer TContext, unknown>
    ? TContext
    : never;

type CommandResult<TCommand extends AnyCommandDefinition> =
  TCommand extends CommandDefinition<OptionsSchema, unknown, infer TResult>
    ? Awaited<TResult>
    : never;

type CommandSchema<TCommand extends AnyCommandDefinition> =
  TCommand extends CommandDefinition<infer TSchema, unknown, unknown>
    ? TSchema
    : never;

/**
 * Infers the public command name from a command path.
 */
export type CommandName<TCommand extends AnyCommandDefinition> =
  CommandPathName<TCommand['path']>;

/**
 * Declarative command registry used to resolve command paths.
 */
export type CommandRegistry<TCommands extends readonly AnyCommandDefinition[]> = {
  commands: TCommands;
  commandNames: readonly CommandName<TCommands[number]>[];
};

/**
 * Result of resolving a command from user positionals.
 */
export type ResolvedCommand<TCommand extends AnyCommandDefinition> = {
  name: CommandName<TCommand>;
  path: TCommand['path'];
  command: TCommand;
  positionals: string[];
};

/**
 * Command resolved and validated without runtime context.
 */
export type PreparedCommand<TCommand extends AnyCommandDefinition> = {
  name: CommandName<TCommand>;
  path: TCommand['path'];
  command: TCommand;
  options: InferOptions<CommandSchema<TCommand>>;
  provided: InferProvidedOptions<CommandSchema<TCommand>>;
  positionals: string[];
};

/**
 * Defines a command while preserving literal option schema types.
 */
export function defineCommand<
  const TSchema extends OptionsSchema,
  const TPath extends readonly [string, ...string[]],
  TContext = undefined,
  TResult = unknown,
  TMetadata = unknown
>(
  command: CommandDefinition<TSchema, TContext, TResult, TPath, TMetadata>
): CommandDefinition<TSchema, TContext, TResult, TPath, TMetadata> {
  return command;
}

/**
 * Defines a command registry while preserving literal command path types.
 */
export function defineCommandRegistry<
  const TCommands extends readonly AnyCommandDefinition[]
>(
  commands: TCommands
): CommandRegistry<TCommands> {
  const commandNames = commands.map((command) => commandPathToName(command.path));

  assertNoDuplicateCommandNames(commandNames);

  return {
    commands,
    commandNames: commandNames as unknown as readonly CommandName<TCommands[number]>[]
  };
}

/**
 * Checks whether a value is a command name registered in the given registry.
 */
export function isCommandName<
  const TCommands extends readonly AnyCommandDefinition[]
>(
  registry: CommandRegistry<TCommands>,
  value: unknown
): value is CommandName<TCommands[number]> {
  return typeof value === 'string'
    && registry.commandNames.includes(value as CommandName<TCommands[number]>);
}

/**
 * Resolves a command from already parsed positional arguments.
 */
export function resolveCommand<
  const TCommands extends readonly AnyCommandDefinition[]
>(
  registry: CommandRegistry<TCommands>,
  positionals: readonly string[]
): ResolvedCommand<TCommands[number]> {
  for (const command of commandsBySpecificity(registry.commands)) {
    const resolved = resolveCommandCandidate(command, positionals);

    if (resolved !== undefined) {
      return resolved;
    }
  }

  throw createUnknownCommandError(positionals);
}

/**
 * Resolves a command from raw CLI arguments using each command's option schema.
 */
export function resolveCommandFromArgs<
  const TCommands extends readonly AnyCommandDefinition[]
>(
  registry: CommandRegistry<TCommands>,
  args: readonly string[]
): ResolvedCommand<TCommands[number]> {
  for (const command of commandsBySpecificity(registry.commands)) {
    const argv = parseArgv(args, command.options);
    const resolved = resolveCommandCandidate(command, argv.positionals);

    if (resolved !== undefined) {
      return resolved;
    }
  }

  throw createUnknownCommandError(parseArgv(args).positionals);
}

/**
 * Resolves and validates a command without requiring runtime context.
 */
export async function prepareCommandFromArgs<
  const TCommands extends readonly AnyCommandDefinition[]
>(
  registry: CommandRegistry<TCommands>,
  args: readonly string[]
): Promise<PreparedCommand<TCommands[number]>> {
  for (const command of commandsBySpecificity(registry.commands)) {
    const argv = parseArgv(args, command.options);
    const resolved = resolveCommandCandidate(command, argv.positionals);

    if (resolved !== undefined) {
      return prepareResolvedCommand(resolved, argv.options);
    }
  }

  throw createUnknownCommandError(parseArgv(args).positionals);
}

/**
 * Runs a prepared command with caller-provided runtime context.
 */
export async function runPreparedCommand<TCommand extends AnyCommandDefinition>(
  prepared: PreparedCommand<TCommand>,
  context: CommandContext<TCommand>
): Promise<CommandResult<TCommand>> {
  const result = await prepared.command.handle({
    options: prepared.options,
    provided: prepared.provided,
    positionals: prepared.positionals,
    context
  });

  return result as CommandResult<TCommand>;
}

/**
 * Resolves a command from a registry and runs its handler.
 */
export async function runCommandFromRegistry<
  const TCommands extends readonly AnyCommandDefinition[]
>(
  registry: CommandRegistry<TCommands>,
  args: readonly string[],
  context: CommandContext<TCommands[number]>
): Promise<CommandResult<TCommands[number]>> {
  const prepared = await prepareCommandFromArgs(registry, args);

  return runPreparedCommand(prepared, context);
}

/**
 * Parses arguments, validates command mechanics, and executes a command
 * handler.
 */
export async function runCommand<
  const TSchema extends OptionsSchema,
  TContext,
  TResult
>(
  command: CommandDefinition<TSchema, TContext, TResult>,
  args: readonly string[],
  context: TContext
): Promise<TResult> {
  const prepared = await prepareCommand(command, args);

  return runPreparedCommand(
    prepared,
    context as CommandContext<typeof command>
  ) as Promise<TResult>;
}

async function prepareCommand<TCommand extends AnyCommandDefinition>(
  command: TCommand,
  args: readonly string[]
): Promise<PreparedCommand<TCommand>> {
  const argv = parseArgv(args, command.options);
  const extraPositionals = resolveCommandPositionals(command.path, argv.positionals);
  const resolved = {
    name: commandPathToName(command.path) as CommandName<TCommand>,
    path: command.path,
    command,
    positionals: extraPositionals
  };

  return prepareResolvedCommand(resolved, argv.options);
}

async function prepareResolvedCommand<TCommand extends AnyCommandDefinition>(
  resolved: ResolvedCommand<TCommand>,
  rawOptions: Record<string, RawOptionValue>
): Promise<PreparedCommand<TCommand>> {
  const { command } = resolved;

  if (resolved.positionals.length > 0 && command.allowExtraPositionals !== true) {
    const positional = resolved.positionals[0] ?? '';

    throw new IcoreError(
      'UNEXPECTED_POSITIONAL',
      `Unexpected positional argument for '${command.path.join(' ')}': ${positional}`,
      {
        command: command.path.join(' '),
        positional,
        positionals: [...resolved.positionals]
      }
    );
  }

  const parsed = parseOptionsDetailed(command.options, rawOptions);
  const input = {
    options: parsed.options,
    provided: parsed.provided,
    positionals: resolved.positionals
  };

  await command.prepare?.(input);

  return {
    name: resolved.name,
    path: resolved.path,
    command,
    options: parsed.options,
    provided: parsed.provided,
    positionals: resolved.positionals
  } as PreparedCommand<TCommand>;
}

function resolveCommandPositionals(
  path: readonly string[],
  positionals: readonly string[]
): string[] {
  for (let index = 0; index < path.length; index += 1) {
    if (positionals[index] !== path[index]) {
      const command = path.join(' ');

      throw new IcoreError(
        'UNKNOWN_COMMAND',
        `Expected command '${command}'`,
        {
          command,
          path: [...path],
          positionals: [...positionals]
        }
      );
    }
  }

  return positionals.slice(path.length);
}

function commandPathToName(path: readonly string[]): string {
  return path.join(' ');
}

function assertNoDuplicateCommandNames(commandNames: readonly string[]): void {
  const seen = new Set<string>();

  for (const name of commandNames) {
    if (seen.has(name)) {
      throw new Error(`Unexpected duplicate command '${name}'`);
    }

    seen.add(name);
  }
}

function commandsBySpecificity<TCommand extends AnyCommandDefinition>(
  commands: readonly TCommand[]
): TCommand[] {
  return [...commands].sort(
    (left, right) => right.path.length - left.path.length
  );
}

function resolveCommandCandidate<TCommand extends AnyCommandDefinition>(
  command: TCommand,
  positionals: readonly string[]
): ResolvedCommand<TCommand> | undefined {
  const extraPositionals = resolveMatchingCommandPositionals(
    command.path,
    positionals
  );

  if (extraPositionals === undefined) {
    return undefined;
  }

  return {
    name: commandPathToName(command.path) as CommandName<TCommand>,
    path: command.path,
    command,
    positionals: extraPositionals
  };
}

function resolveMatchingCommandPositionals(
  path: readonly string[],
  positionals: readonly string[]
): string[] | undefined {
  for (let index = 0; index < path.length; index += 1) {
    if (positionals[index] !== path[index]) {
      return undefined;
    }
  }

  return positionals.slice(path.length);
}

function formatCommandPositionals(positionals: readonly string[]): string {
  return positionals.length === 0 ? '<empty>' : positionals.join(' ');
}

function createUnknownCommandError(positionals: readonly string[]): IcoreError {
  const command = formatCommandPositionals(positionals);

  return new IcoreError(
    'UNKNOWN_COMMAND',
    `Unknown command: ${command}`,
    {
      command,
      positionals: [...positionals]
    }
  );
}
