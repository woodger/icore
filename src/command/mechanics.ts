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

import {
  parseArgv,
  type ParsedArgv
} from '../argv/parser';
import { IcoreError } from '../errors/icore-error';
import { parseOptionsDetailed } from '../options/parser';
import type {
  InferOptions,
  InferProvidedOptions,
  OptionsSchema,
  RawOptionValue
} from '../options/schema';

/** Non-empty command path accepted by command resolution. */
export type CommandPath = readonly [string, ...string[]];

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
  TPath extends CommandPath = CommandPath,
  TMetadata = unknown,
  TPayload = void,
  TAliases extends readonly CommandPath[] = readonly CommandPath[]
> = {
  /** Preferred command path segments. */
  path: TPath;
  /** Alternative command paths resolving to this command. */
  aliases?: TAliases;
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
  path: CommandPath;
  aliases?: readonly CommandPath[];
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
    infer TPayload,
    infer TAliases
  >
    ? {
      schema: TSchema;
      context: TContext;
      result: TResult;
      path: TPath;
      metadata: TMetadata;
      payload: TPayload;
      aliases: TAliases;
    }
    : {
      schema: TCommand['options'];
      context: unknown;
      result: unknown;
      path: TCommand['path'];
      metadata: TCommand['metadata'];
      payload: unknown;
      aliases: NonNullable<TCommand['aliases']>;
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
 * Infers every canonical or alias path accepted for a command.
 */
export type CommandAcceptedPath<TCommand extends AnyCommandDefinition> =
  TCommand extends AnyCommandDefinition
    ? TCommand['path'] | CommandDefinitionParts<TCommand>['aliases'][number]
    : never;

/**
 * Declarative command registry used to resolve command paths.
 */
export type CommandRegistry<TCommands extends readonly AnyCommandDefinition[]> = {
  /** Registered command definitions. */
  commands: TCommands;
  /** Derived canonical command names. */
  commandNames: readonly CommandName<TCommands[number]>[];
};

/**
 * High-level command mechanics facade for terminal applications.
 */
export type Commands<TCommands extends readonly AnyCommandDefinition[]> = {
  /** Original command definitions. */
  definitions: TCommands;
  /** Canonical public command names. */
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
 * Application-level command types fixed by a bound command builder.
 */
export type CommandTypeBindings = {
  /** Runtime context shared by the application's commands. */
  context: unknown;
  /** Result type accepted from application command handlers. */
  result: unknown;
  /** Static metadata shared by the application's command definitions. */
  metadata: unknown;
  /** Makes metadata mandatory for definitions created by this builder. */
  metadataRequired?: boolean;
};

type BoundCommandMetadata<
  TMetadata,
  TRequired extends boolean
> = TRequired extends true
  ? {
    metadata: TMetadata;
  }
  : {
    metadata?: TMetadata;
  };

type BoundCommandDefinition<
  TSchema extends OptionsSchema,
  TContext,
  TResult,
  TPath extends CommandPath,
  TMetadata,
  TPayload,
  TAliases extends readonly CommandPath[],
  TMetadataRequired extends boolean
> = Omit<
  CommandDefinition<
    TSchema,
    TContext,
    TResult,
    TPath,
    TMetadata,
    TPayload,
    TAliases
  >,
  'metadata'
> & BoundCommandMetadata<TMetadata, TMetadataRequired>;

type BoundDefineCommand<TBindings extends CommandTypeBindings> = <
  const TSchema extends OptionsSchema,
  const TPath extends CommandPath,
  TResult extends TBindings['result'],
  TPayload = void,
  const TAliases extends readonly CommandPath[] = readonly []
>(
  command: BoundCommandDefinition<
    TSchema,
    TBindings['context'],
    TResult,
    TPath,
    TBindings['metadata'],
    TPayload,
    TAliases,
    TBindings['metadataRequired'] extends true ? true : false
  >
) => BoundCommandDefinition<
  TSchema,
  TBindings['context'],
  TResult,
  TPath,
  TBindings['metadata'],
  TPayload,
  TAliases,
  TBindings['metadataRequired'] extends true ? true : false
>;

/**
 * Command mechanics facade with application-level command types fixed once.
 */
export type BoundCommand<TBindings extends CommandTypeBindings> =
  Omit<Command, 'define'> & {
    define: BoundDefineCommand<TBindings>;
  };

/**
 * Options for command resolution from raw CLI arguments.
 */
export type CommandResolutionOptions = {
  /** Rejects options before command path. */
  strict?: boolean;
};

type CommandRoute<TCommand extends AnyCommandDefinition> = {
  command: TCommand;
  matchedPath: CommandAcceptedPath<TCommand>;
};

type AnyCommandRoute = {
  command: AnyCommandDefinition;
  matchedPath: CommandPath;
};

const commandRoutesByRegistry = new WeakMap<
  object,
  readonly AnyCommandRoute[]
>();

/**
 * Result of resolving a command from user positionals.
 */
export type ResolvedCommand<TCommand extends AnyCommandDefinition> = {
  /** Space-joined canonical command name. */
  name: CommandName<TCommand>;
  /** Canonical command path. */
  path: TCommand['path'];
  /** Canonical or alias path matched for this invocation. */
  matchedPath: CommandAcceptedPath<TCommand>;
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
      /** Space-joined canonical command name. */
      name: CommandName<TCommand>;
      /** Canonical command path. */
      path: TCommand['path'];
      /** Canonical or alias path matched for this invocation. */
      matchedPath: CommandAcceptedPath<TCommand>;
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
  TPayload = void,
  const TAliases extends readonly CommandPath[] = readonly []
>(
  command: CommandDefinition<
    TSchema,
    TContext,
    TResult,
    TPath,
    TMetadata,
    TPayload,
    TAliases
  >
): CommandDefinition<
  TSchema,
  TContext,
  TResult,
  TPath,
  TMetadata,
  TPayload,
  TAliases
> {
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
  const routes = createCommandRoutes(commands);
  const registry = {
    commands,
    commandNames: commandNames as unknown as readonly CommandName<TCommands[number]>[]
  };

  commandRoutesByRegistry.set(
    registry,
    routes as readonly AnyCommandRoute[]
  );

  return registry;
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
 *
 * Use `createCommand.withTypes<...>()` to fix application-level context,
 * result, and metadata types while preserving per-command inference.
 */
export function createCommand(): Command {
  return {
    define: defineCommand,
    registry: createCommands,
    run: runCommand
  };
}

function createCommandWithTypes<
  TBindings extends CommandTypeBindings
>(): BoundCommand<TBindings> {
  return createCommand() as BoundCommand<TBindings>;
}

createCommand.withTypes = createCommandWithTypes;

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
  for (const route of commandRoutes(registry)) {
    const resolved = resolveCommandRoute(route, positionals);

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
  const parsedByCommand = new Map<TCommands[number], ParsedArgv>();

  for (const route of commandRoutes(registry)) {
    const argv = parseCommandArgs(
      route.command,
      args,
      parsedByCommand
    );
    const resolved = resolveCommandRoute(route, argv.positionals);

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

  const parsedByCommand = new Map<TCommands[number], ParsedArgv>();

  for (const route of commandRoutes(registry)) {
    const argv = parseCommandArgs(
      route.command,
      args,
      parsedByCommand
    );
    const resolved = resolveCommandRoute(route, argv.positionals);

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
  TPayload = void,
  const TAliases extends readonly CommandPath[] = readonly CommandPath[]
>(
  command: CommandDefinition<
    TSchema,
    TContext,
    TResult,
    TPath,
    TMetadata,
    TPayload,
    TAliases
  >,
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
  const routes = createCommandRoutes([
    command
  ]);
  let matchedRoute: CommandRoute<TCommand> | undefined;

  if (options.strict === true) {
    matchedRoute = findMatchingRawCommandRoute(routes, args);

    if (matchedRoute === undefined) {
      assertNoOptionBeforeCommand(args, longestCommandPathLength(routes));
    }
  }

  const argv = parseArgv(args, command.options);

  matchedRoute ??= findMatchingCommandRoute(routes, argv.positionals);

  if (matchedRoute === undefined) {
    throw createCommandPathMismatchError(command.path, argv.positionals);
  }

  const resolved = resolveCommandRoute(matchedRoute, argv.positionals);

  if (resolved === undefined) {
    throw createCommandPathMismatchError(command.path, argv.positionals);
  }

  return prepareResolvedCommand(resolved, argv.options);
}

async function prepareCommandFromArgsStrict<
  const TCommands extends readonly AnyCommandDefinition[]
>(
  registry: CommandRegistry<TCommands>,
  args: readonly string[]
): Promise<PreparedCommand<TCommands[number]>> {
  const route = findStrictCommandRoute(registry, args);

  if (route === undefined) {
    throw createUnknownCommandError(commandPositionalsBeforeOptions(args));
  }

  const argv = parseArgv(args, route.command.options);
  const resolved = resolveCommandRoute(route, argv.positionals);

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
    const matchedCommand = commandPathToName(resolved.matchedPath);
    const aliasDetails = resolved.matchedPath === command.path
      ? {}
      : {
        matchedPath: [...resolved.matchedPath]
      };

    throw new IcoreError(
      'UNEXPECTED_POSITIONAL',
      `Unexpected positional argument for '${matchedCommand}': ${positional}`,
      {
        command: commandPathToName(command.path),
        positional,
        positionals: [...resolved.positionals],
        ...aliasDetails
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
    matchedPath: resolved.matchedPath,
    command,
    options: parsed.options,
    provided: parsed.provided,
    positionals: resolved.positionals,
    payload
  } as PreparedCommand<TCommand>;
}

function commandPathToName(path: readonly string[]): string {
  return path.join(' ');
}

function createCommandRoutes<TCommand extends AnyCommandDefinition>(
  commands: readonly TCommand[]
): CommandRoute<TCommand>[] {
  const routes: CommandRoute<TCommand>[] = [];
  const commandNames = new Set<string>();

  for (const command of commands) {
    appendCommandRoute(routes, commandNames, command, command.path);

    for (const alias of command.aliases ?? []) {
      appendCommandRoute(routes, commandNames, command, alias);
    }
  }

  return routes.sort(
    (left, right) => right.matchedPath.length - left.matchedPath.length
  );
}

function appendCommandRoute<TCommand extends AnyCommandDefinition>(
  routes: CommandRoute<TCommand>[],
  commandNames: Set<string>,
  command: TCommand,
  matchedPath: CommandPath
): void {
  const name = commandPathToName(matchedPath);

  if (commandNames.has(name)) {
    throw createDuplicateCommandError(name);
  }

  commandNames.add(name);
  routes.push({
    command,
    matchedPath: matchedPath as CommandAcceptedPath<TCommand>
  });
}

function commandRoutes<
  const TCommands extends readonly AnyCommandDefinition[]
>(
  registry: CommandRegistry<TCommands>,
): readonly CommandRoute<TCommands[number]>[] {
  const cached = commandRoutesByRegistry.get(registry);

  if (cached !== undefined) {
    return cached as readonly CommandRoute<TCommands[number]>[];
  }

  const routes = createCommandRoutes(registry.commands);

  commandRoutesByRegistry.set(
    registry,
    routes as readonly AnyCommandRoute[]
  );

  return routes;
}

function parseCommandArgs<TCommand extends AnyCommandDefinition>(
  command: TCommand,
  args: readonly string[],
  parsedByCommand: Map<TCommand, ParsedArgv>
): ParsedArgv {
  // Canonical and alias routes share one definition, so route matching must
  // not parse the same argv again for every accepted path.
  const cached = parsedByCommand.get(command);

  if (cached !== undefined) {
    return cached;
  }

  const argv = parseArgv(args, command.options);

  parsedByCommand.set(command, argv);

  return argv;
}

function findStrictCommandRoute<
  const TCommands extends readonly AnyCommandDefinition[]
>(
  registry: CommandRegistry<TCommands>,
  args: readonly string[]
): CommandRoute<TCommands[number]> | undefined {
  assertNoOptionBeforeCommand(args, 1);

  const routes = commandRoutes(registry);
  const matchedRoute = findMatchingRawCommandRoute(routes, args);

  if (matchedRoute !== undefined) {
    return matchedRoute;
  }

  const interruptedByOption = findOptionBeforeMatchingCommandPath(
    routes,
    args
  );

  if (interruptedByOption !== undefined) {
    throw createUnexpectedArgumentError(interruptedByOption);
  }

  return undefined;
}

function findOptionBeforeMatchingCommandPath<
  TCommand extends AnyCommandDefinition
>(
  routes: readonly CommandRoute<TCommand>[],
  args: readonly string[]
): string | undefined {
  for (const route of routes) {
    for (let index = 0; index < route.matchedPath.length; index += 1) {
      const arg = args[index];

      if (arg === route.matchedPath[index]) {
        continue;
      }

      if (arg !== undefined && isOptionBeforeCommand(arg)) {
        return arg;
      }

      break;
    }
  }

  return undefined;
}

function assertNoOptionBeforeCommand(
  args: readonly string[],
  commandPathLength: number
): void {
  for (let index = 0; index < commandPathLength; index += 1) {
    const arg = args[index];

    if (arg !== undefined && isOptionBeforeCommand(arg)) {
      throw createUnexpectedArgumentError(arg);
    }
  }
}

function findMatchingCommandRoute<TCommand extends AnyCommandDefinition>(
  routes: readonly CommandRoute<TCommand>[],
  positionals: readonly string[]
): CommandRoute<TCommand> | undefined {
  for (const route of routes) {
    if (
      resolveMatchingCommandPositionals(route.matchedPath, positionals)
      !== undefined
    ) {
      return route;
    }
  }

  return undefined;
}

function findMatchingRawCommandRoute<TCommand extends AnyCommandDefinition>(
  routes: readonly CommandRoute<TCommand>[],
  args: readonly string[]
): CommandRoute<TCommand> | undefined {
  for (const route of routes) {
    if (commandPathMatchesArgs(route.matchedPath, args)) {
      return route;
    }
  }

  return undefined;
}

function longestCommandPathLength<TCommand extends AnyCommandDefinition>(
  routes: readonly CommandRoute<TCommand>[]
): number {
  return routes[0]?.matchedPath.length ?? 1;
}

function resolveCommandRoute<TCommand extends AnyCommandDefinition>(
  route: CommandRoute<TCommand>,
  positionals: readonly string[]
): ResolvedCommand<TCommand> | undefined {
  const extraPositionals = resolveMatchingCommandPositionals(
    route.matchedPath,
    positionals
  );

  if (extraPositionals === undefined) {
    return undefined;
  }

  return {
    name: commandPathToName(route.command.path) as CommandName<TCommand>,
    path: route.command.path,
    matchedPath: route.matchedPath,
    command: route.command,
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

function createCommandPathMismatchError(
  path: CommandPath,
  positionals: readonly string[]
): IcoreError<'UNKNOWN_COMMAND'> {
  const command = commandPathToName(path);

  return new IcoreError(
    'UNKNOWN_COMMAND',
    `Expected command '${command}'`,
    {
      reason: 'path-mismatch',
      command,
      path: [...path],
      positionals: [...positionals]
    }
  );
}

function createUnknownCommandError(
  positionals: readonly string[]
): IcoreError<'UNKNOWN_COMMAND'> {
  const command = formatCommandPositionals(positionals);

  return new IcoreError(
    'UNKNOWN_COMMAND',
    `Unknown command: ${command}`,
    {
      reason: 'unresolved',
      command,
      positionals: [...positionals]
    }
  );
}

function createUnexpectedArgumentError(
  argument: string
): IcoreError<'UNEXPECTED_ARGUMENT'> {
  return new IcoreError(
    'UNEXPECTED_ARGUMENT',
    `Unexpected argument '${argument}'`,
    {
      reason: 'option-before-command',
      argument
    }
  );
}

function createDuplicateCommandError(
  command: string
): IcoreError<'DUPLICATE_COMMAND'> {
  return new IcoreError(
    'DUPLICATE_COMMAND',
    `Unexpected duplicate command '${command}'`,
    {
      command
    }
  );
}
