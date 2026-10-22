# Prepare And Run Commands In Two Steps

The usual two-step flow is `commands.prepare(...)` followed by `commands.run(...)`. Use the direct functions below when application code needs the same steps without using the whole commands object.

Start with the commands object. Use the direct functions only when application code needs to control the order of preparation, execution, output, or cleanup.

The snippets below use this setup:

```ts
// Define a command and the data the application supplies when it runs.
import { createCommand, createTerminalApp, isTerminalCommandOutput } from 'icore';

type WorkspaceContext = {
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
    // Normalize input before the application creates services.
    return {
      jobId: options['job-id'].trim()
    };
  },
  handle({ payload, context }: {
    payload: { jobId: string };
    context: WorkspaceContext;
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

`app.prepare(...)` validates command input before the application creates values that the selected command needs.

```ts
// Validate input and read details of the selected command.
const prepared = await app.prepare([
  'jobs',
  'run',
  '--job-id',
  'job-42'
], {
  strict: true
});

prepared.name;
prepared.path;
prepared.matchedPath;
prepared.options;
prepared.provided;
```

This is useful when the selected command determines which connections or API clients to create. If preparation fails, the application can report an argument error without opening connections or starting background work.

`name` and `path` identify the main command. When a definition has alternate names, `matchedPath` records the name that selected the command.

## Run Prepared Through A Terminal App

`app.runPrepared(...)` keeps output formatting, standard-output and standard-error writing, and exit-code handling in `createTerminalApp()` after the application creates the values needed by the selected command.

```ts
// Create application data after preparation, then run the command.
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

The application creates and closes resources. The terminal app only runs the prepared command and applies the same output behavior as `app.run(...)`.

`runPrepared(...)` reports command and output errors before returning, so this example runs cleanup after error reporting. When progress or resources must close before diagnostics, use [Create Resources, Clean Up, Then Report Errors](terminal-app.md#create-resources-clean-up-then-report-errors), which executes through `app.commands.run(...)` and reports captured failures after cleanup.

## Write Prepared Output

Use `app.writePreparedOutput(...)` when the application needs to inspect the raw command result before terminal output is written.

```ts
// Run the command yourself and confirm that its result can be written.
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

  if (!isTerminalCommandOutput(result)) {
    throw new Error('Expected terminal command output');
  }

  await app.writePreparedOutput(prepared, result);
}
finally {
  await cleanup(context);
}
```

Only terminal output belongs here: ready text, streaming text, output values, or no output. Strings are written exactly as provided; include `\n` when line output is desired. If the result is still `unknown`, check it with `isTerminalCommandOutput(...)` before writing. Long-running tasks need an explicit transfer of the values and cleanup work they use; use [Create Resources, Clean Up, Then Report Errors](terminal-app.md#create-resources-clean-up-then-report-errors) for that case.

The guard checks the stream's iterable shape; each chunk is validated as a string during writing. A non-string chunk rejects `writePreparedOutput(...)`. Built-in terminal execution reports that failure in the `write` phase.

Use `app.tryWritePreparedOutput(...)` when diagnostics must wait for cleanup and retain the original output error and its phase. The [caller-owned lifecycle example](terminal-app.md#create-resources-clean-up-then-report-errors) shows how to combine an output failure with a cleanup failure before reporting.

## Prepare From A Command Registry

`prepareCommandFromArgs(...)` is the direct form of `commands.prepare(...)`.

```ts
// Prepare a command from a registry without a commands object.
import { prepareCommandFromArgs, type CommandPayload } from 'icore';

type Payload = CommandPayload<typeof runJobCommand>;

const prepared = await prepareCommandFromArgs(commands.registry, [
  'jobs',
  'run',
  '--job-id',
  'job-42'
], {
  strict: true
});
```

Use this when code has a registry but not a `commands` object.

## Run A Prepared Command

`runPreparedCommand(...)` executes a command that was already resolved and validated.

```ts
// Infer the command's input and result types before running it.
import { runPreparedCommand, type CommandContext, type CommandResult } from 'icore';

type Context = CommandContext<typeof runJobCommand>;
type Result = CommandResult<typeof runJobCommand>;

const context: Context = {
  workspace: 'local'
};

const result: Result = await runPreparedCommand(prepared, context);
```

Use this when creating values for a command has side effects. Prepare first, then create exactly what the selected command needs.

## Narrow Prepared Commands

`isPreparedCommandName(...)` checks a prepared command's name.

```ts
// Check the command name before reading command-specific options.
import { isPreparedCommandName } from 'icore';

if (isPreparedCommandName(prepared, 'jobs run')) {
  prepared.options['job-id'];
}
```

Use this when several commands share preparation but need different values from the application. The function checks the prepared command name, not its other descriptive data.

After this check, `commands.run(...)` and `app.runPrepared(...)` require the values for that command. `commands.run(...)` also preserves its specific result type. Check first when commands need different values from the application.

## Run From A Registry

`runCommandFromRegistry(...)` is the direct form of `commands.runFromArgs(...)`.

```ts
// Validate, prepare, and run a registry command in one call.
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

This combines validation, preparation, and execution in one call. Use it when application code does not need a separate preparation step.

## Run One Command Without A Registry

Use `command.run(...)` or standalone `runCommand(...)` for focused execution of one command.

```ts
// Compare the method and standalone forms for one known command.
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

This is useful for tests and small tools. It does not select a command from a registry, so it does not suit a larger CLI.

## Read Which Options The User Provided

`parseOptionsDetailed(...)` returns parsed values and a map that records which options the user typed.

```ts
// Read parsed options and learn which options the user supplied.
import { parseOptionsDetailed, type InferProvidedOptions } from 'icore';

type Provided = InferProvidedOptions<typeof schema>;

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
```

The parsed options are:

```text
{
  format: 'table',
  verbose: true
}
```

The map of options typed by the user is:

```text
{
  format: false,
  verbose: true
}
```

This matters when options have default values. The command can distinguish a user-provided option from a default.

## Validate A Subset

`parseOptionsSubsetDetailed(...)` validates only options in one option definition and leaves the rest untouched.

```ts
// Validate only `format` and leave other values for later code.
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

This is useful when initial options and command options are validated separately. Accepting unknown values in `rest` is deliberate: later code must validate them.
