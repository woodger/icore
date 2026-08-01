# Production-терминальное приложение

> Русский перевод [английской версии](../../guides/terminal-app.md). При
> расхождении актуальной считается английская версия.

В [быстром старте README](../../../readme.ru.md#быстрый-старт) используется
`app.run(...)`, потому что это наиболее понятная точка входа для небольшого CLI
с уже доступным context.

Используйте явный lifecycle из этого руководства, когда приложение:

- обрабатывает глобальные shortcuts help или version до command validation;
- выбирает runtime-ресурсы по metadata или payload подготовленной команды;
- самостоятельно владеет cleanup ресурсов, progress или долгоживущими handles;
- при этом использует rendering, output и error policy из `TerminalApp`.

Production flow выглядит так:

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

Cleanup выполняется до error reporting, чтобы progress и resources были
завершены до записи diagnostics в stderr. Runtime-ресурсы остаются открытыми
до окончания `writePreparedOutput(...)`, потому что terminal output может быть
асинхронным потоком, который всё ещё от них зависит.

## Однократная композиция команд и terminal services

Один раз привяжите общие application contracts, сохранив inference конкретных
schema, path, payload, aliases и result каждой команды:

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

Создавайте `command`, `commands`, `presentation`, `output` и `app` один раз на
один CLI invocation. Экземпляры ресурсов не входят в эту композицию; создавайте
их только после того, как `app.prepare(...)` определит выбранную команду.

## Parsing глобальных shortcuts без изменения argv

Объявите короткие aliases в bootstrap option schema. `parseArgv(...)`
сопоставит `-h` и `-v` с каноническими именами, а
`parseOptionsSubsetDetailed(...)` проверит только options, принадлежащие
bootstrap:

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

Передавайте в `app.prepare(...)` исходный `args`; не собирайте argv заново из
subset result. Command-specific options останутся доступны schema выбранной
команды.

Включайте каждую bootstrap option, тип которой влияет на владение tokens.
Например, объявление boolean `--insecure` не позволит shortcut parsing принять
следующий сегмент команды за её значение.

## Владение ресурсами, очисткой и порядком ошибок

Приложение предоставляет собственный help renderer и resource scope:

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

`createInvocationScope(...)` должен регистрировать cleanup сразу после
создания каждого ресурса и откатывать уже созданные ресурсы, если initialization
завершилась ошибкой.

[Recipe help на основе metadata](practical-cli-patterns.md#построение-help-по-command-metadata)
показывает, как `renderHelp(...)` может получить канонический command inventory
из `commands.definitions`, не дублируя aliases.

Runner сохраняет phase основной ошибки, объединяет её с cleanup failure и
вызывает reporting только после cleanup:

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

`writePreparedOutput(...)` выполняет и rendering, и запись. Внешний caller не
может различить эти failures, поэтому recipe сообщает о rejection как о
`write`. Встроенные пути `app.run(...)` и `app.runPrepared(...)` способны
различать `render` и `write` внутри.

Привязанный `CliCommandResult` является верхней границей. Обычная команда всё
равно сохраняет свой конкретный presentation result, а `watchUsersCommand` —
конкретный `LongRunningCommandResult`.

`transferLongRunningLifecycle(...)` относится к политике приложения. Функция
должна возвращать управление только после регистрации signal handling и
cleanup для handle и scope. При успехе runner очищает `scope`, поэтому
invocation `finally` больше им не владеет. Если transfer выбросит ошибку, он
должен закрыть handle, не принимая владение scope; затем invocation `finally`
закроет scope. Переданный lifecycle также отвечает за завершение interactive
output до записи последующих diagnostics.

До `writePreparedOutput(...)` доходят только results, принятые
`isTerminalCommandOutput(...)`. Так custom handles, process signals и владение
долгоживущими ресурсами остаются за границей terminal app.

## Выбор владельца presentation

Используйте один из двух путей presentation:

- Когда одна плоская projection подходит для JSON, table и CSV, возвращайте
  view из `createPresentation()`.
- Когда JSON требует полный вложенный report, а table или CSV — выбранные
  columns и domain formatting, выбирайте `renderJson(...)`,
  `renderTextTable(...)` или `renderCsv(...)` непосредственно в Consumer-е.

Формат выбирается по [Presentation And Output (English)](../../guides/presentation-output.md),
а низкоуровневые контракты описаны в
[Presentation Primitives (English)](../../guides/presentation-primitives.md).

## Компактный путь для простых приложений

Когда context уже существует, а handlers возвращают поддерживаемый terminal
output, используйте компактный путь:

```ts
process.exitCode = await app.run(args, context, {
  strict: true
});
```

Явный recipe предназначен для application-owned lifecycle. Это не обязательная
церемония для каждого CLI.
