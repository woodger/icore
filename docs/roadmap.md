# Roadmap

This document records directional decisions that are useful for contributors but
are not release changes. Release history belongs in `CHANGELOG.md`.

## Terminal error reporting

- Terminal error rendering and exit-code selection use the reusable policy
  contract defined in [`src/terminal/app.ts`](../src/terminal/app.ts).
- Built-in terminal app execution and caller-owned lifecycle flows share that
  policy through `TerminalApp.reportError(...)`.
- Error phase context distinguishes prepare, execute, render, write, and
  external failures without assigning application-specific meaning to them.
- Help text remains application policy; `icore` only provides the extension
  point used to render it.
- `IcoreError` categories distinguish command-line usage failures from invalid
  command and option definitions.
- Application-owned semantic validation uses `CliUsageError`;
  `isUsageError(...)` recognizes it together with usage-category `IcoreError`
  instances without moving validation rules or exit-code policy into `icore`.
- `IcoreErrorDetailsMap` is the public source of truth for structured details;
  semantic variants use explicit discriminators instead of unrelated optional
  fields.
- `isIcoreError(...)` is the supported narrowing boundary for keeping an error
  code correlated with its details type.

## Interactive terminal output

- One `createTerminalOutput()` instance owns stdout and stderr for a complete
  CLI invocation.
- Semantic output and interactive line operations share a serialized stdout
  queue. Stderr has an independent queue.
- `flush()` is a point-in-time barrier, and the first write failure is sticky.
- Generic progress owns derived percentage and ETA values, redraw throttling,
  plain-text rendering, line restoration, and asynchronous close.
- Applications retain domain-event mapping, labels, non-TTY policy, process
  signals, and resource lifecycle.
- Progress must close before final stdout output or stderr diagnostics.
- Terminal width adaptation intentionally supports single-line plain text only;
  ANSI-styled and display-width-aware Unicode output are outside the contract.

## Command path aliases

- Command definitions own one canonical `path` and may declare alternative
  `aliases`.
- `name` and `path` preserve canonical command identity; `matchedPath` records
  the canonical or alias path used for one resolution.
- Canonical and alias paths share collision validation and longest-path
  resolution.
- Non-strict raw resolution parses each canonical definition at most once,
  even when that definition owns multiple accepted paths.
- Strict mode matches canonical and alias paths before parsing, but continues
  to require command-first argv. Bootstrap parsing does not make option-first
  argv strict-compatible unless the application also reorders or rejects it.

## Not planned

- Declarative positional schemas and `string-list` positional parsing are not
  planned for now. Keep list normalization, comma splitting, dedupe, and
  domain-specific validation in the consuming application. Reconsider only if
  the same positional mechanics appear across multiple generic CLI use cases.
