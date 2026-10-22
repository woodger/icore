# Настройка запуска команды и очистки ресурсов

[English](../../examples/terminal-app.md) | Русский | [简体中文](../../zh/examples/terminal-app.md)

> Русский перевод английской версии. При расхождении актуальной считается английская версия.

В [быстром старте README](../readme.md#быстрый-старт) используется `app.run(...)`, когда у приложения уже есть всё необходимое команде.

Используйте шаги из этого примера, когда приложение:

- обрабатывает глобальные `--help` или `--version` до проверки команды;
- выбирает подключение к базе данных или API-клиент после выбора команды;
- само создаёт и закрывает свои ресурсы, управляет индикатором прогресса или долгоживущими задачами;
- при этом использует `TerminalApp` для форматирования вывода и правил обработки ошибок.

Последовательность действий:

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

Закрывайте индикатор прогресса и ресурсы до сообщения об ошибке, чтобы диагностика появлялась только после очистки. Не закрывайте выбранные ресурсы до окончания `writePreparedOutput(...)`: вывод может быть асинхронным потоком, который всё ещё их использует.

## Один типизированный конструктор команд

`createCommand.withTypes<...>()` задаёт общие типы для всех команд. Создайте его один раз, если у команд совпадают:

- `context` — данные, которые приложение передаёт функции команды;
- `result` — допустимый набор значений, которые эта функция может вернуть;
- `metadata` — постоянная информация о команде, например её описание.

Каждая команда всё равно сама задаёт имя, опции, псевдонимы, данные из `prepare` и конкретный тип результата:

```ts
// Опишите команды, вывод и обработку ошибок для CLI.
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

// Команда с длительным выполнением возвращает объект, через который приложение управляет этой работой.
type LongRunningCommandHandle = {
  completed: Promise<void>;
  close(): Promise<void>;
};

type LongRunningCommandResult = {
  handle: LongRunningCommandHandle;
};

type CliCommandResult =
  | TerminalCommandOutput
  | LongRunningCommandResult;

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

// Каждая команда получает текущего пользователя, возвращает вывод CLI и задаёт описание и ресурсы.
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

// Эта команда возвращает запись для вывода в терминал.
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

// Эта команда запускает работу, которая продолжается после возврата.
const watchUsersCommand = command.define({
  path: ['users', 'watch'],
  options: insecureOptions,
  metadata: {
    description: 'Watch the current user',
    resources: ['remote-api']
  },
  handle({ context }) {
    return {
      handle: startUserWatcher(context)
    } satisfies LongRunningCommandResult;
  }
});

const commands = command.registry([
  currentUserCommand,
  watchUsersCommand
] as const);

// Терминальное приложение форматирует вывод и единообразно сообщает об ошибках.
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

Создавайте `command`, `commands`, `presentation`, `output` и `app` один раз при запуске CLI. Не создавайте подключение к базе данных или API-клиент заранее: дождитесь, пока `app.prepare(...)` определит выбранную команду.

Правила обработки ошибок выводят каждый элемент `AggregateError` и выбирают код выхода по первому. Если завершаются ошибкой и команда, и очистка, этот пример помещает ошибку команды первой, а ошибку очистки — второй: оба сообщения видны, а код выхода команды сохраняется.

## Обработка глобальных справки и версии без изменения аргументов

Опишите `-h` и `-v` среди опций, которые обрабатываются до выбора команды. `parseArgv(...)` сопоставит их с `help` и `version`, а `parseOptionsSubsetDetailed(...)` проверит только эти начальные опции:

```ts
// Разберите глобальные флаги, не поглощая опции выбранной команды.
import { parseArgv, parseOptionsSubsetDetailed } from 'icore';

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

Передавайте в `app.prepare(...)` исходный `args`; не собирайте аргументы заново из результата частичного разбора. Выбранная команда всё равно должна получить свои опции.

Включайте каждую начальную опцию, тип которой сообщает разборщику, поглощает ли она следующий аргумент. Например, логическая опция `--insecure` не позволит принять следующий сегмент команды за её значение.

## Создание ресурсов, очистка и сообщение об ошибке

Приложение предоставляет собственное форматирование справки и объект, который закрывает ресурсы:

```ts
// Оставьте форматирование справки и очистку ресурсов в коде приложения.
type InvocationScope = {
  context: CurrentUserContext;
  /**
   * Завершает индикатор прогресса или другую интерактивную строку stdout; повторный вызов безопасен.
   * `close()` также вызывает этот метод, если выполнение завершается ошибкой до итогового вывода.
   */
  finishInteractiveOutput(): Promise<void>;
  /** Сначала завершает интерактивный вывод, затем закрывает выбранные ресурсы. */
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

`createInvocationScope(...)` должен регистрировать закрытие сразу после создания каждого ресурса. Если инициализация завершится ошибкой, он должен закрыть уже созданные ресурсы.

[Пример построения справки](practical-cli-patterns.md#построение-справки-из-описаний-команд) показывает, как `renderHelp(...)` получает список основных имён команд из `commands.definitions`, не повторяя псевдонимы.

Следующий код запоминает этап первой ошибки, объединяет её с ошибкой очистки и сообщает о них после очистки:

```ts
// Запоминайте ошибку, пока не будут закрыты все ресурсы.
type Prepared = Awaited<ReturnType<typeof app.prepare>>;
type FailurePhase = 'execute' | 'write' | 'external';

type InvocationFailure = {
  error: unknown;
  phase: FailurePhase;
};

// Используйте список ресурсов выбранной команды.
function selectResources(prepared: Prepared): readonly ResourceName[] {
  const selection = prepared.command.metadata.resources;

  return typeof selection === 'function'
    ? selection(prepared.payload)
    : selection;
}

// Сохраняйте первую ошибку и добавляйте ошибку очистки, если произошли обе.
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

// Выведите ошибку после очистки и укажите шаг, на котором она произошла.
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

// Выведите глобальную справку или версию с той же обработкой ошибок.
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

// Обработайте глобальные флаги до подготовки выбранной команды.
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

  // Не закрывайте выбранные ресурсы, пока вывод не записан или работа не передана.
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

    // Длительная работа берёт очистку на себя до возврата этой функции.
    if (!isTerminalCommandOutput(result)) {
      phase = 'external';
      transferLongRunningLifecycle({
        handle: result.handle,
        scope,
        signals: ['SIGINT', 'SIGTERM']
      });
      scope = undefined;

      return 0;
    }

    // Завершите интерактивную строку до записи обычного вывода команды.
    phase = 'external';
    await scope.finishInteractiveOutput();

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
    // Закрывайте ресурсы даже при ошибке подготовки, выполнения или записи.
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

`writePreparedOutput(...)` форматирует вывод и записывает его. Код вне `TerminalApp` не может определить, на каком из этих шагов произошла ошибка, поэтому этот пример сообщает о ней как о `write`. Встроенные пути `app.run(...)` и `app.runPrepared(...)` различают `render` и `write` внутри.

`CliCommandResult` задаёт только самый широкий допустимый тип результата для приложения. Обычная команда сохраняет свой конкретный результат вывода, а `watchUsersCommand` — конкретный `LongRunningCommandResult`.

`transferLongRunningLifecycle(...)` относится к коду приложения. Функция должна зарегистрировать обработку сигналов и очистку для задачи и `scope` до возврата управления. При успехе `runCli(...)` очищает `scope`, поэтому блок `finally` вызова его не закрывает. Если передача завершается ошибкой, функция должна закрыть задачу, но не брать на себя `scope`; его затем закроет блок `finally` вызова. Переданная работа также должна завершить интерактивный вывод до записи последующей диагностики.

До `writePreparedOutput(...)` доходят только значения, принятые `isTerminalCommandOutput(...)`. Приложение само отвечает за особые задачи, сигналы процесса и ресурсы долгоживущей работы.

## Выбор способа форматирования вывода

Выберите один из двух способов подготовки вывода:

- Когда JSON, таблица и CSV используют одни и те же поля верхнего уровня, возвращайте значение вывода, созданное через `createPresentation()`.
- Когда JSON требует полный вложенный отчёт, а таблица или CSV — выбранные столбцы и форматирование приложения, вызывайте `renderJson(...)`, `renderTextTable(...)` или `renderCsv(...)` прямо в приложении.

Выбор формата описан в [Форматировании и записи вывода](../../examples/presentation-output.md), а прямые API — в [Подготовке данных для вывода](../../examples/presentation-primitives.md).

## Используйте `app.run(...)`, когда команду можно запустить сразу

Используйте `app.run(...)`, когда всё нужное команде уже готово, а она возвращает вывод, который может записать `TerminalApp`:

```ts
// Используйте API с одним вызовом, когда данные приложения уже доступны.
process.exitCode = await app.run(args, context, {
  strict: true
});
```

Используйте описанные выше шаги, только когда приложение само создаёт или закрывает ресурсы вокруг выполнения команды.
