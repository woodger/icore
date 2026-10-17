# icore

[English](../../readme.md) | Русский | [简体中文](../zh/readme.md)

[![npm version](https://img.shields.io/npm/v/icore.svg)](https://www.npmjs.com/package/icore)
[![node](https://img.shields.io/node/v/icore.svg)](https://www.npmjs.com/package/icore)
[![types](https://img.shields.io/npm/types/icore.svg)](https://www.npmjs.com/package/icore)
[![license](https://img.shields.io/npm/l/icore.svg)](../../LICENSE)

> Русский перевод английской версии. При расхождении актуальной считается английская версия.

`icore` — библиотека TypeScript для создания интерфейсов командной строки в приложениях на [Node.js®](https://nodejs.org/). Она помогает описывать команды, разбирать аргументы, выполнять выбранную команду и выводить текст, таблицы, JSON или CSV.

Библиотека берёт на себя общую механику командной строки. API-вызовы, конфигурация, правила предметной области, текст справки и интерактивное поведение терминала остаются в приложении.

## Требования и установка

`icore` требует Node.js `>=16.9.0` и содержит декларации TypeScript.

```sh
npm install icore
```

## Быстрый старт

Создайте команды, соберите их в [реестр команд](../examples/command-resolution.md#create-a-commands-object-from-existing-definitions) и передайте его в `createTerminalApp()`:

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

После сборки приложения:

```console
$ node dist/cli.js hello
Hello, world!

$ node dist/cli.js hello --name Alice --uppercase
HELLO, ALICE!
```

Объект `options` описывает аргументы после `hello`. Функция `handle` получает их разобранные значения.

`app.run(...)` проверяет аргументы, выполняет выбранную команду, форматирует её результат и записывает его в терминал. При `strict: true` сначала указываются имя команды и подкоманды, а затем опции: `users get --id 42`.

Если приложение само обрабатывает глобальные `--help` или `--version`, создаёт ресурсы после выбора команды или должно закрывать их вокруг её выполнения, используйте [настройку запуска команды и очистки ресурсов](examples/terminal-app.md).

## Выбор API

| Что нужно приложению | С чего начать | Пример |
| --- | --- | --- |
| Сразу выполнить команду | `app.run(...)` | [Быстрый старт](#быстрый-старт) |
| Обработать глобальные опции или создать и закрыть ресурсы | `app.prepare(...)` и `app.commands.run(...)` | [Настройка запуска команды и очистки ресурсов](examples/terminal-app.md) |
| Описать команды и их опции | `createCommand()`, `createCommand.withTypes()` или `createCommands()` | [Описание опций команд](examples/option-schemas.md) |
| Подготовить команду до создания сервисов приложения | `commands.prepare()` и `commands.run()` | [Подготовка и выполнение команды вручную](../examples/custom-command-flow.md) |
| Использовать одни и те же поля в JSON, таблице и CSV | `createPresentation()` | [Форматирование и запись вывода](../examples/presentation-output.md) |
| Подготовить отдельные данные для JSON, таблицы и CSV | `renderJson()`, `renderTextTable()` или `renderCsv()` | [Форматирование и запись вывода](../examples/presentation-output.md) |
| Явно записать данные в стандартный вывод или поток ошибок | `createOutput()` | [Запись вывода](../examples/output-writers.md) |
| Разобрать аргументы или найти команду напрямую | `parseArgv()`, `resolveCommand()` и связанные экспорты | [Прямые API](../examples/readme.md#direct-apis) |

## Ошибки

`IcoreError` описывает неверные аргументы командной строки и неверные описания команд. Используйте `isIcoreError(...)`, чтобы проверить такую ошибку, и `isUsageError(...)`, чтобы распознать ошибку пользовательского ввода. Для правил ввода конкретного приложения выбрасывайте `CliUsageError`. Актуальные типы ошибок и коды описаны в [исходных файлах ошибок](https://github.com/woodger/icore/tree/main/src/errors).

## Примеры

Часть подробных примеров пока доступна только на английском; их названия ниже переведены для навигации.

- [Настройка запуска команды и очистки ресурсов](examples/terminal-app.md) — глобальные опции, создание и очистка ресурсов, вывод и обработка ошибок.
- [Описание опций команд](examples/option-schemas.md) — строки, логические и числовые значения, допустимые значения, значения по умолчанию, псевдонимы и вывод типов TypeScript.
- [Распространённые приёмы для CLI](examples/practical-cli-patterns.md) — команды справки и версии, общие опции и устаревшие псевдонимы.
- [Синтаксис аргументов](../examples/cli-argument-syntax.md) — допустимые и недопустимые формы аргументов командной строки.
- [Подготовка и выполнение команды вручную](../examples/custom-command-flow.md) — подготовка и выполнение команды без терминального приложения.
- [Форматирование и запись вывода](../examples/presentation-output.md) — преобразование результатов и запись в стандартный вывод или поток ошибок.
- [Прямые API](../examples/readme.md#direct-apis) — разрешение команд, вывод и представление данных без оболочки терминального приложения.

История релизов находится в [CHANGELOG.md](../../CHANGELOG.md), а проектные решения — в [docs/roadmap.md](../roadmap.md).

## Что делает `icore`

`icore` выполняет общую работу командной строки: проверяет опции, выбирает команду, передаёт типизированные значения функции команды, форматирует вывод, даёт точки для обработки ошибок и записывает данные в стандартный вывод или поток ошибок.

Приложение само выполняет API-вызовы, загружает конфигурацию, проверяет правила предметной области, создаёт и закрывает ресурсы, формирует текст справки, рисует индикаторы прогресса и управляет другим интерактивным выводом.

Проект распространяется по [лицензии MIT](../../LICENSE).
