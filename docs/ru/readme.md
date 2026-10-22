# icore

[English](../../readme.md) | Русский | [简体中文](../zh/readme.md)

[![npm version](https://img.shields.io/npm/v/icore.svg)](https://www.npmjs.com/package/icore)
[![node](https://img.shields.io/node/v/icore.svg)](https://www.npmjs.com/package/icore)
[![types](https://img.shields.io/npm/types/icore.svg)](https://www.npmjs.com/package/icore)
[![license](https://img.shields.io/npm/l/icore.svg)](../../LICENSE)

> Русский перевод английской версии. При расхождении актуальной считается английская версия.

`icore` — библиотека TypeScript для создания интерфейсов командной строки в приложениях на [Node.js®](https://nodejs.org/). Она помогает описывать команды, разбирать аргументы, выполнять выбранную команду и выводить текст, таблицы, JSON или CSV.

Библиотека берёт на себя общую механику командной строки. API-вызовы, конфигурация, правила предметной области, текст справки и интерактивное поведение терминала остаются в приложении.

## Установка

Чтобы использовать `icore` в своём проекте, выполните:

```sh
npm install icore
```

## Быстрый старт

Создайте команды, соберите их в [реестр команд](../examples/command-resolution.md#create-a-commands-object-from-existing-definitions) и передайте его в `createTerminalApp()`:

```ts
import { createCommand, createTerminalApp } from 'icore';

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

## Выбор API

| Что нужно приложению | С чего начать | Пример |
| --- | --- | --- |
| Сразу выполнить команду | `app.run(...)` | [Быстрый старт](#быстрый-старт) |
| Обработать глобальные опции или создать и закрыть ресурсы | `app.prepare(...)` и `app.commands.run(...)` | [Настройка запуска команды и очистки ресурсов](examples/terminal-app.md) |
| Описать команды и их опции | `createCommand()`, `createCommand.withTypes()` или `createCommands()` | [Описание опций команд](examples/option-schemas.md) |
| Подготовить команду до создания сервисов приложения | `commands.prepare()` и `commands.run()` | [Подготовка и выполнение команды вручную](../examples/custom-command-flow.md) |
| Использовать общие поля или отдельные данные для JSON, таблицы и CSV | `createPresentation()` для общих полей; `renderJson()`, `renderTextTable()` или `renderCsv()` для отдельных данных | [Форматирование и запись вывода](../examples/presentation-output.md) |
| Явно записать данные в стандартный вывод или поток ошибок | `createOutput()` | [Запись вывода](../examples/output-writers.md) |
| Разобрать аргументы или найти команду напрямую | `parseArgv()`, `resolveCommand()` и связанные экспорты | [Прямые API](../examples/readme.md#direct-apis) |

## Ошибки

`IcoreError` описывает неверные аргументы командной строки и неверные описания команд. Используйте `isIcoreError(...)`, чтобы проверить такую ошибку, и `isUsageError(...)`, чтобы распознать ошибку пользовательского ввода. Для правил ввода конкретного приложения выбрасывайте `CliUsageError`. Актуальные типы ошибок и коды описаны в [исходных файлах ошибок](https://github.com/woodger/icore/tree/main/src/errors).

## Примеры

[Все примеры](examples/readme.md) сгруппированы по задачам.

История релизов находится в [CHANGELOG.md](../../CHANGELOG.md), а проектные решения — в [docs/roadmap.md](../roadmap.md).

Проект распространяется по [лицензии MIT](../../LICENSE).
