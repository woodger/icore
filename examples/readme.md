# Examples

These examples are guide-style notes for application code. They show what to
put into a consuming project, how to run it from a terminal, and what output to
expect.

- [terminal-app.md](terminal-app.md) shows the regular `createTerminalApp()`
  path with commands, presentation, and output.
- [option-schemas.md](option-schemas.md) shows how to describe string,
  boolean, and number options with defaults, choices, aliases, and inferred
  TypeScript types.
- [cli-argument-syntax.md](cli-argument-syntax.md) documents supported CLI
  argument syntax with terminal input examples.
- [practical-cli-patterns.md](practical-cli-patterns.md) shows application-level
  patterns for global help/version shortcuts, command help, deprecated options,
  and edge-case argument handling.
- [custom-command-flow.md](custom-command-flow.md) shows explicit
  `commands.prepare(...)`, `commands.run(...)`, and `commands.runFromArgs(...)`
  usage without the terminal app boundary.
- [presentation-output.md](presentation-output.md) shows presentation rendering
  and output writing without command execution.
