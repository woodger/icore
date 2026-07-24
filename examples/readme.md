# Examples

These examples are guide-style notes for application code. They explain what to
put into a consuming project, how to run it from a terminal, what output to
expect, and why a particular shape is useful or intentionally limited.

## Terminal Application

- [terminal-app.md](terminal-app.md) shows the regular `createTerminalApp()`
  path with commands, presentation, and output.
- [practical-cli-patterns.md](practical-cli-patterns.md) shows application-level
  patterns for global help/version shortcuts, command help, deprecated options,
  and edge-case argument handling.

## Layer Toolkit

- [option-schemas.md](option-schemas.md) shows how to describe string,
  boolean, and number options with defaults, choices, aliases, and inferred
  TypeScript types.
- [cli-argument-syntax.md](cli-argument-syntax.md) documents supported CLI
  argument syntax with terminal input examples.
- [custom-command-flow.md](custom-command-flow.md) shows explicit
  `commands.prepare(...)`, `commands.run(...)`, and `commands.runFromArgs(...)`
  usage without the terminal app boundary.
- [presentation-output.md](presentation-output.md) shows presentation rendering
  and output writing without command execution.
- [interactive-output.md](interactive-output.md) shows shared output queues,
  terminal line capabilities, generic progress, and error-lifecycle ordering.

## Primitive Mechanics

- [command-resolution.md](command-resolution.md) shows command registries,
  explicit resolution, command-name guards, and standalone command definitions.
- [two-phase-primitives.md](two-phase-primitives.md) shows lower-level
  preparation and execution primitives used behind command facades.
- [presentation-primitives.md](presentation-primitives.md) shows explicit
  presentation views, renderers, and format guards.
- [output-writers.md](output-writers.md) shows stdout/stderr writer primitives
  and custom sink wiring.

## Compatibility And Rework Candidates

Some examples intentionally show public APIs that are useful but not preferred
as the first choice for new application code. Those examples call out the
tradeoff near the method usage.

- [command-resolution.md](command-resolution.md) covers
  `resolveCommandFromArgs(...)`.
- [two-phase-primitives.md](two-phase-primitives.md) covers
  `parseOptionsDetailed(...)` and `parseOptionsSubsetDetailed(...)`.
