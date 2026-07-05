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
  defineCommand,
  defineCommandRegistry,
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

## Create A Commands Object Directly

`createCommands(...)` is the direct alternative to
`createCommand().registry(...)`.

```ts
import { createCommands } from 'icore';

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
is a better fit for real argv input than `resolve(...)`.

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
cost is that the guard only checks registered command names; it does not
validate options or execute anything.

