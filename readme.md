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
- [Command API Reference](#command-api-reference)
  - [Architecture Map](#architecture-map)
  - [Terminal Application](#terminal-application)
    - [`createTerminalApp()`](#createterminalapp)
    - [Interface](#interface)
    - [Application Methods](#application-methods)
    - [Application Construction](#application-construction)
    - [Runtime Arguments](#runtime-arguments)
  - [Layer Toolkit](#layer-toolkit)
    - [`createCommand()`](#createcommand)
    - [`createCommands(commands)`](#createcommandscommands)
  - [Primitive Mechanics](#primitive-mechanics)
    - [Parsing And Resolution](#parsing-and-resolution)
    - [Preparation](#preparation)
    - [Execution](#execution)
- [Internal Source Layout](#internal-source-layout)
- [Project Boundary](#project-boundary)

## Command API Reference

The command API is documented from the architectural map. Start at the top when
building a regular terminal application, and move down only when custom
composition needs lower-level mechanics.

### Architecture Map

```text
Terminal Application
└─ createTerminalApp()
   ├─ app.prepare(args)
   │  └─ commands.prepare(args)
   │     └─ prepareCommandFromArgs(registry, args, options?)
   │        ├─ resolveCommandFromArgs(registry, args)
   │        │  ├─ parseArgv(args, schema?)
   │        │  └─ resolveCommand(registry, positionals)
   │        └─ parseOptionsDetailed(schema, values)
   │
   └─ app.run(args, context)
      ├─ commands.prepare(args)
      ├─ commands.run(prepared, context)
      │  └─ runPreparedCommand(prepared, context)
      └─ presentation and output boundary

Layer Toolkit
├─ createCommand()
│  ├─ command.define(command)
│  │  └─ defineCommand(command)
│  ├─ command.registry(commands)
│  │  └─ createCommands(commands)
│  └─ command.run(command, args, context)
│     └─ runCommand(command, args, context, options?)
│
└─ createCommands(commands)
   ├─ commands.resolve(positionals)
   │  └─ resolveCommand(registry, positionals)
   ├─ commands.resolveFromArgs(args)
   │  └─ resolveCommandFromArgs(registry, args)
   ├─ commands.prepare(args)
   │  └─ prepareCommandFromArgs(registry, args, options?)
   ├─ commands.run(prepared, context)
   │  └─ runPreparedCommand(prepared, context)
   └─ commands.runFromArgs(args, context)
      └─ runCommandFromRegistry(registry, args, context, options?)
```

The map is a documentation route, not a complete internal call graph.

### Terminal Application

#### `createTerminalApp()`

`createTerminalApp()` is the top-level terminal application composition point.
It wires command execution, presentation rendering, and stdout/stderr delivery
without taking ownership of application behavior.

The checked TypeScript contract lives in [`src/terminal/app.ts`](src/terminal/app.ts).

The method returns an application object with `prepare(args)` and
`run(args, context)`, as shown in the architecture map.

#### Interface

Simplified shape:

```ts
type CreateTerminalAppOptions = {
  commands: Commands; // required
  presentation?: Presentation; // optional, defaults to createPresentation()
  output?: Output; // optional, defaults to createOutput()
  resolveFormat?: (prepared: PreparedCommand) => PresentationFormat | undefined;
};
```

`commands` is the command mechanics object used by the terminal application.
The terminal app cannot run without it, so this option is required.

`presentation` controls how terminal-ready presentation results are rendered.
Pass it when commands create presentation views with a shared presentation
object, or omit it to use the default `createPresentation()`.

`output` controls where rendered text is written. Omit it for regular
`stdout`/`stderr`; pass it when tests or applications need custom sinks.

`resolveFormat` customizes format selection. By default, the terminal app reads
the prepared command option named `format` when it is present.

#### Application Methods

`app.prepare(args, options?)` resolves and validates a command before runtime
context exists.

- `args` are raw CLI arguments, usually `process.argv.slice(2)`;
- `options` are command resolution options, such as `strict: true`;
- the command handler is not called;
- stdout and stderr are not used;
- the result can be inspected before creating runtime resources.

```ts
const prepared = await app.prepare(args, {
  strict: true
});
```

`app.run(args, context, options?)` is the regular process path.

- it prepares the command;
- runs the selected command handler with application context;
- renders supported terminal results;
- writes regular output to stdout and command errors to stderr;
- returns a process-style exit code.

```ts
process.exitCode = await app.run(args, context, {
  strict: true
});
```

#### Application Construction

A complete application path starts with commands, then creates the terminal app,
then runs it with process arguments and application context.

```ts
import {
  createCommand,
  createOutput,
  createPresentation,
  createTerminalApp,
  presentationFormatOptions
} from 'icore';

type AppContext = {
  currentUser: string;
};

const command = createCommand();
const presentation = createPresentation();

const commands = command.registry([
  command.define({
    path: ['hello'],
    options: presentationFormatOptions,
    handle({ context }: { context: AppContext }) {
      return presentation.record({
        message: `Hello, ${context.currentUser}!`
      });
    }
  })
] as const);

const app = createTerminalApp({
  commands,
  presentation,
  output: createOutput()
});

const args = process.argv.slice(2);
const context: AppContext = {
  currentUser: 'Alice'
};

process.exitCode = await app.run(args, context, {
  strict: true
});
```

`createTerminalApp({ commands })` is enough for the default presentation and
regular `stdout`/`stderr` output. Passing `presentation` and `output` makes the
composition explicit and is useful in tests or custom terminal environments.

#### Runtime Arguments

In Node.js applications, `args` usually comes from `process.argv.slice(2)`.
`context` is owned by the consuming application and usually contains config,
clients, or services needed by command handlers. If an application does not use
context, pass `undefined` and define commands without a context dependency.

Command handlers keep ownership of application work. The terminal app only
accepts terminal-ready results: text, streaming text, presentation results, or
no output. Application DTO mapping, config loading, network clients, and domain
behavior stay in the consuming application.

### Layer Toolkit

#### `createCommand()`

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

##### `command.define(command)`

Declares one command and preserves its literal path and option schema types.
Use it when defining commands inline before adding them to a registry.

##### `command.registry(commands)`

Builds the `commands` object required by `createTerminalApp()`. It keeps the
registered command definitions, derived command names, and command flow methods
together.

##### `command.run(command, args, context)`

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

### Primitive Mechanics

Primitive mechanics are the lower-level functions shown at the leaves of the
architecture map. Use them for custom composition, focused tests, or framework
work inside `icore`.

For application code, prefer `createTerminalApp()` first. Drop to this level
only when the terminal application flow or the layer toolkit is too coarse.

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
