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

import { parseArgv } from '../argv/parser';
import { IcoreError } from '../errors/icore-error';
import { parseOptionsDetailed } from '../options/parser';
import type {
  InferOptions,
  InferProvidedOptions,
  OptionsSchema,
  RawOptionValue
} from '../options/schema';

/**
 * Input produced after command path and option validation, before runtime
 * context is attached.
 */
export type PreparedCommandInput<TSchema extends OptionsSchema> = {
  /** Parsed option values. */
  options: InferOptions<TSchema>;
  /** Explicit option presence metadata. */
  provided: InferProvidedOptions<TSchema>;
  /** Positionals after the command path. */
  positionals: string[];
};

/**
 * Input passed to a command handler after command path and option validation.
 */
export type CommandInput<
  TSchema extends OptionsSchema,
  TContext,
  TPayload = void
> = PreparedCommandInput<TSchema> & {
  /** Application runtime context. */
  context: TContext;
} & (
  [TPayload] extends [void]
    ? {
      /** Optional prepared payload. */
      payload?: TPayload;
    }
    : {
      /** Prepared payload. */
      payload: TPayload;
    }
);

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
  TMetadata = unknown,
  TPayload = void
> = {
  /** Command path segments. */
  path: TPath;
  /** Command option schema. */
  options: TSchema;
  /** Caller-owned static metadata. */
  metadata?: TMetadata;
  /** Allows extra positionals. */
  allowExtraPositionals?: boolean;
  /** Prepares payload before runtime context. */
  prepare?(input: PreparedCommandInput<TSchema>): TPayload | Promise<TPayload>;
  /** Runs application command behavior. */
  handle(input: CommandInput<TSchema, TContext, TPayload>): TResult | Promise<TResult>;
};

type AnyCommandInput = PreparedCommandInput<OptionsSchema> & {
  context: unknown;
  payload?: unknown;
};

type AnyCommandDefinition = {
  path: readonly [string, ...string[]];
  options: OptionsSchema;
  metadata?: unknown;
  allowExtraPositionals?: boolean;
  prepare?(input: PreparedCommandInput<OptionsSchema>): unknown | Promise<unknown>;
  handle(input: AnyCommandInput): unknown | Promise<unknown>;
};

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

type CommandDefinitionParts<TCommand extends AnyCommandDefinition> =
  TCommand extends CommandDefinition<
    infer TSchema,
    infer TContext,
    infer TResult,
    infer TPath,
    infer TMetadata,
    infer TPayload
  >
    ? {
      schema: TSchema;
      context: TContext;
      result: TResult;
      path: TPath;
      metadata: TMetadata;
      payload: TPayload;
    }
    : {
      schema: TCommand['options'];
      context: unknown;
      result: unknown;
      path: TCommand['path'];
      metadata: TCommand['metadata'];
      payload: unknown;
    };

/**
 * Infers the runtime context type required by a command.
 */
export type CommandContext<TCommand extends AnyCommandDefinition> =
  CommandDefinitionParts<TCommand>['context'];

/**
 * Infers the awaited command handler result type.
 */
export type CommandResult<TCommand extends AnyCommandDefinition> =
  Awaited<CommandDefinitionParts<TCommand>['result']>;

type CommandSchema<TCommand extends AnyCommandDefinition> =
  CommandDefinitionParts<TCommand>['schema'];

/**
 * Infers the payload type produced by a command prepare hook.
 */
export type CommandPayload<TCommand extends AnyCommandDefinition> =
  CommandDefinitionParts<TCommand>['payload'];

/**
 * Infers the public command name from a command path.
 */
export type CommandName<TCommand extends AnyCommandDefinition> =
  CommandPathName<TCommand['path']>;

/**
 * Declarative command registry used to resolve command paths.
 */
export type CommandRegistry<TCommands extends readonly AnyCommandDefinition[]> = {
  /** Registered command definitions. */
  commands: TCommands;
  /** Derived public command names. */
  commandNames: readonly CommandName<TCommands[number]>[];
};

/**
 * High-level command mechanics facade for terminal applications.
 */
export type Commands<TCommands extends readonly AnyCommandDefinition[]> = {
  /** Original command definitions. */
  definitions: TCommands;
  /** Public command names. */
  names: readonly CommandName<TCommands[number]>[];
  /** Lower-level command registry. */
  registry: CommandRegistry<TCommands>;
  /** Resolves from positionals. */
  resolve(positionals: readonly string[]): ResolvedCommand<TCommands[number]>;
  /** Resolves from raw argv. */
  resolveFromArgs(args: readonly string[]): ResolvedCommand<TCommands[number]>;
  /** Prepares without runtime context. */
  prepare(
    args: readonly string[],
    options?: CommandResolutionOptions
  ): Promise<PreparedCommand<TCommands[number]>>;
  /** Runs a prepared command. */
  run(
    prepared: PreparedCommand<TCommands[number]>,
    context: CommandContext<TCommands[number]>
  ): Promise<CommandResult<TCommands[number]>>;
  /** Resolves, prepares, and runs. */
  runFromArgs(
    args: readonly string[],
    context: CommandContext<TCommands[number]>,
    options?: CommandResolutionOptions
  ): Promise<CommandResult<TCommands[number]>>;
};

/**
 * Semantic facade for command mechanics.
 */
export type Command = {
  define: typeof defineCommand;
  registry: typeof createCommands;
  run: typeof runCommand;
};

/**
 * Options for command resolution from raw CLI arguments.
 */
export type CommandResolutionOptions = {
  /** Rejects options before command path. */
  strict?: boolean;
};

/**
 * Result of resolving a command from user positionals.
 */
export type ResolvedCommand<TCommand extends AnyCommandDefinition> = {
  /** Space-joined command name. */
  name: CommandName<TCommand>;
  /** Literal command path. */
  path: TCommand['path'];
  /** Selected command definition. */
  command: TCommand;
  /** Positionals after the command path. */
  positionals: string[];
};

/**
 * Command resolved and validated without runtime context.
 */
export type PreparedCommand<TCommand extends AnyCommandDefinition> =
  TCommand extends AnyCommandDefinition
    ? {
      /** Space-joined command name. */
      name: CommandName<TCommand>;
      /** Literal command path. */
      path: TCommand['path'];
      /** Selected command definition. */
      command: TCommand;
      /** Parsed option values. */
      options: InferOptions<CommandSchema<TCommand>>;
      /** Explicit option presence metadata. */
      provided: InferProvidedOptions<CommandSchema<TCommand>>;
      /** Positionals after the command path. */
      positionals: string[];
      /** Prepared payload. */
      payload: CommandPayload<TCommand>;
    }
    : never;

/**
 * Defines a command while preserving literal option schema types.
 */
export function defineCommand<
  const TSchema extends OptionsSchema,
  const TPath extends readonly [string, ...string[]],
  TContext = undefined,
  TResult = unknown,
  TMetadata = unknown,
  TPayload = void
>(
  command: CommandDefinition<TSchema, TContext, TResult, TPath, TMetadata, TPayload>
): CommandDefinition<TSchema, TContext, TResult, TPath, TMetadata, TPayload> {
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
 * Creates a command mechanics facade from declarative command definitions.
 */
export function createCommands<
  const TCommands extends readonly AnyCommandDefinition[]
>(
  definitions: TCommands
): Commands<TCommands> {
  const registry = defineCommandRegistry(definitions);

  return {
    definitions,
    names: registry.commandNames,
    registry,
    resolve(positionals) {
      return resolveCommand(registry, positionals);
    },
    resolveFromArgs(args) {
      return resolveCommandFromArgs(registry, args);
    },
    prepare(args, options) {
      return prepareCommandFromArgs(registry, args, options);
    },
    run(prepared, context) {
      return runPreparedCommand(prepared, context);
    },
    runFromArgs(args, context, options) {
      return runCommandFromRegistry(registry, args, context, options);
    }
  };
}

/**
 * Creates a semantic command mechanics facade.
 */
export function createCommand(): Command {
  return {
    define: defineCommand,
    registry: createCommands,
    run: runCommand
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
 * Checks whether a prepared command has the given command name.
 */
export function isPreparedCommandName<
  TPrepared extends PreparedCommand<AnyCommandDefinition>,
  TName extends TPrepared['name']
>(
  prepared: TPrepared,
  name: TName
): prepared is Extract<TPrepared, { name: TName }> {
  return prepared.name === name;
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
  args: readonly string[],
  options: CommandResolutionOptions = {}
): Promise<PreparedCommand<TCommands[number]>> {
  if (options.strict === true) {
    return prepareCommandFromArgsStrict(registry, args);
  }

  for (const command of commandsBySpecificity(registry.commands)) {
    const argv = parseArgv(args, command.options);
    const resolved = resolveCommandCandidate(command, argv.positionals);

    if (resolved !== undefined) {
      return prepareResolvedCommand(
        resolved,
        argv.options
      ) as Promise<PreparedCommand<TCommands[number]>>;
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
    context,
    payload: prepared.payload
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
  context: CommandContext<TCommands[number]>,
  options: CommandResolutionOptions = {}
): Promise<CommandResult<TCommands[number]>> {
  const prepared = await prepareCommandFromArgs(registry, args, options);

  return runPreparedCommand(prepared, context);
}

/**
 * Parses arguments, validates command mechanics, and executes a command
 * handler.
 */
export async function runCommand<
  const TSchema extends OptionsSchema,
  TContext,
  TResult,
  const TPath extends readonly [string, ...string[]] = readonly [string, ...string[]],
  TMetadata = unknown,
  TPayload = void
>(
  command: CommandDefinition<TSchema, TContext, TResult, TPath, TMetadata, TPayload>,
  args: readonly string[],
  context: TContext,
  options: CommandResolutionOptions = {}
): Promise<TResult> {
  const prepared = await prepareCommand(command, args, options);

  return runPreparedCommand(
    prepared,
    context as CommandContext<typeof command>
  ) as Promise<TResult>;
}

async function prepareCommand<TCommand extends AnyCommandDefinition>(
  command: TCommand,
  args: readonly string[],
  options: CommandResolutionOptions = {}
): Promise<PreparedCommand<TCommand>> {
  if (options.strict === true) {
    assertNoOptionBeforeCommand(args);
  }

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

async function prepareCommandFromArgsStrict<
  const TCommands extends readonly AnyCommandDefinition[]
>(
  registry: CommandRegistry<TCommands>,
  args: readonly string[]
): Promise<PreparedCommand<TCommands[number]>> {
  const command = findStrictCommand(registry, args);

  if (command === undefined) {
    throw createUnknownCommandError(commandPositionalsBeforeOptions(args));
  }

  const argv = parseArgv(args, command.options);
  const resolved = resolveCommandCandidate(command, argv.positionals);

  if (resolved === undefined) {
    throw createUnknownCommandError(argv.positionals);
  }

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

  const payload = await command.prepare?.(input);

  return {
    name: resolved.name,
    path: resolved.path,
    command,
    options: parsed.options,
    provided: parsed.provided,
    positionals: resolved.positionals,
    payload
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
      throw createDuplicateCommandError(name);
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

function findStrictCommand<
  const TCommands extends readonly AnyCommandDefinition[]
>(
  registry: CommandRegistry<TCommands>,
  args: readonly string[]
): TCommands[number] | undefined {
  assertNoOptionBeforeCommand(args);

  for (const command of commandsBySpecificity(registry.commands)) {
    if (commandPathMatchesArgs(command.path, args)) {
      return command;
    }
  }

  return undefined;
}

function assertNoOptionBeforeCommand(args: readonly string[]): void {
  const firstArg = args[0];

  if (firstArg !== undefined && isOptionBeforeCommand(firstArg)) {
    throw createUnexpectedArgumentError(firstArg);
  }
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

function commandPathMatchesArgs(
  path: readonly string[],
  args: readonly string[]
): boolean {
  for (let index = 0; index < path.length; index += 1) {
    if (args[index] !== path[index]) {
      return false;
    }
  }

  return true;
}

function commandPositionalsBeforeOptions(args: readonly string[]): string[] {
  const positionals: string[] = [];

  for (const arg of args) {
    if (isOptionBeforeCommand(arg)) {
      break;
    }

    positionals.push(arg);
  }

  return positionals;
}

function isOptionBeforeCommand(arg: string): boolean {
  return arg !== '-' && arg.startsWith('-');
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

function createUnexpectedArgumentError(argument: string): IcoreError {
  return new IcoreError(
    'UNEXPECTED_ARGUMENT',
    `Unexpected argument '${argument}'`,
    {
      argument
    }
  );
}

function createDuplicateCommandError(command: string): IcoreError {
  return new IcoreError(
    'DUPLICATE_COMMAND',
    `Unexpected duplicate command '${command}'`,
    {
      command
    }
  );
}
