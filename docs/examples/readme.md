# Examples

English | [Русский](../ru/examples/readme.md) | [简体中文](../zh/examples/readme.md)

These examples show how an application uses `icore`. Start with the task you need to perform; the lower sections cover APIs used when the application needs more control.

## Build A Terminal Application

- [Set Up Command Execution And Cleanup](terminal-app.md) covers global flags, resource creation and cleanup, output, and error handling. The [README quick start](../../readme.md#quick-start) shows `app.run(...)`.
- [Common CLI Patterns](practical-cli-patterns.md) covers help and version commands, shared options, and compatibility aliases.

## Define Commands And Options

- [Define Command Options](option-schemas.md) explains string, boolean, and number options, allowed values, defaults, aliases, and inferred TypeScript types.
- [Argument Syntax](cli-argument-syntax.md) lists the command-line forms that `icore` accepts.
- [Prepare And Run Commands Yourself](custom-command-flow.md) shows how to prepare and run commands without a terminal application.
- [Format And Write Output](presentation-output.md) explains rendering and writing output without running a command.

## Direct APIs

- [Resolve Commands Directly](command-resolution.md) covers command registries, aliases, matched command names, and direct resolution.
- [Prepare, Run, And Parse Directly](two-phase-primitives.md) covers direct functions for preparation, execution, and parsing.
- [Create Output Values](presentation-primitives.md) covers text, records, tables, CSV, JSON, and direct renderers.
- [Write Output Directly](output-writers.md) covers standard-output and standard-error writers and custom destinations.

## APIs Kept For Existing Integrations

These APIs remain public, but new applications normally start with the APIs above.

- [Resolve Commands Directly](command-resolution.md) documents `resolveCommandFromArgs(...)`.
- [Prepare, Run, And Parse Directly](two-phase-primitives.md) documents `parseOptionsDetailed(...)` and `parseOptionsSubsetDetailed(...)`.
