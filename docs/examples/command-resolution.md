# Resolve Commands

Use these functions when the application needs to choose a command without running it yet. This is useful for help, command previews, audit logs, and custom routing.

For a regular terminal application, start with `createTerminalApp()` or `createCommand().registry(...)`. Use the direct functions only when application code needs to choose a command itself.

## Define Commands Directly

`defineCommand(...)` is the direct form of `command.define(...)`.

```ts
// Define commands directly, then place them in a registry.
import {
  createCommands,
  defineCommand,
  defineCommandRegistry,
  type CommandAcceptedPath,
  type CommandName
} from 'icore';

const listJobsCommand = defineCommand({
  path: ['jobs', 'list'],
  options: {
    status: {
      type: 'string',
      choices: ['queued', 'running', 'done', 'failed']
    }
  } as const,
  handle({ options }) {
    return `status=${options.status ?? 'any'}\n`;
  }
});

const runJobCommand = defineCommand({
  path: ['jobs', 'run'],
  options: {
    'job-id': {
      type: 'string',
      required: true
    }
  } as const,
  handle({ options }) {
    return `run ${options['job-id']}\n`;
  }
});

// The registry is the input for standalone resolution functions.
const registry = defineCommandRegistry([
  listJobsCommand,
  runJobCommand
] as const);

// Infer the public name from one command definition.
type PublicCommandName = CommandName<typeof runJobCommand>;
```

Use this form when application code needs the command registry itself. Call `createCommands(...)` when it also needs `commands.prepare(...)` and `commands.run(...)`.

The inferred `PublicCommandName` is:

```ts
// This type is inferred from the command path above.
type PublicCommandName = 'jobs run';
```

## Give A Command Alternate Names

Put older or alternate paths on the main command definition. They use the same options, `prepare` function, description, and command function; they do not create additional commands.

```ts
// Keep alternate names on the command that implements the behavior.
const listAccountsCommand = defineCommand({
  path: ['account', 'list'],
  aliases: [
    ['users', 'get-accounts'],
    ['accounts']
  ],
  options: {
    format: {
      type: 'string',
      choices: ['table', 'json'],
      default: 'table'
    }
  } as const,
  handle({ options }) {
    return `format=${options.format}\n`;
  }
});

// Resolve the main path and an alternate path through one commands object.
const accountCommands = createCommands([
  listAccountsCommand
] as const);

const canonical = accountCommands.resolve([
  'account',
  'list'
]);
const aliased = accountCommands.resolve([
  'users',
  'get-accounts'
]);

type AcceptedAccountPath =
  CommandAcceptedPath<typeof listAccountsCommand>;
```

`name` and `path` always describe the main command. `matchedPath` records the name used for this call:

```ts
// Compare the main path with the alternate path that the user typed.
canonical.name;        // 'account list'
canonical.path;        // ['account', 'list']
canonical.matchedPath; // ['account', 'list']

aliased.name;           // 'account list'
aliased.path;           // ['account', 'list']
aliased.matchedPath;    // ['users', 'get-accounts']
```

For a call using the main name, `matchedPath === path`. TypeScript infers `AcceptedAccountPath` as the literal union of the main path and both alternate paths.

`accountCommands.names` contains only `'account list'`, and `accountCommands.definitions` contains one definition. Main and alternate paths use the same collision checks and longest-path selection; an exact collision is rejected as `DUPLICATE_COMMAND`.

When a call using an alternate name has an unexpected positional argument, the message uses that alternate name. The structured `UNEXPECTED_POSITIONAL` details keep `command` as the main name and add `matchedPath` for the name used in the call.

## Create A Commands Object From Existing Definitions

`createCommands(...)` creates the same commands object as `createCommand().registry(...)`.

```ts
// Build a commands object from definitions declared elsewhere.
const commands = createCommands([
  listJobsCommand,
  runJobCommand
] as const);

commands.names;
commands.registry;
```

Use this when command definitions are already created elsewhere and application code does not need the `createCommand()` object.

## Resolve From Positionals

Use `commands.resolve(...)` when command name and subcommands are already separate arguments.

```ts
// Resolve a command when its positional arguments are already separate.
const resolved = commands.resolve([
  'jobs',
  'run'
]);

resolved.name;
resolved.path;
resolved.matchedPath;
resolved.positionals;
```

The resolved command name is:

```text
jobs run
```

This function does not parse options. It is useful for help code that already has command arguments, but it does not validate a terminal call.

## Resolve From Raw Arguments

Use `commands.resolveFromArgs(...)` or standalone `resolveCommandFromArgs(...)` when raw terminal arguments may contain options.

```ts
// Both forms resolve a command from raw terminal arguments.
import { resolveCommandFromArgs } from 'icore';

const resolved = commands.resolveFromArgs([
  'jobs',
  'run',
  '--job-id',
  'job-42'
]);

const sameResolved = resolveCommandFromArgs(commands.registry, [
  'jobs',
  'run',
  '--job-id',
  'job-42'
]);
```

This form asks each command's option definition how to separate options from command arguments. It fits real terminal input better than `resolve(...)`. During one non-strict resolution, each main command definition is parsed at most once, even when it has several alternate names.

A parsing error in an unrelated command's options does not prevent another command from matching valid input. Parsing errors for the selected command and invalid option definitions are still rejected. If no command matches, a captured parsing error is reported.

Default resolution preserves option-first input:

```ts
// Default mode accepts an option before the command name.
await accountCommands.prepare([
  '--format=json',
  'users',
  'get-accounts'
]);
```

With `strict: true`, command names and alternate names are checked before options, so the command name must be the first argument:

```ts
// Strict mode requires the command name before its options.
await accountCommands.prepare([
  'users',
  'get-accounts',
  '--format=json'
], {
  strict: true
});
```

With `strict: true`, the option-first form is rejected. Parsing global options does not reorder arguments; use strict mode only when the command name must come first in the application's public CLI.

## Use The Standalone Function

`resolveCommand(...)` does the same command-name lookup as `commands.resolve(...)`.

```ts
// Resolve through a registry without creating a commands object.
import { resolveCommand } from 'icore';

const resolved = resolveCommand(registry, [
  'jobs',
  'list'
]);
```

Use `commands.resolve(...)` when code already has a `commands` object. Use the standalone function when it passes a registry object around.

## Guard Command Names

`isCommandName(...)` checks whether an unknown value is one of the command names in a registry.

```ts
// Render top-level help unless the value names a known command.
import { isCommandName } from 'icore';

function renderHelpPage(name: unknown): string {
  if (!isCommandName(commands.registry, name)) {
    return renderTopLevelHelp();
  }

  return renderCommandHelp(name);
}
```

This is safer than comparing string literals in several places. The check covers only main command names. Alternate names remain available on command definitions and through `matchedPath`; this function does not validate options or run a command.
