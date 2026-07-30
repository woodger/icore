# Guides

These guides show application code for consuming projects. They explain what to
put into a project, how to run it from a terminal, what output to expect, and
why a particular shape is useful or intentionally limited.

## Terminal Application

- [terminal-app.md](terminal-app.md) is the main production recipe for global
  shortcuts, preparation, metadata-driven resources, execution, output,
  cleanup, and error reporting. The compact `app.run(...)` path remains in the
  [README quick start](../../readme.md#quick-start).
- [practical-cli-patterns.md](practical-cli-patterns.md) shows application-level
  patterns for schema-aware global help/version shortcuts, metadata-driven
  command help, deprecated options, and edge-case argument handling.

## Layer Toolkit

- [option-schemas.md](option-schemas.md) shows how to describe string,
  boolean, and number options with defaults, choices, aliases, and inferred
  TypeScript types.
- [cli-argument-syntax.md](cli-argument-syntax.md) documents supported CLI
  argument syntax with terminal input examples.
- [custom-command-flow.md](custom-command-flow.md) shows explicit
  `commands.prepare(...)`, `commands.run(...)`, and `commands.runFromArgs(...)`
  usage without the terminal app output and error-policy boundary.
- [presentation-output.md](presentation-output.md) shows presentation rendering
  and output writing without command execution.

## Primitive Mechanics

- [command-resolution.md](command-resolution.md) shows command registries,
  canonical aliases, matched paths, explicit resolution, command-name guards,
  and standalone command definitions.
- [two-phase-primitives.md](two-phase-primitives.md) shows lower-level
  preparation and execution primitives used behind command facades.
- [presentation-primitives.md](presentation-primitives.md) shows explicit
  presentation views, renderers, and format guards.
- [output-writers.md](output-writers.md) shows stdout/stderr writer primitives,
  custom sink wiring, and the application-owned interactive output boundary.

## Legacy Compatibility

- [interactive-output.md](interactive-output.md) documents the deprecated
  `2.x` terminal output and progress contracts for migration only. New code
  should follow the application-owned pattern in `output-writers.md`.

## Compatibility And Rework Candidates

Some examples intentionally show public APIs that are useful but not preferred
as the first choice for new application code. Those examples call out the
tradeoff near the method usage.

- [command-resolution.md](command-resolution.md) covers
  `resolveCommandFromArgs(...)`.
- [two-phase-primitives.md](two-phase-primitives.md) covers
  `parseOptionsDetailed(...)` and `parseOptionsSubsetDetailed(...)`.
