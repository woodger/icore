# Two-Phase Primitives

The high-level flow is `commands.prepare(...)` followed by
`commands.run(...)`. The primitives below are useful when a custom terminal
boundary needs the same pieces without adopting the full facade.

Prefer the facade first. These primitives are intentionally lower-level and
become worthwhile only when the application needs a custom lifecycle.

The snippets below use this setup:

```ts
import {
  createCommand,
  createTerminalApp,
  isTerminalCommandOutput
} from 'icore';

type AppContext = {
  workspace: string;
};

const command = createCommand();

const runJobCommand = command.define({
  path: ['jobs', 'run'],
  options: {
    'job-id': {
      type: 'string',
      required: true
    }
  } as const,
  prepare({ options }) {
    return {
      jobId: options['job-id'].trim()
    };
  },
  handle({ payload, context }: {
    payload: { jobId: string };
    context: AppContext;
  }) {
    return `${context.workspace}:${payload.jobId}\n`;
  }
});

const commands = command.registry([
  runJobCommand
] as const);

const app = createTerminalApp({
  commands
});
```

## Prepare From A Terminal App

`app.prepare(...)` lets an application validate command input before runtime
context exists.

```ts
const prepared = await app.prepare([
  'jobs',
  'run',
  '--job-id',
  'job-42'
], {
  strict: true
});

prepared.name;
prepared.options;
prepared.provided;
```

This is useful when the selected command decides which runtime resources to
create. If preparation fails, the application can print an argument error
without opening connections or starting background work.

## Run Prepared Through A Terminal App

`app.runPrepared(...)` keeps terminal rendering, stdout/stderr writing, and exit
code handling in `createTerminalApp()` after the application has created its
own runtime context.

```ts
const prepared = await app.prepare([
  'jobs',
  'run',
  '--job-id',
  'job-42'
], {
  strict: true
});

const context = await createContext(prepared);

try {
  process.exitCode = await app.runPrepared(prepared, context);
}
finally {
  await cleanup(context);
}
```

Resource creation and cleanup stay application-owned. The terminal app only
runs the prepared command and applies the same output behavior as `app.run(...)`.

## Write Prepared Output

Use `app.writePreparedOutput(...)` when the application needs to inspect the raw
command result before terminal output is written.

```ts
const prepared = await app.prepare([
  'jobs',
  'run',
  '--job-id',
  'job-42'
], {
  strict: true
});

const context = await createContext(prepared);

try {
  const result = await app.commands.run(prepared, context);

  if (isShutdownHandle(result)) {
    installShutdownHooks(result);

    return;
  }

  if (!isTerminalCommandOutput(result)) {
    throw new Error('Expected terminal command output');
  }

  await app.writePreparedOutput(prepared, result);
}
finally {
  await cleanup(context);
}
```

Only terminal output belongs here: ready text, streaming text, presentation
results, or no output. Strings are written exactly as provided; include `\n`
when line output is desired. If the raw result remains `unknown` at this
boundary, narrow it with `isTerminalCommandOutput(...)` before writing.

## Prepare From A Registry

`prepareCommandFromArgs(...)` is the standalone primitive behind
`commands.prepare(...)`.

```ts
import {
  prepareCommandFromArgs,
  type CommandPayload
} from 'icore';

const prepared = await prepareCommandFromArgs(commands.registry, [
  'jobs',
  'run',
  '--job-id',
  'job-42'
], {
  strict: true
});

type Payload = CommandPayload<typeof runJobCommand>;
```

Use this when code owns a registry but does not use the `commands` object. The
tradeoff is weaker readability: readers have to know which primitive maps to
which facade method.

## Run A Prepared Command

`runPreparedCommand(...)` executes a command that was already resolved and
validated.

```ts
import {
  runPreparedCommand,
  type CommandContext,
  type CommandResult
} from 'icore';

type Context = CommandContext<typeof runJobCommand>;
type Result = CommandResult<typeof runJobCommand>;

const context: Context = {
  workspace: 'local'
};

const result: Result = await runPreparedCommand(prepared, context);
```

This is the safest primitive when context creation has side effects. Prepare
first, then create the exact context the selected command needs.

## Narrow Prepared Commands

`isPreparedCommandName(...)` narrows a prepared-command union by command name.

```ts
import { isPreparedCommandName } from 'icore';

if (isPreparedCommandName(prepared, 'jobs run')) {
  prepared.options['job-id'];
}
```

Use this when several commands reuse one preparation flow but need different
runtime setup. The guard is intentionally narrow: it checks the prepared
command name, not arbitrary metadata.

## Run From A Registry

`runCommandFromRegistry(...)` is the standalone primitive behind
`commands.runFromArgs(...)`.

```ts
import { runCommandFromRegistry } from 'icore';

const output = await runCommandFromRegistry(
  commands.registry,
  [
    'jobs',
    'run',
    '--job-id',
    'job-42'
  ],
  {
    workspace: 'local'
  },
  {
    strict: true
  }
);
```

This is compact, but it removes the explicit gap between validation and runtime
context creation. Use it when that gap does not matter.

## Run One Command Without A Registry

Use `command.run(...)` or standalone `runCommand(...)` for focused execution of
one command.

```ts
import { runCommand } from 'icore';

const outputFromFacade = await command.run(runJobCommand, [
  'jobs',
  'run',
  '--job-id',
  'job-42'
], {
  workspace: 'local'
}, {
  strict: true
});

const outputFromPrimitive = await runCommand(runJobCommand, [
  'jobs',
  'run',
  '--job-id',
  'job-42'
], {
  workspace: 'local'
}, {
  strict: true
});
```

This is useful for tests and tiny tools. It is a poor fit for large CLIs because
it skips registry-level command selection.

## Read Provided Metadata

`parseOptionsDetailed(...)` returns parsed values plus a presence map.

```ts
import {
  parseOptionsDetailed,
  type InferProvidedOptions
} from 'icore';

const schema = {
  format: {
    type: 'string',
    choices: ['table', 'json'],
    default: 'table'
  },
  verbose: {
    type: 'boolean'
  }
} as const;

const parsed = parseOptionsDetailed(schema, {
  verbose: true
});

type Provided = InferProvidedOptions<typeof schema>;
```

The parsed options are:

```ts
{
  format: 'table',
  verbose: true
}
```

The provided map is:

```ts
{
  format: false,
  verbose: true
}
```

This distinction matters when defaults exist. The command can know whether the
user explicitly typed an option or received the default.

## Validate A Subset

`parseOptionsSubsetDetailed(...)` validates only options known by one schema and
leaves the rest untouched.

```ts
import { parseOptionsSubsetDetailed } from 'icore';

const parsed = parseOptionsSubsetDetailed({
  format: {
    type: 'string',
    choices: ['table', 'json']
  }
} as const, {
  format: 'json',
  token: 'secret'
});

parsed.options;
parsed.rest;
```

This is useful for staged parsing where bootstrap options and command options
are validated by different layers. It should be used carefully: accepting
unknown rest values is a deliberate boundary decision, not a shortcut around
validation.
