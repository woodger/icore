# icore

[![npm version](https://img.shields.io/npm/v/icore.svg)](https://www.npmjs.com/package/icore)
[![node](https://img.shields.io/node/v/icore.svg)](https://www.npmjs.com/package/icore)
[![types](https://img.shields.io/npm/types/icore.svg)](https://www.npmjs.com/package/icore)
[![license](https://img.shields.io/npm/l/icore.svg)](LICENSE)

> Русский перевод [английской версии](readme.md). При расхождении актуальной
> считается английская версия.

Небольшой модуль без runtime-зависимостей для механики интерфейсов командной
строки и представления терминального вывода в приложениях на
[Node.js®](https://nodejs.org).

`icore` отвечает за путь от `process.argv` до терминального вывода:

- декларативные схемы опций с выводом типов;
- разрешение многосегментных команд с каноническими aliases;
- раздельные фазы prepare и execute;
- представление в JSON, CSV и текстовых таблицах;
- учитывающие backpressure writers для stdout/stderr и переиспользуемая
  terminal error policy.

API-вызовы, конфигурация, доменное поведение и help конкретного приложения
остаются ответственностью Consumer-а.

## Требования и установка

`icore` требует Node.js `>=16.9.0` и включает декларации TypeScript.

```sh
npm install icore
```

Импортируйте публичные API из `icore`. Deep imports в `dist` или `src` не
являются частью контракта пакета.

## Содержание

- [Быстрый старт](#быстрый-старт)
- [Выбор уровня API](#выбор-уровня-api)
- [Поддерживаемый синтаксис аргументов](#поддерживаемый-синтаксис-аргументов)
- [Обработка ошибок](#обработка-ошибок)
- [Руководства](#руководства)
- [Граница проекта](#граница-проекта)

## Быстрый старт

Создайте команды, поместите их в registry и передайте его в
`createTerminalApp()`:

```ts
import {
  createCommand,
  createTerminalApp
} from 'icore';

const command = createCommand();

const commands = command.registry([
  command.define({
    path: ['hello'],
    options: {
      name: {
        type: 'string',
        default: 'world'
      },
      uppercase: {
        type: 'boolean'
      }
    },
    handle({ options }) {
      const greeting = `Hello, ${options.name}!`;

      return `${options.uppercase ? greeting.toUpperCase() : greeting}\n`;
    }
  })
] as const);

const app = createTerminalApp({ commands });

async function main(args: readonly string[]): Promise<void> {
  process.exitCode = await app.run(args, undefined, {
    strict: true
  });
}

void main(process.argv.slice(2));
```

После компиляции приложения:

```console
$ node dist/cli.js hello
Hello, world!

$ node dist/cli.js hello --name Alice --uppercase
HELLO, ALICE!
```

Схема определяет типы опций handler-а. Обязательные опции и опции со значениями
по умолчанию присутствуют всегда; необязательные возвращаются как
`T | undefined`.

Приложения с общими контрактами context, result и metadata могут один раз
привязать эти типы через `createCommand.withTypes<...>()`. При этом schema,
path, aliases, подготовленный payload и конкретный тип результата каждой
команды продолжают выводиться автоматически. См.
[однократную привязку типов команд приложения](docs/ru/guides/option-schemas.md#однократная-привязка-типов-команд-приложения).

`app.run(...)` — компактный путь. Приложениям, которые обрабатывают глобальные
shortcuts, выбирают runtime-ресурсы после подготовки или самостоятельно
выполняют cleanup, следует использовать
[production lifecycle терминального приложения](docs/ru/guides/terminal-app.md).

`strict: true` отклоняет опции перед command path. Строковый вывод записывается
без изменений, поэтому для построчного вывода добавляйте `\n` в результат
команды. По умолчанию resolution продолжает принимать option-first input.
Bootstrap parsing не переставляет argv, поэтому включайте strict mode только
тогда, когда command-first syntax является частью публичного CLI-контракта
приложения.

## Выбор уровня API

Начинайте с наиболее высокоуровневого API, подходящего приложению:

| Задача | С чего начать | Подробное руководство |
| --- | --- | --- |
| Простое терминальное приложение | `app.run(...)` | [Быстрый старт](#быстрый-старт) |
| Production shortcuts и lifecycle ресурсов | `app.prepare(...)` и `app.commands.run(...)` | [Production Terminal Application](docs/ru/guides/terminal-app.md) |
| Команды и схемы опций | `createCommand()`, `createCommand.withTypes()` или `createCommands()` | [Схемы опций](docs/ru/guides/option-schemas.md) |
| Собственный lifecycle prepare/execute | `commands.prepare()` и `commands.run()` | [Custom Command Flow (English)](docs/guides/custom-command-flow.md) |
| Одна плоская projection для всех форматов | `createPresentation()` | [Presentation And Output (English)](docs/guides/presentation-output.md) |
| Разные JSON, table или CSV projections | `renderJson()`, `renderTextTable()` или `renderCsv()` | [Presentation And Output (English)](docs/guides/presentation-output.md) |
| Явная запись в stdout/stderr | `createOutput()` | [Output Writers (English)](docs/guides/output-writers.md) |
| Примитивы parser-а и resolver-а | `parseArgv()`, `resolveCommand()` и связанные exports | [Primitive Mechanics (English)](docs/guides/readme.md#primitive-mechanics) |

`createTerminalOutput()` и `createTerminalProgress()` остаются доступными как
deprecated compatibility exports ветки `2.x`. Не используйте их в новых
Consumer-ах: interactive output и progress rendering должны принадлежать
приложению. `createOutput()` учитывает backpressure sink-а, но не сериализует
application-owned progress вместе с обычным выводом. Рекомендуемая граница
описана в [application-owned output guide (English)](docs/guides/output-writers.md#application-owned-interactive-output),
а сохранённый [migration guide (English)](docs/guides/interactive-output.md)
описывает legacy-контракт.

Терминальное приложение предоставляет основные lifecycle-операции:

- `app.run(args, context, options?)` выполняет prepare, execute, render и write;
- `app.prepare(args, options?)` проверяет ввод без runtime context;
- `app.runPrepared(prepared, context)` выполняет уже подготовленную команду;
- `app.writePreparedOutput(prepared, output)` записывает полученный caller-ом
  output;
- `app.reportError(error, context?)` применяет настроенную terminal error policy
  и возвращает process-style exit code.

Пустой command registry поддерживается для bootstrap-only `TerminalApp`,
который обрабатывает caller-owned global shortcuts и использует presentation,
output или `reportError(...)` до загрузки полного registry. В нём нет
разрешаемых команд: создавайте отдельное приложение команд и переиспользуйте
тот же output и error policy вместо изменения registry на месте.

Command handlers получают разобранные `options`, metadata присутствия опций в
`provided`, оставшиеся `positionals`, caller-owned `context` и необязательный
подготовленный `payload`.

Поддерживаемые terminal results: строки, асинхронные потоки строк,
presentation results и `undefined`.

Используйте `isTerminalCommandOutput(...)`, чтобы сузить неизвестный
caller-owned result перед передачей в `app.writePreparedOutput(...)`.

Text-table rendering поддерживает plain-text cells. Ширина столбцов вычисляется
через JavaScript string length, поэтому ANSI sequences, emoji, combining
characters, tabs и full-width Unicode могут выравниваться неправильно.

```text
argv → resolve → validate/prepare → execute → render → stdout/stderr
```

Точный список публичных exports находится в
[`src/index.ts`](https://github.com/woodger/icore/blob/main/src/index.ts) и в
декларациях TypeScript, включённых в пакет. Consumer-ы импортируют их из корня
пакета; внутренние module paths не экспортируются.

## Поддерживаемый синтаксис аргументов

Поддерживаемый синтаксис намеренно сделан небольшим и предсказуемым:

| Форма | Пример | Примечание |
| --- | --- | --- |
| Длинная опция с отдельным значением | `--name Alice` | String и number options поглощают значение |
| Длинная опция с присоединённым значением | `--name=Alice` | Эквивалентна отдельной форме |
| Boolean flag | `--verbose` | Возвращает `true` |
| Boolean negation | `--no-cache` | Поддерживается для известных boolean options, кроме `syntax: 'flag'` |
| Короткий alias | `-v`, `-n Alice` | Должен быть объявлен в схеме как одна ASCII-буква |
| Терминатор опций | `--` | Каждый следующий token становится positional |

Имена опций точны: `icore` не преобразует `camelCase` в `kebab-case`.
Явные boolean values вроде `--verbose=true`, присоединённые короткие значения
вроде `-nAlice` и сгруппированные aliases вроде `-abc` не поддерживаются.

Parsing examples, edge cases, обработка duplicates и контракт терминатора
описаны в [CLI Argument Syntax (English)](docs/guides/cli-argument-syntax.md).

## Обработка ошибок

Ошибки CLI parsing, validation, resolution и definitions представлены как
`IcoreError`. Он расширяет `Error` следующими полями:

- стабильный машиночитаемый `code`;
- категория `usage` или `definition`;
- обязательные `details`, специфичные для кода.

Используйте `isIcoreError(...)` вместо ручного приведения details. Передача кода
в guard сужает соответствующую структуру details:

```ts
import {
  createTerminalApp,
  isIcoreError,
  isUsageError
} from 'icore';

const help = 'Usage: cli hello [--name value]';

const app = createTerminalApp({
  commands,
  errorPolicy: {
    renderError(error) {
      const message = error instanceof Error
        ? error.message
        : String(error);

      if (isIcoreError(error, 'UNKNOWN_COMMAND')) {
        return `${message}\n\n${help}\n`;
      }

      return `${message}\n`;
    },
    resolveExitCode(error) {
      return isUsageError(error) ? 2 : 1;
    }
  }
});
```

Внутри ветки `UNKNOWN_COMMAND` такие поля, как `error.details.command` и
`error.details.positionals`, строго типизированы. `IcoreErrorDetailsMap` —
публичный источник истины для каждого кода. Прямые вызовы
`new IcoreError(...)` должны передавать третий аргумент, соответствующий
выбранному коду.

Application-owned semantic validation может выбрасывать `CliUsageError`, не
присваивая ошибке один из framework-owned кодов `IcoreError`:

```ts
import { CliUsageError } from 'icore';

throw new CliUsageError(
  "Expected '--from' to be earlier than or equal to '--to'"
);
```

`isUsageError(...)` распознаёт и `CliUsageError`, и экземпляры `IcoreError` с
категорией `usage`. Rendering, help text и выбор exit code остаются политикой
приложения.

Оба guard-а распознают совместимые branded errors, созданные другой физической
копией `icore` в том же JavaScript realm. Это не превращает ошибки,
сериализованные через JSON, IPC или worker boundaries, обратно в экземпляры
классов.

Без custom policy терминальные приложения записывают
`Error.message + "\n"` (или `String(error) + "\n"` для других выброшенных
значений) и возвращают exit code `1`. Application-specific help остаётся
политикой приложения.

Custom lifecycle может вызвать `app.reportError(...)`, чтобы переиспользовать
те же rendering и exit-code policy. Полный flow фаз prepare, execute, write и
external приведён в
[production lifecycle](docs/ru/guides/terminal-app.md#владение-ресурсами-очисткой-и-порядком-ошибок).

## Руководства

[Русский индекс руководств](docs/ru/guides/readme.md) ведёт от обычного
терминального приложения к низкоуровневой механике. Начать стоит с:

- [Production Terminal Application](docs/ru/guides/terminal-app.md) — global
  shortcuts, preparation, выбор ресурсов по metadata, execution, output,
  cleanup и переиспользуемая обработка ошибок;
- [Схемы опций](docs/ru/guides/option-schemas.md) — strings, booleans, numbers,
  choices, defaults, aliases и выведенные типы;
- [Практические CLI-паттерны](docs/ru/guides/practical-cli-patterns.md) —
  help/version shortcuts, общие options и compatibility aliases;
- [Command Resolution (English)](docs/guides/command-resolution.md) — registry,
  canonical aliases, matched paths, explicit resolution и command-name guards;
- [Two-Phase Primitives (English)](docs/guides/two-phase-primitives.md) —
  preparation, payloads, execution и metadata предоставленных опций;
- [Presentation Primitives (English)](docs/guides/presentation-primitives.md) —
  text, record, table, CSV, JSON и direct renderers.

История релизов находится в [CHANGELOG.md](CHANGELOG.md), а направляющие решения
— в [docs/roadmap.md](docs/roadmap.md). Эти документы ведутся на английском.

## Граница проекта

`icore` — небольшой модуль терминальной механики. Он отвечает за generic
behavior: validation опций, command resolution, типизированный ввод handler-а,
presentation rendering, error contracts и доставку в stdout/stderr.

Он не отвечает за mapping DTO приложения, API calls, загрузку конфигурации,
domain-specific validation, lifecycle resources или содержимое help. Эти
обязанности остаются в Consumer-е. Interactive line rendering и progress
reporting также принадлежат приложению; legacy compatibility exports не должны
становиться основой нового кода.

Проект распространяется по [лицензии MIT](LICENSE).
