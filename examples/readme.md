# Examples

These examples are guide-style notes for application code. They show what to
put into a consuming project, how to run it from a terminal, and what output to
expect.

- [terminal-app.md](terminal-app.md) shows the regular `createTerminalApp()`
  path with commands, presentation, and output.
- [custom-command-flow.md](custom-command-flow.md) shows explicit
  `commands.prepare(...)`, `commands.run(...)`, and `commands.runFromArgs(...)`
  usage without the terminal app boundary.
- [presentation-output.md](presentation-output.md) shows presentation rendering
  and output writing without command execution.
