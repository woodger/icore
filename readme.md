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

- [Installation](#installation)
- [API Reference](#api-reference)
  - [API Map](#api-map)
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
  - [`createOutput()`](#createoutput)
  - [Lower-Level Mechanics](#lower-level-mechanics)
- [Internal Source Layout](#internal-source-layout)
- [Project Boundary](#project-boundary)

## API Reference

The API reference is documented from the application construction map. Start at
`createTerminalApp()` for regular terminal applications, then move to the
construction methods only when the app needs explicit command, presentation, or
output wiring.

### API Map

```text
createTerminalApp()
├─ createCommand()
│  ├─ command.define(command)
│  ├─ command.registry(commands)
│  │  └─ commands
│  │     ├─ commands.prepare(args, options?)
│  │     ├─ commands.run(prepared, context)
│  │     └─ commands.runFromArgs(args, context, options?)
│  └─ command.run(command, args, context)
├─ createPresentation()
└─ createOutput()
```

The map is a documentation route, not a complete internal call graph. The
`commands` object is produced by `command.registry(...)` or by
`createCommands(...)`.

### `createTerminalApp()`

`createTerminalApp()` is the top-level terminal application composition point.
It wires command execution, presentation rendering, and stdout/stderr delivery
without taking ownership of application behavior.

The checked TypeScript contract lives in [`src/terminal/app.ts`](src/terminal/app.ts).

The method returns an application object with `prepare(args)` and
`run(args, context)`, as shown in the API map.

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

Simplified shape:

```ts
const presentation = createPresentation();

presentation.record(value);
presentation.records(values);
presentation.table(rows);
presentation.csv(rows);
presentation.render(result, format);
```

The presentation object owns generic JSON, CSV, and table rendering mechanics.
Application code still maps domain objects to presentation-ready values.

### `createOutput()`

`createOutput()` creates the output object used by `createTerminalApp()` to
write rendered text.

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

### Lower-Level Mechanics

Lower-level mechanics sit behind the construction methods in the API map. They
are kept out of the main navigation to avoid turning README into a flat
function reference.

For application code, prefer `createTerminalApp()` first. Drop to this level
only when the terminal application flow or construction methods are too coarse.

Source of truth:

- [src/argv/parser.ts](src/argv/parser.ts) for raw argv parsing;
- [src/options/parser.ts](src/options/parser.ts) for option value validation;
- [src/command/mechanics.ts](src/command/mechanics.ts) for command resolution,
  preparation, and execution.

#### Parsing And Resolution

This group turns raw arguments or positionals into a selected command.

- `parseArgv(args, schema?)` parses raw CLI arguments into positionals and raw
  option values;
- `resolveCommand(registry, positionals)` resolves from already parsed
  positionals;
- `resolveCommandFromArgs(registry, args)` resolves from raw CLI arguments by
  using registered command schemas.

Use these methods when command selection is needed without validation or
execution.

#### Preparation

This group validates command input without runtime context.

- `parseOptionsDetailed(schema, values)` validates raw option values and keeps
  option presence metadata;
- `prepareCommandFromArgs(registry, args, options?)` resolves and validates a
  registered command;
- `options.strict` rejects options before the command path.

Use preparation when runtime resources should be created only after command
selection is known.

#### Execution

This group calls command handlers after command input is prepared.

- `runPreparedCommand(prepared, context)` runs an already prepared command;
- `runCommandFromRegistry(registry, args, context, options?)` prepares and runs
  a command from a registry;
- `runCommand(command, args, context, options?)` runs a single command without a
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
