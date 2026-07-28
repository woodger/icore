# Production Terminal Application

The [README quick start](../readme.md#quick-start) uses `app.run(...)` because
that is the clearest entrypoint for a small CLI with an already available
context.

Use the explicit lifecycle in this guide when the application:

- handles global help or version shortcuts before command validation;
- chooses runtime resources from prepared command metadata or payload;
- owns resource cleanup, progress, or long-running handles;
- still wants `TerminalApp` rendering, output, and error policy.

The production route is:

```text
parse global shortcuts
→ app.prepare()
→ inspect metadata and payload
→ create selected resources
→ app.commands.run()
→ terminal result: finish interactive output → app.writePreparedOutput()
  or long-running result: transfer handle, scope, and interactive output
→ cleanup
→ app.reportError() when a failure was captured
```

Cleanup precedes error reporting so progress and resources are settled before
stderr diagnostics are written. Runtime resources remain open through
`writePreparedOutput(...)` because terminal output may be an async stream that
still depends on them.

## Compose Commands And Terminal Services Once

Bind shared application contracts once and keep command-specific schema, path,
payload, aliases, and result inference:

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

type AppContext = {
  currentUser: string;
};

type LongRunningCommandHandle = {
  completed: Promise<void>;
  close(): Promise<void>;
};

type LongRunningCommandResult = {
  kind: 'long-running';
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
    && 'kind' in result
    && result.kind === 'long-running';
}

type CommandMetadata = {
  description: string;
  resources:
    | readonly ResourceName[]
    | ((payload: unknown) => readonly ResourceName[]);
};

const runtimeOptions = {
  insecure: {
    type: 'boolean',
    syntax: 'flag'
  }
} as const;

const command = createCommand.withTypes<{
  context: AppContext;
  result: CliCommandResult;
  metadata: CommandMetadata;
  metadataRequired: true;
}>();

const presentation = createPresentation();

declare function startUserWatcher(
  context: AppContext
): LongRunningCommandHandle;

const currentUserCommand = command.define({
  path: ['users', 'current'],
  options: mergeOptionsSchema(
    presentationFormatOptions,
    runtimeOptions
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
  options: runtimeOptions,
  metadata: {
    description: 'Watch the current user',
    resources: ['remote-api']
  },
  handle({ context }) {
    return {
      kind: 'long-running',
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
      const message = error instanceof Error
        ? error.message
        : String(error);

      return `${message}\n`;
    },
    resolveExitCode(error) {
      return isUsageError(error) ? 2 : 1;
    }
  }
});
```

Create `command`, `commands`, `presentation`, `output`, and `app` once for one
CLI invocation. Resource instances are not part of this composition; create
them only after `app.prepare(...)` identifies the selected command.

## Parse Global Shortcuts Without Rewriting Argv

Declare short aliases in the bootstrap option schema. `parseArgv(...)` maps
`-h` and `-v` to their canonical names, while
`parseOptionsSubsetDetailed(...)` validates only bootstrap-owned options:

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
  ...runtimeOptions
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

Pass the original `args` to `app.prepare(...)`; do not rebuild argv from the
subset result. Command-specific options remain available to the selected
command schema.

Include every bootstrap option whose type affects token ownership. For example,
declaring boolean `--insecure` prevents a following command segment from being
mistaken for its value during shortcut parsing.

## Own Resources, Cleanup, And Error Ordering

The application supplies its own help renderer and resource scope:

```ts
type InvocationScope = {
  context: AppContext;
  /**
   * Idempotently closes progress or another interactive stdout line.
   * `close()` also calls this when execution fails before final output.
   */
  finishInteractiveOutput(): Promise<void>;
  /** Closes interactive output first, then runtime resources. */
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

`createInvocationScope(...)` should register cleanup immediately after each
resource is created and roll back partially created resources if initialization
fails.

The [metadata-driven help recipe](practical-cli-patterns.md#build-help-from-command-metadata)
shows how `renderHelp(...)` can derive its canonical command inventory from
`commands.definitions` without duplicating aliases.

The runner keeps the phase of the primary failure, merges a cleanup failure,
and reports only after cleanup:

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

`writePreparedOutput(...)` performs both rendering and writing. An external
caller cannot distinguish those failures, so this recipe reports its rejection
as `write`. The built-in `app.run(...)` and `app.runPrepared(...)` paths can
distinguish `render` from `write` internally.

The bound `CliCommandResult` is an upper bound. The regular command still
retains its concrete presentation result, while `watchUsersCommand` retains its
concrete `LongRunningCommandResult`.

`transferLongRunningLifecycle(...)` is application policy. It must return only
after registering signal handling and cleanup for both the handle and scope.
On success the runner clears `scope`, so the invocation `finally` no longer
owns it. If transfer throws, it must close the handle without taking scope
ownership; the invocation `finally` then closes the scope. The transferred
lifecycle also owns finishing interactive output before writing later
diagnostics.

Only results accepted by `isTerminalCommandOutput(...)` reach
`writePreparedOutput(...)`. This keeps custom handles, process signals, and
long-running resource ownership outside the terminal app boundary.

## Choose Presentation Ownership

Use one of two presentation routes:

- When one flat projection is correct for JSON, table, and CSV, return a view
  from `createPresentation()`.
- When JSON needs a complete nested report while table or CSV needs selected
  columns and domain formatting, select `renderJson(...)`,
  `renderTextTable(...)`, or `renderCsv(...)` directly in the Consumer.

See [Presentation And Output](presentation-output.md) for the format decision
and [Presentation Primitives](presentation-primitives.md) for the lower-level
contracts.

## Keep The Compact Path For Simple Applications

When context already exists and handlers return terminal-supported output,
prefer the compact path:

```ts
process.exitCode = await app.run(args, context, {
  strict: true
});
```

The explicit recipe is for application-owned lifecycle work. It is not required
ceremony for every CLI.
