# icore

English | [Русский](https://github.com/woodger/icore/blob/main/docs/ru/readme.md) | [简体中文](https://github.com/woodger/icore/blob/main/docs/zh/readme.md)

[![npm version](https://img.shields.io/npm/v/icore.svg)](https://www.npmjs.com/package/icore)
[![node](https://img.shields.io/node/v/icore.svg)](https://www.npmjs.com/package/icore)
[![types](https://img.shields.io/npm/types/icore.svg)](https://www.npmjs.com/package/icore)
[![license](https://img.shields.io/npm/l/icore.svg)](LICENSE)

`icore` is a TypeScript library for building command-line interfaces in [Node.js®](https://nodejs.org/) applications. It helps an application define commands, parse arguments, run the selected command, and write text, table, JSON, or CSV output.

The library provides the shared command-line mechanics. The application provides its API calls, configuration, business rules, help text, and interactive terminal behavior.

## Requirements And Installation

`icore` requires Node.js `>=16.9.0` and includes TypeScript declarations.

```sh
npm install icore
```

## Quick Start

Create commands, collect them in a [command registry](docs/examples/command-resolution.md#create-a-commands-object-from-existing-definitions), and pass the registry to `createTerminalApp()`:

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

After building the application:

```console
$ node dist/cli.js hello
Hello, world!

$ node dist/cli.js hello --name Alice --uppercase
HELLO, ALICE!
```

The `options` object describes arguments accepted after `hello`. The `handle` function receives their parsed values.

`app.run(...)` validates the arguments, runs the selected command, formats its result, and writes it to the terminal. With `strict: true`, the command name and any subcommands must come before options: `users get --id 42`.

When the application handles global `--help` or `--version`, opens resources after selecting a command, or must close resources around execution, follow [Set Up Command Execution And Cleanup](docs/examples/terminal-app.md).

## Choose An API

| What the application needs | Start with | Example |
| --- | --- | --- |
| Run a command immediately | `app.run(...)` | [Quick Start](#quick-start) |
| Handle global flags or create and close resources | `app.prepare(...)` and `app.commands.run(...)` | [Set Up Command Execution And Cleanup](docs/examples/terminal-app.md) |
| Define commands and their options | `createCommand()`, `createCommand.withTypes()`, or `createCommands()` | [Define Command Options](docs/examples/option-schemas.md) |
| Prepare a command before creating application services | `commands.prepare()` and `commands.run()` | [Prepare And Run Commands Yourself](docs/examples/custom-command-flow.md) |
| Use the same record fields for JSON, table, and CSV | `createPresentation()` | [Format And Write Output](docs/examples/presentation-output.md) |
| Choose separate data for JSON, table, and CSV | `renderJson()`, `renderTextTable()`, or `renderCsv()` | [Format And Write Output](docs/examples/presentation-output.md) |
| Write directly to standard output or standard error | `createOutput()` | [Write Output](docs/examples/output-writers.md) |
| Parse arguments or resolve a command directly | `parseArgv()`, `resolveCommand()`, and related exports | [Direct APIs](docs/examples/readme.md#direct-apis) |

## Errors

`IcoreError` describes invalid command lines and invalid command definitions. Use `isIcoreError(...)` to inspect one and `isUsageError(...)` to identify errors caused by user input. For application-specific input rules, throw `CliUsageError`. The current error types and codes are defined in [the error source files](https://github.com/woodger/icore/tree/main/src/errors).

## Examples

- [Set Up Command Execution And Cleanup](docs/examples/terminal-app.md) explains global flags, resource creation and cleanup, output, and error handling.
- [Define Command Options](docs/examples/option-schemas.md) explains strings, booleans, numbers, allowed values, defaults, aliases, and inferred TypeScript types.
- [Common CLI Patterns](docs/examples/practical-cli-patterns.md) covers help and version commands, shared options, and compatibility aliases.
- [Argument Syntax](docs/examples/cli-argument-syntax.md) lists accepted command-line forms and rejected forms.
- [Prepare And Run Commands Yourself](docs/examples/custom-command-flow.md) shows how to use command preparation and execution without a terminal application.
- [Format And Write Output](docs/examples/presentation-output.md) explains how to render results and write them to standard output or standard error.
- [Direct APIs](docs/examples/readme.md#direct-apis) links to direct command resolution, output, and presentation APIs.

Release history is in [CHANGELOG.md](CHANGELOG.md). Design decisions are in [docs/roadmap.md](docs/roadmap.md).

## What `icore` Does

`icore` handles generic command-line work: option validation, command selection, typed values passed to command functions, output formatting, error handling hooks, and writing to standard output or standard error.

The application owns API calls, configuration loading, domain validation, resource creation and cleanup, help content, progress indicators, and other interactive terminal behavior.

Licensed under the [MIT License](LICENSE).
