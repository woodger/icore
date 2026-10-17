# Set Up Command Execution And Cleanup

English | [Русский](../ru/guides/terminal-app.md) | [简体中文](../zh/guides/terminal-app.md)

The [README quick start](../../readme.md#quick-start) uses `app.run(...)` when the application already has everything the command needs.

Use the steps in this guide when the application:

- handles global `--help` or `--version` before validating a command;
- chooses a database connection or API client after the command is known;
- creates and closes its own resources, manages progress output, or runs long-running work itself;
- still uses `TerminalApp` to format output and apply its error rules.

The sequence is:

```text
check global --help and --version
→ app.prepare()
→ read the selected command's data
→ create its resources
→ app.commands.run()
→ command output: finish interactive output → app.writePreparedOutput()
  or long-running work: transfer its resources and interactive output
→ close resources
→ app.reportError() when a failure was captured
```

Close progress output and resources before reporting an error, so diagnostics appear only after cleanup. Keep selected resources open through `writePreparedOutput(...)`: terminal output may be an asynchronous stream that still uses them.

## Create Shared Command-Line Objects Once

If every command uses the same types for values supplied by the application, returned values, and command descriptions, create that typed command builder once. Each command still declares its own options, name, aliases, prepared data, and return type:

```ts
import {
  createCommand,
  createOutput,
  createPresentation,
  createTerminalApp,
  isTerminalCommandOutput,
  isUsageError,
  mergeOptionsSchema,
  presentationFormatOptions,
  type TerminalCommandOutput
} from 'icore';

type ResourceName = 'database' | 'remote-api';

type CurrentUserContext = {
  currentUser: string;
};

type LongRunningCommandHandle = {
  completed: Promise<void>;
  close(): Promise<void>;
};

type LongRunningCommandResult = {
  type: 'long-running';
  handle: LongRunningCommandHandle;
};

type CliCommandResult =
  | TerminalCommandOutput
  | LongRunningCommandResult;

function isLongRunningCommandResult(
  result: CliCommandResult
): result is LongRunningCommandResult {
  return typeof result === 'object'
    && result !== null
    && 'type' in result
    && result.type === 'long-running';
}

type CommandMetadata = {
  description: string;
  resources:
    | readonly ResourceName[]
    | ((payload: unknown) => readonly ResourceName[]);
};

const insecureOptions = {
  insecure: {
    type: 'boolean',
    syntax: 'flag'
  }
} as const;

const command = createCommand.withTypes<{
  context: CurrentUserContext;
  result: CliCommandResult;
  metadata: CommandMetadata;
  metadataRequired: true;
}>();

const presentation = createPresentation();

declare function startUserWatcher(
  context: CurrentUserContext
): LongRunningCommandHandle;

const currentUserCommand = command.define({
  path: ['users', 'current'],
  options: mergeOptionsSchema(
    presentationFormatOptions,
    insecureOptions
  ),
  metadata: {
    description: 'Show the current user',
    resources: ['database']
  },
  handle({ context }) {
    return presentation.record({
      user: context.currentUser
    });
  }
});

const watchUsersCommand = command.define({
  path: ['users', 'watch'],
  options: insecureOptions,
  metadata: {
    description: 'Watch the current user',
    resources: ['remote-api']
  },
  handle({ context }) {
    return {
      type: 'long-running',
      handle: startUserWatcher(context)
    } satisfies LongRunningCommandResult;
  }
});

const commands = command.registry([
  currentUserCommand,
  watchUsersCommand
] as const);

const app = createTerminalApp({
  commands,
  presentation,
  output: createOutput(),
  errorPolicy: {
    renderError(error) {
      const errors = error instanceof AggregateError
        ? error.errors
        : [error];

      return errors.map((cause: unknown) => {
        const message = cause instanceof Error
          ? cause.message
          : String(cause);

        return `${message}\n`;
      }).join('');
    },
    resolveExitCode(error) {
      const primaryError = error instanceof AggregateError
        ? error.errors[0]
        : error;

      return isUsageError(primaryError) ? 2 : 1;
    }
  }
});
```

Create `command`, `commands`, `presentation`, `output`, and `app` once when the CLI starts. Do not create database or API resources yet; wait until `app.prepare(...)` identifies the selected command.

The error policy writes every member of an `AggregateError` and uses the first one to choose the exit code. When both operations fail, this example puts the command error first and the cleanup error second, so both messages are shown while the command's exit code is retained.

## Handle Global Help And Version Without Rewriting Arguments

Describe `-h` and `-v` among the options handled before a command is selected. `parseArgv(...)` maps them to `help` and `version`, while `parseOptionsSubsetDetailed(...)` checks only those initial options:

```ts
import {
  parseArgv,
  parseOptionsSubsetDetailed
} from 'icore';

const globalOptionsSchema = {
  help: {
    type: 'boolean',
    alias: 'h',
    syntax: 'flag'
  },
  version: {
    type: 'boolean',
    alias: 'v',
    syntax: 'flag'
  },
  ...insecureOptions
} as const;

function parseGlobalInput(args: readonly string[]) {
  const argv = parseArgv(args, globalOptionsSchema);
  const parsed = parseOptionsSubsetDetailed(
    globalOptionsSchema,
    argv.options
  );

  return {
    positionals: argv.positionals,
    options: parsed.options
  };
}
```

Pass the original `args` to `app.prepare(...)`; do not rebuild arguments from the partial parsing result. The selected command must still receive its own options.

Include each initial option whose type tells the parser whether it consumes the next argument. Declaring `--insecure` as boolean, for example, prevents the parser from treating the next command segment as its value.

## Create Resources, Clean Up, Then Report Errors

The application supplies its own help formatter and an object that closes resources:

```ts
type InvocationScope = {
  context: CurrentUserContext;
  /**
   * Idempotently closes progress or another interactive stdout line.
   * `close()` also calls this when execution fails before final output.
   */
  finishInteractiveOutput(): Promise<void>;
  /** Closes interactive output first, then selected resources. */
  close(): Promise<void>;
};

declare function createInvocationScope(
  resources: readonly ResourceName[],
  options: {
    insecure: boolean;
  }
): Promise<InvocationScope>;

declare function transferLongRunningLifecycle(input: {
  handle: LongRunningCommandHandle;
  scope: InvocationScope;
  signals: readonly ['SIGINT', 'SIGTERM'];
}): void;

declare function renderHelp(
  definitions: typeof commands.definitions,
  positionals: readonly string[]
): string;

declare function renderVersion(): string;
```

`createInvocationScope(...)` should register cleanup immediately after creating each resource. If initialization fails, it should close resources that were already created.

The [help example](practical-cli-patterns.md#build-help-from-command-descriptions) shows how `renderHelp(...)` can read the list of main command names from `commands.definitions` without repeating aliases.

The code below records the stage where the first error occurred, combines it with a cleanup error, and reports after cleanup:

```ts
type Prepared = Awaited<ReturnType<typeof app.prepare>>;
type FailurePhase = 'execute' | 'write' | 'external';

type InvocationFailure = {
  error: unknown;
  phase: FailurePhase;
};

function selectResources(prepared: Prepared): readonly ResourceName[] {
  const selection = prepared.command.metadata.resources;

  return typeof selection === 'function'
    ? selection(prepared.payload)
    : selection;
}

function mergeCleanupFailure(
  primary: InvocationFailure | undefined,
  cleanupError: unknown
): InvocationFailure {
  if (primary === undefined) {
    return {
      error: cleanupError,
      phase: 'external'
    };
  }

  return {
    error: new AggregateError(
      [primary.error, cleanupError],
      'Command execution and cleanup both failed'
    ),
    phase: primary.phase
  };
}

async function reportPreparedFailure(
  failure: InvocationFailure,
  args: readonly string[],
  prepared: Prepared
): Promise<number> {
  if (failure.phase === 'execute') {
    return app.reportError(failure.error, {
      phase: 'execute',
      args,
      prepared
    });
  }

  if (failure.phase === 'write') {
    return app.reportError(failure.error, {
      phase: 'write',
      args,
      prepared
    });
  }

  return app.reportError(failure.error, {
    phase: 'external',
    args,
    prepared
  });
}

async function writeBootstrapOutput(
  render: () => string,
  args: readonly string[]
): Promise<number> {
  try {
    await app.output.write(render());

    return 0;
  }
  catch (error) {
    return app.reportError(error, {
      phase: 'external',
      args
    });
  }
}

async function runCli(args: readonly string[]): Promise<number> {
  let globalInput: ReturnType<typeof parseGlobalInput>;

  try {
    globalInput = parseGlobalInput(args);
  }
  catch (error) {
    return app.reportError(error, {
      phase: 'prepare',
      args
    });
  }

  if (globalInput.options.help === true) {
    return writeBootstrapOutput(
      () => renderHelp(commands.definitions, globalInput.positionals),
      args
    );
  }

  if (globalInput.options.version === true) {
    return writeBootstrapOutput(renderVersion, args);
  }

  let prepared: Prepared;

  try {
    prepared = await app.prepare(args, {
      strict: true
    });
  }
  catch (error) {
    return app.reportError(error, {
      phase: 'prepare',
      args
    });
  }

  let scope: InvocationScope | undefined;
  let failure: InvocationFailure | undefined;
  let phase: FailurePhase = 'external';

  try {
    scope = await createInvocationScope(
      selectResources(prepared),
      {
        insecure: prepared.options.insecure ?? false
      }
    );

    phase = 'execute';
    const result = await app.commands.run(prepared, scope.context);

    if (isLongRunningCommandResult(result)) {
      phase = 'external';
      transferLongRunningLifecycle({
        handle: result.handle,
        scope,
        signals: ['SIGINT', 'SIGTERM']
      });
      scope = undefined;

      return 0;
    }

    phase = 'external';
    await scope.finishInteractiveOutput();

    if (!isTerminalCommandOutput(result)) {
      throw new TypeError('Expected terminal command output');
    }

    phase = 'write';
    await app.writePreparedOutput(prepared, result);
  }
  catch (error) {
    failure = {
      error,
      phase
    };
  }
  finally {
    try {
      await scope?.close();
    }
    catch (cleanupError) {
      failure = mergeCleanupFailure(failure, cleanupError);
    }
  }

  if (failure !== undefined) {
    return reportPreparedFailure(failure, args, prepared);
  }

  return 0;
}

void runCli(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
```

`writePreparedOutput(...)` formats output and writes it. Code outside `TerminalApp` cannot tell which of those steps failed, so this guide reports its rejection as `write`. The built-in `app.run(...)` and `app.runPrepared(...)` paths distinguish `render` from `write` internally.

`CliCommandResult` only sets the broadest result type allowed for the application. A regular command still keeps its specific output result, while `watchUsersCommand` keeps its specific `LongRunningCommandResult`.

`transferLongRunningLifecycle(...)` belongs to the application. It must register signal handling and cleanup for the handle and `scope` before returning. On success, `runCli(...)` clears `scope`, so the invocation's `finally` block does not close it. If transfer throws, it must close the handle without taking responsibility for `scope`; the invocation's `finally` block then closes `scope`. The transferred work must also finish interactive output before later diagnostics are written.

Only values accepted by `isTerminalCommandOutput(...)` reach `writePreparedOutput(...)`. The application keeps responsibility for custom handles, process signals, and resources used by long-running work.

## Choose How To Format Output

Choose one of two output paths:

- When JSON, table, and CSV use the same top-level fields, return an output value created with `createPresentation()`.
- When JSON needs a complete nested report while table or CSV needs selected columns and application-specific formatting, call `renderJson(...)`, `renderTextTable(...)`, or `renderCsv(...)` directly in the application.

See [Format And Write Output](presentation-output.md) for choosing a format and [Create Output Values](presentation-primitives.md) for the direct APIs.

## Use `app.run(...)` When The Command Can Run Immediately

Use `app.run(...)` when everything the command needs is already available and it returns output that `TerminalApp` can write:

```ts
process.exitCode = await app.run(args, context, {
  strict: true
});
```

Use the steps above only when the application creates or closes resources around command execution.
