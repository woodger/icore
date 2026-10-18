# Roadmap

This document records directional decisions that are useful for contributors but are not release changes. Release history belongs in `CHANGELOG.md`.

## Terminal error reporting

- Terminal error rendering and exit-code selection use the reusable policy contract defined in [`src/terminal/app.ts`](https://github.com/woodger/icore/blob/main/src/terminal/app.ts).
- Built-in terminal execution and application code that creates and closes its own resources use that policy through `TerminalApp.reportError(...)`.
- The error phase says whether a failure happened while preparing, running, formatting, writing, or in application code outside the terminal app. It does not assign application-specific meaning to failures.
- Help text remains application policy; `icore` only provides the extension point used to render it.
- `IcoreError` categories distinguish command-line usage failures from invalid command and option definitions.
- Application-owned semantic validation uses `CliUsageError`; `isUsageError(...)` recognizes it together with usage-category `IcoreError` instances without moving validation rules or exit-code policy into `icore`.
- `IcoreErrorDetailsMap` is the public source of truth for structured details; semantic variants use explicit discriminators instead of unrelated optional fields.
- `isIcoreError(...)` is the public type guard for an error code and its matching details type.
- `isIcoreError(...)` and `isUsageError(...)` recognize compatible branded errors from duplicate package copies through own properties keyed by their respective shared `Symbol.for(...)` symbols.
- Serialized errors crossing JSON, IPC, or worker boundaries require a separate application protocol; in-process error guards do not reconstruct them.

## Interactive terminal output and progress

- `createOutput()` is the supported way to write regular output. The application owns interactive lines, progress rendering, behavior outside a terminal, process signals, and resource creation and cleanup.
- A separate `icore-terminal` package is not planned until at least two applications need the same stable interactive API.

## Alternate Command Names

- Command definitions own one main `path` and may declare alternative `aliases`.
- `name` and `path` identify the main command; `matchedPath` records the main or alternate path used for one lookup.
- Main and alternate paths share collision validation and longest-path resolution.
- Non-strict raw resolution parses each main definition at most once, even when that definition owns multiple accepted paths.
- Strict mode matches main and alternate paths before parsing, but still requires the command name first. Parsing global options does not make option-first arguments valid in strict mode unless the application also reorders or rejects them.

## Output Formats

- `record(...)` and `records(...)` are intended when JSON, table, and CSV use the same top-level fields.
- When formats need different fields or formatting, the application supplies the data for each format and selects the matching direct renderer.
- A multi-format presentation result is not planned for now. Reconsider it only if the same requirement appears independently in another application.

## Not planned

- Declarative positional schemas and `string-list` positional parsing are not planned for now. Keep list normalization, comma splitting, dedupe, and domain-specific validation in the application. Reconsider only if the same positional mechanics appear in more than one application.
