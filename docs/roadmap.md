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
- `IcoreErrorDetailsMap` is the public source of truth for structured details;
  semantic variants use explicit discriminators instead of unrelated optional
  fields.
- `isIcoreError(...)` is the supported narrowing boundary for keeping an error
  code correlated with its details type.

## Not planned

- Declarative positional schemas and `string-list` positional parsing are not
  planned for now. Keep list normalization, comma splitting, dedupe, and
  domain-specific validation in the consuming application. Reconsider only if
  the same positional mechanics appear across multiple generic CLI use cases.
