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

## Legacy interactive terminal output and progress

- `createOutput()` is the supported output boundary. Interactive line output,
  progress state, rendering, non-TTY policy, process signals, and resource
  lifecycle belong to the consuming application.
- `createTerminalOutput()` and `createTerminalProgress()` are frozen `2.x`
  compatibility exports. They are not used by the ecosystem Consumers and
  receive no new capabilities.
- The next major release removes the legacy root exports and adds an explicit
  package `exports` map so internal terminal modules are not a replacement
  public API.
- A separate `icore-terminal` package is not planned until at least two
  Consumers require the same stable interactive contract.

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

## Presentation result scope

- `record(...)` and `records(...)` are intended for one flat projection shared
  by JSON, table, and CSV output.
- When formats need different projections, the consuming application owns
  those projections and selects the corresponding direct renderer.
- A multi-format presentation result is not planned for now. Reconsider it only
  if the same requirement appears independently in another Consumer.

## Not planned

- Declarative positional schemas and `string-list` positional parsing are not
  planned for now. Keep list normalization, comma splitting, dedupe, and
  domain-specific validation in the consuming application. Reconsider only if
  the same positional mechanics appear across multiple generic CLI use cases.
