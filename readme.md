# icore

[![npm version](https://img.shields.io/npm/v/icore.svg)](https://www.npmjs.com/package/icore)
[![node](https://img.shields.io/node/v/icore.svg)](https://www.npmjs.com/package/icore)
[![types](https://img.shields.io/npm/types/icore.svg)](https://www.npmjs.com/package/icore)
[![license](https://img.shields.io/npm/l/icore.svg)](LICENSE)

Small dependency-free command line interface and terminal presentation
mechanics for [Node.js®](https://nodejs.org) applications.

`icore` owns the path from `process.argv` to terminal output:

- declarative, type-inferred option schemas;
- multi-segment command resolution with canonical command aliases;
- separate prepare and execute phases;
- JSON, CSV, and text-table presentation;
- ordered stdout/stderr writers and reusable terminal error policy.

Application-specific API calls, configuration, domain behavior, and help text
remain in the consuming application.

## Requirements And Installation

`icore` requires Node.js `>=16.9.0` and includes TypeScript declarations.

```sh
npm install icore
```

Import public APIs from `icore`. Deep imports into `dist` or `src` are not part
of the package contract.

## Contents

- [Quick Start](#quick-start)
- [Choose An API Level](#choose-an-api-level)
- [Supported Argument Syntax](#supported-argument-syntax)
- [Error Handling](#error-handling)
- [Guides](#guides)
- [Project Boundary](#project-boundary)

## Quick Start

Create commands, put them in a registry, and give that registry to
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

After compiling the application:

```console
$ node dist/cli.js hello
Hello, world!

$ node dist/cli.js hello --name Alice --uppercase
HELLO, ALICE!
```

The schema determines the handler's option types. Required options and options
with defaults are always present; optional options are returned as
`T | undefined`.

`strict: true` rejects options placed before the command path. String output is
written exactly as returned, so include `\n` when line output is intended.
Default resolution continues to accept option-first input. Parsing bootstrap
options does not reorder argv, so enable strict mode only when command-first
syntax is part of the application's public CLI contract.

## Choose An API Level

Start with the highest-level API that fits the application:

| Need | Start with | Detailed guide |
| --- | --- | --- |
| Complete terminal application | `createTerminalApp()` | [Terminal App](examples/terminal-app.md) |
| Commands and option schemas | `createCommand()` or `createCommands()` | [Option Schemas](examples/option-schemas.md) |
| Custom prepare/execute lifecycle | `commands.prepare()` and `commands.run()` | [Custom Command Flow](examples/custom-command-flow.md) |
| Presentation without command execution | `createPresentation()` | [Presentation And Output](examples/presentation-output.md) |
| Explicit stdout/stderr writing | `createOutput()` | [Output Writers](examples/output-writers.md) |
| Parser and resolver primitives | `parseArgv()`, `resolveCommand()`, and related exports | [Primitive Mechanics](examples/readme.md#primitive-mechanics) |

`createTerminalOutput()` and `createTerminalProgress()` remain available as
deprecated `2.x` compatibility exports. Do not use them in new Consumers;
keep interactive output and progress rendering in the consuming application.
The [application-owned output guide](examples/output-writers.md#application-owned-interactive-output)
describes the recommended boundary. The retained
[migration guide](examples/interactive-output.md) documents the legacy
contract.

The terminal application exposes the main lifecycle operations:

- `app.run(args, context, options?)` prepares, executes, renders, and writes;
- `app.prepare(args, options?)` validates input without runtime context;
- `app.runPrepared(prepared, context)` executes an already prepared command;
- `app.writePreparedOutput(prepared, output)` writes caller-obtained output;
- `app.reportError(error, context?)` applies the configured terminal error
  policy and returns a process-style exit code.

Command handlers receive parsed `options`, option-presence metadata in
`provided`, remaining `positionals`, caller-owned `context`, and an optional
prepared `payload`.

Supported terminal results are strings, async string streams, presentation
results, and `undefined`:

Use `isTerminalCommandOutput(...)` to narrow an unknown caller-owned result
before passing it to `app.writePreparedOutput(...)`.

```text
argv → resolve → validate/prepare → execute → render → stdout/stderr
```

Exact public exports live in [`src/index.ts`](src/index.ts) and in the bundled
TypeScript declarations.

## Supported Argument Syntax

The supported syntax is intentionally small and predictable:

| Form | Example | Notes |
| --- | --- | --- |
| Long option with separate value | `--name Alice` | String and number options consume a value |
| Long option with attached value | `--name=Alice` | Equivalent to the separate form |
| Boolean flag | `--verbose` | Produces `true` |
| Boolean negation | `--no-cache` | Supported for known boolean options unless `syntax: 'flag'` |
| Short alias | `-v`, `-n Alice` | Must be declared in the schema as one ASCII letter |
| Option terminator | `--` | Every following token becomes positional |

Option names are exact: `icore` does not convert `camelCase` to `kebab-case`.
Explicit boolean values such as `--verbose=true`, attached short values such as
`-nAlice`, and grouped aliases such as `-abc` are not supported.

See [CLI Argument Syntax](examples/cli-argument-syntax.md) for parsing examples,
edge cases, duplicate handling, and the option terminator contract.

## Error Handling

CLI parsing, validation, resolution, and definition failures are reported as
`IcoreError`. It extends `Error` with:

- a stable machine-readable `code`;
- a `usage` or `definition` category;
- required, code-specific `details`.

Use `isIcoreError(...)` instead of manually casting details. Passing a code to
the guard narrows the corresponding details shape:

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

Inside the `UNKNOWN_COMMAND` branch, fields such as `error.details.command` and
`error.details.positionals` are strongly typed. `IcoreErrorDetailsMap` is the
public source of truth for every code. Direct `new IcoreError(...)` calls must
provide a third argument matching the selected code.

Application-owned semantic validation can throw `CliUsageError` without
claiming one of the framework-owned `IcoreError` codes:

```ts
import { CliUsageError } from 'icore';

throw new CliUsageError(
  "Expected '--from' to be earlier than or equal to '--to'"
);
```

`isUsageError(...)` recognizes both `CliUsageError` and `IcoreError` instances
whose category is `usage`. Rendering, help text, and the choice of exit code
remain application policy.

Both guards recognize compatible errors created by another physical copy of
`icore` in the same JavaScript realm. Current errors carry stable runtime
brands, while validated unbranded `2.0.x` errors remain recognizable during
migration. This does not turn errors serialized through JSON, IPC, or worker
boundaries back into class instances.

Without a custom policy, terminal apps write `Error.message + "\n"` (or
`String(error) + "\n"` for other thrown values) and return exit code `1`.
Application-specific help remains application policy.

Custom lifecycles can call `app.reportError(...)` to reuse the same rendering
and exit-code policy. The complete prepare, execute, write, and external phase
flow is shown in the
[Terminal App guide](examples/terminal-app.md#reuse-error-reporting-in-a-custom-lifecycle).

## Guides

The [examples index](examples/readme.md) routes from regular terminal apps to
lower-level mechanics. Useful starting points:

- [Terminal App](examples/terminal-app.md) — regular application composition,
  format resolution, and reusable error reporting;
- [Option Schemas](examples/option-schemas.md) — strings, booleans, numbers,
  choices, defaults, aliases, and inferred types;
- [Practical CLI Patterns](examples/practical-cli-patterns.md) — help/version
  shortcuts, shared options, and compatibility aliases;
- [Command Resolution](examples/command-resolution.md) — registries, canonical
  command aliases, matched paths, explicit resolution, and command-name guards;
- [Two-Phase Primitives](examples/two-phase-primitives.md) — preparation,
  payloads, execution, and provided-option metadata;
- [Presentation Primitives](examples/presentation-primitives.md) — text, record,
  table, CSV, JSON, and direct renderers.

Release history is recorded in [CHANGELOG.md](CHANGELOG.md). Directional
decisions live in [docs/roadmap.md](docs/roadmap.md).

## Project Boundary

`icore` is a small terminal mechanics module. It owns generic behavior such as
option validation, command resolution, typed handler input, presentation
rendering, error contracts, and stdout/stderr delivery.

It does not own application DTO mapping, API calls, configuration loading,
domain-specific validation, lifecycle resources, or help content. Keep those
responsibilities in the consuming application. Interactive line rendering and
progress reporting are also application-owned; the legacy compatibility
exports are not a foundation for new code.

Licensed under the [MIT License](LICENSE).
