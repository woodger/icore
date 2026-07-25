# Command Resolution

Use these primitives when the application needs command selection without
immediately running a command. This is common in help systems, command previews,
audit logs, and custom routers.

For regular terminal applications, prefer `createTerminalApp()` or
`createCommand().registry(...)`. The lower-level resolution API is more verbose,
but it makes command selection explicit and testable.

## Define Commands Without The Facade

`defineCommand(...)` is the low-level form behind `command.define(...)`.

```ts
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

const registry = defineCommandRegistry([
  listJobsCommand,
  runJobCommand
] as const);

type PublicCommandName = CommandName<typeof runJobCommand>;
```

Use this form when the registry itself is the important object. The tradeoff is
that you do not get the convenient `commands.prepare(...)` and
`commands.run(...)` methods until you call `createCommands(...)`.

The inferred `PublicCommandName` is:

```ts
type PublicCommandName = 'jobs run';
```

## Declare Canonical Command Aliases

Put compatibility paths on the canonical command definition. Aliases select the
same option schema, prepare hook, metadata, and handler; they do not create
additional command definitions.

```ts
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

`name` and `path` always describe the canonical command. `matchedPath` records
the path used for this invocation:

```ts
canonical.name;        // 'account list'
canonical.path;        // ['account', 'list']
canonical.matchedPath; // ['account', 'list']

aliased.name;           // 'account list'
aliased.path;           // ['account', 'list']
aliased.matchedPath;    // ['users', 'get-accounts']
```

For a canonical invocation, `matchedPath === path`. The inferred
`AcceptedAccountPath` is the literal union of the canonical path and both alias
paths.

`accountCommands.names` contains only `'account list'`, and
`accountCommands.definitions` contains one definition. Canonical and alias
paths participate in the same collision validation and longest-path
resolution; an exact collision is rejected as `DUPLICATE_COMMAND`.

When an alias invocation has an unexpected positional, the human-readable
message uses the matched alias. Structured `UNEXPECTED_POSITIONAL` details keep
`command` canonical and add `matchedPath` for that alias invocation.

## Create A Commands Object Directly

`createCommands(...)` is the direct alternative to
`createCommand().registry(...)`.

```ts
const commands = createCommands([
  listJobsCommand,
  runJobCommand
] as const);

commands.names;
commands.registry;
```

This is useful when command definitions are already created elsewhere and the
application does not need the `createCommand()` object. It is not better for
normal code; it is just a more direct construction form.

## Resolve From Positionals

Use `commands.resolve(...)` when arguments are already split into command path
tokens.

```ts
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

No options are parsed in this form. That is intentional: it is useful for help
renderers that already have command tokens, but it is not enough to validate a
terminal call.

## Resolve From Raw Arguments

Use `commands.resolveFromArgs(...)` or standalone
`resolveCommandFromArgs(...)` when raw terminal arguments may contain options.

```ts
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

This form asks each command schema how to split options from command tokens. It
is a better fit for real argv input than `resolve(...)`. During one non-strict
resolution, each canonical command definition is parsed at most once,
regardless of how many alias paths it owns.

Default resolution preserves option-first input:

```ts
await accountCommands.prepare([
  '--format=json',
  'users',
  'get-accounts'
]);
```

Strict resolution searches canonical and alias paths before parsing, so the
path must begin with the first argument:

```ts
await accountCommands.prepare([
  'users',
  'get-accounts',
  '--format=json'
], {
  strict: true
});
```

The option-first form is rejected with `strict: true`. Parsing global or
bootstrap options does not itself reorder argv; an application should enable
strict mode only when command-first syntax is its public contract.

## Use The Standalone Resolver

`resolveCommand(...)` is the primitive behind `commands.resolve(...)`.

```ts
import { resolveCommand } from 'icore';

const resolved = resolveCommand(registry, [
  'jobs',
  'list'
]);
```

Prefer `commands.resolve(...)` when you already have a `commands` object. Use
the standalone function when a custom registry object is passed around.

## Guard Command Names

`isCommandName(...)` narrows unknown input to the command names registered in a
registry.

```ts
import { isCommandName } from 'icore';

function renderHelpPage(name: unknown): string {
  if (!isCommandName(commands.registry, name)) {
    return renderTopLevelHelp();
  }

  return renderCommandHelp(name);
}
```

This is safer than comparing against string literals in several places. The
cost is that the guard checks only canonical command names. Alias paths remain
available on command definitions and through `matchedPath`; the guard does not
validate options or execute anything.
