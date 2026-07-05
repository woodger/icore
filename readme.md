# icore

[![npm version](https://img.shields.io/npm/v/icore.svg)](https://www.npmjs.com/package/icore)
[![node](https://img.shields.io/node/v/icore.svg)](https://www.npmjs.com/package/icore)
[![types](https://img.shields.io/npm/types/icore.svg)](https://www.npmjs.com/package/icore)
[![license](https://img.shields.io/npm/l/icore.svg)](LICENSE)

Small dependency-free command line interface and terminal presentation mechanics for [Node.js®](https://nodejs.org) applications.

Supports a practical GNU-style option syntax:

- long options: `--name value`, `--name=value`;
- boolean flags: `--flag`, `--no-flag`;
- short aliases: `-f`, `-n value`;
- option terminator: `--`.

## Installation

To use `icore` in your project, run:

```sh
npm install icore
```

## Table of Contents

- [API Reference](#api-reference)
  - [`createTerminalApp()`](#createterminalapp)
  - [`createCommand()`](#createcommand)
    - [`command.define(command)`](#commanddefinecommand)
    - [`command.registry(commands)`](#commandregistrycommands)
    - [`command.run(command, args, context)`](#commandruncommand-args-context)
    - [`createCommands(commands)`](#createcommandscommands)
    - [`commands.prepare(args, options?)`](#commandsprepareargs-options)
    - [`commands.run(prepared, context)`](#commandsrunprepared-context)
    - [`commands.runFromArgs(args, context, options?)`](#commandsrunfromargsargs-context-options)
  - [`createPresentation()`](#createpresentation)
    - [`presentation.empty()`](#presentationempty)
    - [`presentation.text(value)`](#presentationtextvalue)
    - [`presentation.record(value)`](#presentationrecordvalue)
    - [`presentation.records(values)`](#presentationrecordsvalues)
    - [`presentation.table(rows)`](#presentationtablerows)
    - [`presentation.csv(rows)`](#presentationcsvrows)
    - [`presentation.render(result, format?)`](#presentationrenderresult-format)
    - [`presentation.renderers.*`](#presentationrenderers)
  - [`createOutput()`](#createoutput)
    - [`output.write(chunk)`](#outputwritechunk)
    - [`output.error(chunk)`](#outputerrorchunk)
    - [`output.stdout.write(chunk)`](#outputstdoutwritechunk)
    - [`output.stderr.write(chunk)`](#outputstderrwritechunk)
  - [Lower-Level Mechanics](#lower-level-mechanics)
    - [`parseArgv(args, schema?)`](#parseargv)
    - [`parseOptionsDetailed(schema, values)`](#parseoptionsdetailed)
    - [`resolveCommand(registry, positionals)`](#resolvecommand)
    - [`resolveCommandFromArgs(registry, args)`](#resolvecommandfromargs)
    - [`prepareCommandFromArgs(registry, args, options?)`](#preparecommandfromargs)
    - [`runPreparedCommand(prepared, context)`](#runpreparedcommand)
    - [`runCommandFromRegistry(registry, args, context, options?)`](#runcommandfromregistry)
    - [`runCommand(command, args, context, options?)`](#runcommand)
- [Internal Source Layout](#internal-source-layout)
- [How It Works](#how-it-works)
- [Example](#example)
- [Option Schemas](#option-schemas)
- [Type Inference](#type-inference)
- [Facade of arguments](#facade-of-arguments)
- [Error Messages](#error-messages)
- [Project Boundary](#project-boundary)

## API Reference

Start at `createTerminalApp()` for regular terminal applications, then move to
the construction methods only when the app needs explicit command,
presentation, or output wiring.

### `createTerminalApp()`

`createTerminalApp()` is the top-level terminal application composition point.
It wires command execution, presentation rendering, and stdout/stderr delivery
without taking ownership of application behavior.

The checked TypeScript contract lives in [`src/terminal/app.ts`](src/terminal/app.ts).

The method returns an application object with `prepare(args)` and
`run(args, context)`.

Construction inputs:

- `commands` is required; build it with [`createCommand()`](#createcommand) and
  [`command.registry(commands)`](#commandregistrycommands), or directly with
  [`createCommands(commands)`](#createcommandscommands);
- `presentation` is optional; omit it to use [`createPresentation()`](#createpresentation);
- `output` is optional; omit it to use [`createOutput()`](#createoutput);
- `resolveFormat` is optional and customizes how a prepared command selects a
  presentation format.

Returned app methods:

- `app.prepare(args, options?)` delegates to
  [`commands.prepare(args, options?)`](#commandsprepareargs-options);
- `app.run(args, context, options?)` prepares the command, delegates command
  execution to [`commands.run(prepared, context)`](#commandsrunprepared-context),
  then renders and writes terminal output.

Minimal shape:

```ts
const app = createTerminalApp({
  commands,
  presentation,
  output
});

const args = process.argv.slice(2);
const exitCode = await app.run(args, context, {
  strict: true
});
```

Command handlers keep ownership of application work. The terminal app only
accepts terminal-ready results: text, streaming text, presentation results, or
no output. Application DTO mapping, config loading, network clients, and domain
behavior stay in the consuming application.

### `createCommand()`

`createCommand()` returns the command mechanics entrypoint used to build
`commands` for `createTerminalApp()`.

Simplified shape:

```ts
const command = createCommand();

command.define(commandDefinition);
command.registry(commandDefinitions);
command.run(commandDefinition, args, context);
```

Build `commands` before creating the terminal app:

- `createCommand()` creates the command mechanics entrypoint;
- `command.define(...)` declares one command;
- `command.registry([...])` returns the `commands` object required by
  `createTerminalApp()`.

The command definition keeps the application-specific parts: command path,
option schema, and handler behavior. The terminal app only needs the resulting
registry object.

#### `command.define(command)`

Declares one command and preserves its literal path and option schema types.
Use it when defining commands inline before adding them to a registry.

#### `command.registry(commands)`

Builds the `commands` object required by `createTerminalApp()`. It keeps the
registered command definitions, derived command names, and command flow methods
together.

#### `command.run(command, args, context)`

Runs a single command without a registry. Use it for focused command execution,
small tests, or custom flows where command path resolution is not needed.

#### `createCommands(commands)`

Use `createCommands(commands)` when the application already has command
definitions and does not need the `createCommand()` object form.

The returned object is the same `commands` contract consumed by
`createTerminalApp()`: it can resolve, prepare, and run registered commands.

Simplified shape:

```ts
const commands = createCommands(commandDefinitions);

commands.names;
commands.registry;
commands.resolve(positionals);
commands.resolveFromArgs(args);
commands.prepare(args, options);
commands.run(prepared, context);
commands.runFromArgs(args, context, options);
```

Use `commands.prepare(...)` and `commands.run(...)` when application code needs
the same two-phase flow used by `createTerminalApp()`. Use
`commands.runFromArgs(...)` for custom terminal boundaries that still want the
registry-level command flow.

#### `commands.prepare(args, options?)`

Resolves and validates a registered command without runtime context. This is
the same preparation step used by `app.prepare(...)` and `app.run(...)`.

#### `commands.run(prepared, context)`

Runs an already prepared command with application context. Use it after
`commands.prepare(...)` when the application needs a custom two-phase flow.

#### `commands.runFromArgs(args, context, options?)`

Resolves, prepares, and runs a registered command without the terminal
application boundary. Use it when a custom boundary owns presentation or output.

### `createPresentation()`

`createPresentation()` creates the presentation object used by
`createTerminalApp()` to render terminal-ready results.

Source of truth:

- [src/presentation/facade.ts](src/presentation/facade.ts) for the presentation
  object;
- [src/presentation/view.ts](src/presentation/view.ts) for presentation view
  factories;
- [src/presentation/result-renderer.ts](src/presentation/result-renderer.ts)
  for rendering presentation results.

Simplified shape:

```ts
const presentation = createPresentation();

presentation.empty();
presentation.text(value);
presentation.record(value);
presentation.records(values);
presentation.table(rows);
presentation.csv(rows);
presentation.render(result, format);
```

The presentation object owns generic JSON, CSV, and table rendering mechanics.
Application code still maps domain objects to presentation-ready values.

#### `presentation.empty()`

Creates a presentation result with no terminal output.

#### `presentation.text(value)`

Wraps ready terminal text. Use it when the command already owns the final text.

#### `presentation.record(value)`

Creates a generic one-record view. The renderer can print it as table, CSV, or
JSON depending on the selected format.

#### `presentation.records(values)`

Creates a generic multi-record view. Application code still decides which fields
belong in each record.

#### `presentation.table(rows)`

Creates an explicit table view from prepared text rows.

#### `presentation.csv(rows)`

Creates an explicit CSV view from scalar rows.

#### `presentation.render(result, format?)`

Renders a presentation result to terminal text. The default format is `table`.

#### `presentation.renderers.*`

Exposes lower-level JSON, table, and CSV renderers for custom presentation
composition. Prefer `presentation.render(...)` for regular terminal commands.

### `createOutput()`

`createOutput()` creates the output object used by `createTerminalApp()` to
write rendered text.

Source of truth:

- [src/output/facade.ts](src/output/facade.ts) for the output object;
- [src/output/node-writer.ts](src/output/node-writer.ts) for stdout and stderr
  writers;
- [src/output/text-writer.ts](src/output/text-writer.ts) for backpressure-aware
  text writing.

Simplified shape:

```ts
const output = createOutput();

await output.write(chunk);
await output.error(chunk);
await output.stdout.write(chunk);
await output.stderr.write(chunk);
```

The default output writes regular text to `stdout` and diagnostic text to
`stderr`. Pass custom sinks when tests or applications need controlled output.

#### `output.write(chunk)`

Writes regular terminal output through stdout.

#### `output.error(chunk)`

Writes diagnostic terminal output through stderr.

#### `output.stdout.write(chunk)`

Writes directly to the stdout channel. Use this only when a specific channel
must be passed around.

#### `output.stderr.write(chunk)`

Writes directly to the stderr channel. Use this only when a specific channel
must be passed around.

### Lower-Level Mechanics

Lower-level mechanics sit behind the construction methods. They are kept out of
the main navigation to keep the application construction path first.

For application code, prefer `createTerminalApp()` first. Drop to this level
only when the terminal application flow or construction methods are too coarse.

Source of truth:

- [src/argv/parser.ts](src/argv/parser.ts) for raw argv parsing;
- [src/options/parser.ts](src/options/parser.ts) for option value validation;
- [src/command/mechanics.ts](src/command/mechanics.ts) for command resolution,
  preparation, and execution.

#### Parsing And Resolution

This group turns raw arguments or positionals into a selected command.

- <a id="parseargv"></a>`parseArgv(args, schema?)` parses raw CLI arguments into positionals and raw
  option values;
- <a id="resolvecommand"></a>`resolveCommand(registry, positionals)` resolves from already parsed
  positionals;
- <a id="resolvecommandfromargs"></a>`resolveCommandFromArgs(registry, args)` resolves from raw CLI arguments by
  using registered command schemas.

Use these methods when command selection is needed without validation or
execution.

#### Preparation

This group validates command input without runtime context.

- <a id="parseoptionsdetailed"></a>`parseOptionsDetailed(schema, values)` validates raw option values and keeps
  option presence metadata;
- <a id="preparecommandfromargs"></a>`prepareCommandFromArgs(registry, args, options?)` resolves and validates a
  registered command;
- `options.strict` rejects options before the command path.

Use preparation when runtime resources should be created only after command
selection is known.

#### Execution

This group calls command handlers after command input is prepared.

- <a id="runpreparedcommand"></a>`runPreparedCommand(prepared, context)` runs an already prepared command;
- <a id="runcommandfromregistry"></a>`runCommandFromRegistry(registry, args, context, options?)` prepares and runs
  a command from a registry;
- <a id="runcommand"></a>`runCommand(command, args, context, options?)` runs a single command without a
  registry.

Use execution primitives for custom boundaries. Regular CLI applications should
usually stay at `createTerminalApp()`.

## Internal Source Layout

The public package entrypoint remains `src/index.ts`. Internal source files are
grouped by CLI framework responsibility:

```text
src/
  argv/          raw argv token parsing
  options/       option schemas and option value validation
  command/       command resolution and execution mechanics
  presentation/  terminal view models and JSON/CSV/table renderers
  output/        stdout/stderr writer boundaries
  terminal/      command + presentation + output app composition
  errors/        machine-readable icore errors
```

Consumers should continue importing from `icore`; deep imports are an internal
source layout detail.

## How It Works

![yuml diagram](http://yuml.me/diagram/scruffy;dir:LR;/class/[*argv*%20{bg:gray}|External;hello%20--name%20Alice%20--uppercase]->[*matches*%20{bg:lavender}|System;parse,%20resolve,%20validate,%20infer]->[*typed%20result*%20{bg:honeydew}|Container;command=hello;%20name=Alice;%20uppercase=true]->[*your%20app*%20{bg:cornsilk}|System;business%20logic%20and%20output])

## Example

More examples live in [examples/readme.md](examples/readme.md), including
option schemas, CLI argument syntax, practical CLI patterns, and lower-level
primitives.

```ts
import { defineCommand, runCommand } from 'icore';

const exampleCommand = defineCommand({
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
  async handle({ options }) {
    const message = `Hello, ${options.name}!`;

    return options.uppercase ? message.toUpperCase() : message;
  }
});

const output = await runCommand(
  exampleCommand,
  ['hello', '--name', 'Alice', '--uppercase'],
  {}
);

console.log(output);
```

Terminal output:

```console
$ node cli.js hello --name Alice --uppercase
HELLO, ALICE!
```

The command handler receives parsed options, user-provided option metadata,
remaining positionals, prepared payload, and caller provided context.

## Option Schemas

Options are described as plain objects.

**Option names are exact.** `icore` does not normalize `camelCase` to
`kebab-case`. Use quoted object keys when your public CLI option contains
`-`.

Each option can define an optional short alias:

```ts
const schema = {
  name: {
    type: 'string',
    alias: 'n'
  },
  uppercase: {
    type: 'boolean',
    alias: 'u'
  }
} as const;
```

Aliases must be a single ASCII letter and unique within the schema. Parsed
values are always returned by long option name.

### `type: 'string'`

```ts
const schema = {
  name: {
    type: 'string',
    required: true
  },
  style: {
    type: 'string',
    choices: ['short', 'long'],
    default: 'short'
  }
} as const;
```

String options reject missing required values, blank strings such as `--name=`,
boolean flag form, and values outside `choices`.

### `type: 'boolean'`

```ts
const schema = {
  uppercase: {
    type: 'boolean'
  }
} as const;
```

Boolean options accept **flag form** and schema-known negation:

```sh
--uppercase
--no-uppercase
```

Explicit values are rejected:

```sh
--uppercase=true
--uppercase=false
--uppercase=yes
--uppercase=
```

`--uppercase false` keeps `--uppercase` as `true` and leaves `false` as a positional
argument.

Use `syntax: 'flag'` when a boolean option should accept only flag form:

```ts
const schema = {
  uppercase: {
    type: 'boolean',
    default: false,
    syntax: 'flag'
  }
} as const;
```

With `syntax: 'flag'`, `--uppercase` is accepted, while `--uppercase=value`
and `--no-uppercase` are rejected.

### `type: 'number'`

```ts
const schema = {
  limit: {
    type: 'number',
    integer: true,
    min: 1,
    max: 1000,
    default: 100
  }
} as const;
```

Number options parse decimal numeric values and can validate integer and range
constraints. Defaults are validated with the same rules as user-provided values.

## Type Inference

Use `InferOptions` when you need the parsed option type explicitly.

```ts
import type { InferOptions } from 'icore';

const schema = {
  name: {
    type: 'string',
    default: 'world'
  },
  uppercase: {
    type: 'boolean'
  }
} as const;

type Options = InferOptions<typeof schema>;
```

`Options` is equivalent to:

```ts
type Options = {
  name: string;
  uppercase: boolean | undefined;
};
```

**Required options and options with defaults are always present.** Optional
options without defaults are returned as `T | undefined`.

Use `InferProvidedOptions` when you need the option presence type explicitly.

```ts
import type { InferProvidedOptions } from 'icore';

type Provided = InferProvidedOptions<typeof schema>;
```

`Provided` maps every schema option to `boolean`. `true` means the user
specified that option explicitly; defaults keep the flag `false`.

Use `MergeOptionsSchemas` when you need the merged schema type explicitly.

```ts
import type { MergeOptionsSchemas } from 'icore';

type Schema = MergeOptionsSchemas<[typeof nameOptions, typeof greetingOptions]>;
```

Use `CommandName` when you need the inferred command name type explicitly.

```ts
import type { CommandName } from 'icore';

type Name = CommandName<typeof helloFormalCommand>;
```

`Name` is equivalent to:

```ts
type Name = 'hello formal';
```

## Facade of arguments

Use `--` to stop option parsing. The terminator itself is not included in
positionals; every following token is treated as positional, even when it starts
with `-`.

Short syntax is supported only for aliases declared in the option schema.
Boolean aliases use flag form, such as `-f`; string and number aliases use a
separate value, such as `-n value`.

Attached short values such as `-nvalue` and grouped short booleans such as
`-abc` are not supported yet. Unknown short tokens remain positional for
compatibility.

Negated syntax such as `--no-cache` is interpreted as `cache: false` when
`cache` is a known boolean option without `syntax: 'flag'`. Unknown negated
options, negation for string or number options, and negation for flag-only
boolean options are rejected.

## Error Messages

`icore` throws `IcoreError` objects for CLI parsing, option validation, and
command resolution failures. `IcoreError` extends the regular `Error` class and
adds a stable machine-readable `code` plus structured `details`.

Applications should treat `error.message` as **display text**. Use `error.code`
for machine-readable handling:

```ts
import { IcoreError } from 'icore';

try {
  await main(args);
} catch (error) {
  if (error instanceof IcoreError && error.code === 'UNKNOWN_COMMAND') {
    printHelp();
    process.exitCode = 2;
    return;
  }

  throw error;
}
```

Supported error codes:

```ts
type IcoreErrorCode =
  | 'UNKNOWN_COMMAND'
  | 'UNEXPECTED_ARGUMENT'
  | 'DUPLICATE_ARGUMENT'
  | 'EXPECTED_REQUIRED_ARGUMENT'
  | 'INVALID_OPTION_TYPE'
  | 'INVALID_OPTION_CHOICE'
  | 'UNEXPECTED_POSITIONAL'
  | 'INVALID_OPTION_ALIAS'
  | 'DUPLICATE_ALIAS'
  | 'INVALID_OPTION_DEFAULT'
  | 'DUPLICATE_COMMAND';
```

Applications can catch these errors and decide how to print them. For example,
after printing `error.message`, terminal output can look like this:

```console
$ node cli.js hello --unknown
Unexpected argument '--unknown'

$ node cli.js hello --uppercase=yes
Expected '--uppercase' as boolean flag

$ node cli.js hello --name=
Expected '--name' as string
```

Errors thrown by command `prepare` and `handle` functions are application errors
and pass through unchanged.

## Project Boundary

`icore` is intended to be a **small CLI mechanics module**. It should **not**
grow into a domain-specific framework for a particular SDK or API.

Good responsibilities for `icore`:

- option schema evaluation;
- command path checking;
- common argument errors;
- typed command handler input;
- generic JSON, CSV, and text table rendering;
- stdout/stderr text writer mechanics.

Application-specific report mapping, scalar formatting, API calls, config
loading, and domain behavior stay outside `icore`.
