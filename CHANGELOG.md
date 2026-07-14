# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Historical entries before this file was introduced were reconstructed from npm
publish metadata and local git history. Older entries are intentionally
conservative.

Version boundaries from `1.0.12` through `1.0.19` were checked against npm
`gitHead` metadata and local git history.

## [Unreleased]

## [2.0.0] - 2026-07-14

### Added

- Added reusable terminal error rendering and exit-code policy with prepare,
  execute, render, write, and external phase context.
- Added `TerminalApp.reportError(...)` for caller-owned lifecycle flows that
  need the same stderr and exit-code behavior as `run(...)` and
  `runPrepared(...)`.
- Added `IcoreError.category` to distinguish usage failures from invalid
  command and option definitions.
- Added the public `IcoreErrorDetailsMap`, generic `IcoreErrorDetails<TCode>`,
  and distributed `AnyIcoreError` contracts for code-specific error details.
- Added `isIcoreError(...)` overloads for narrowing any `IcoreError` or one
  exact error code while preserving its details type.

### Changed

- Clarified that extra positionals after a matched command path are rejected
  during prepare unless the command declares `allowExtraPositionals: true`.
- Changed `TerminalApp.run(...)` and `TerminalApp.runPrepared(...)` to share the
  configured terminal error policy while preserving the default error text and
  exit code.
- **Breaking:** changed the `IcoreError` constructor to require code-specific
  `details`; direct callers must now provide the third argument.
- Added explicit variant discriminators to `UNKNOWN_COMMAND`,
  `UNEXPECTED_ARGUMENT`, `EXPECTED_REQUIRED_ARGUMENT`, and
  `INVALID_OPTION_DEFAULT` details.

## [1.0.19]

### Added

- Added `TerminalApp.writePreparedOutput(...)` for rendering and writing already obtained terminal output.
- Added `docs/roadmap.md` for directional project decisions that are not release history.

### Changed

- Changed `createTerminalApp` typing to allow custom command results when consumers run prepared commands themselves.
- Documented the caller-owned flow for command execution results that may be
  lifecycle handles before terminal output is written.
- Documented that terminal string output is written exactly as provided.

## [1.0.18]

### Added

- Added `TerminalApp.runPrepared(...)` for running prepared commands through terminal rendering and output.

### Changed

- Documented the `app.prepare(...)` and `app.runPrepared(...)` flow for applications
  that create and clean up runtime context themselves.

## [1.0.17]

### Changed

- Relaxed `createTerminalApp` typing so command registries with commands
  without `prepare()` hooks and with void payloads compile without adapter casts.

## [1.0.16]

### Added

- Added `createTerminalApp()` as the top-level terminal application composition API.
- Added command mechanics facade: `createCommand()`.
- Added semantic presentation facade: `createPresentation()`.
- Added semantic output facade: `createOutput()` with `output.write(...)` and `output.error(...)`.
- Added terminal-ready command output support: text, async text streams, presentation results, and empty output.
- Added presentation primitives and renderers:
  - `renderJson`
  - `renderCsv`
  - `renderCsvRow`
  - `renderTextTable`
  - `renderPresentationResult`
  - `isPresentationResult`
- Added reusable output writer primitives:
  - `createStdoutWriter`
  - `createStderrWriter`
  - `createBackpressureTextWriter`
- Added typed option subset parsing with `parseOptionsSubsetDetailed`.
- Added guide-style examples for terminal app, command flow, option schemas, presentation, output, and lower-level mechanics.

### Changed

- Documentation was reorganized around `command`, `presentation`, and `output`.
- Examples were grouped by usage level: Terminal Application, Layer Toolkit, Primitive Mechanics.
- Public README now positions `icore` as terminal application mechanics, not only argv parsing.
- Source files were reorganized by framework area: argv, command, options,
  presentation, output, and terminal app.
- Updated tests to run with `fwa --prune`.
- Restored `CHANGELOG.md` to published package contents.

### Removed

- Removed the redundant CLI barrel module.
- Removed the legacy `git-flow.md` document.
- Removed the `prepare` package script.

## [1.0.15]

### Added

- Added `isPreparedCommandName` for narrowing prepared command unions by command name.

### Changed

- Temporarily excluded `CHANGELOG.md` from published package contents.

## [1.0.14]

### Changed

- Preserved prepared command payload correlation when narrowing registry unions.
- Reformatted `CHANGELOG.md` according to Keep a Changelog.

## [1.0.13]

### Added

- Added machine-readable `IcoreError` codes and details.
- Added strict command resolution mode with `strict: true`.
- Added strict mode support to direct `runCommand(...)` calls.
- Added typed prepared command payloads.
- Added `CHANGELOG.md`.

### Changed

- Boolean option handling was tightened to flag syntax only.

## [1.0.12]

### Changed

- Replaced the preliminary `flagOnly` boolean option setting with typed
  `syntax: 'flag'`.

## [1.0.11] - 2026-07-02

### Added

- Added preliminary flag-only boolean option support.

## [1.0.10] - 2026-07-02

### Added

- Added two-phase command execution.
- Added `PreparedCommandInput`.
- Added `PreparedCommand`.
- Added `prepareCommandFromArgs`.
- Added `runPreparedCommand`.
- Added command `metadata`.
- Added command `prepare` hook.
- Added focused tests for prepare-time validation and handler safety.

### Changed

- Changed `runCommand` and `runCommandFromRegistry` to use the prepare-and-run flow internally.

## [1.0.9] - 2026-07-02

### Changed

- Refined npm package metadata.
- Updated repository metadata for npm.
- Simplified published package contents.

## [1.0.8] - 2026-07-02

### Changed

- Updated package author metadata.
- Normalized README heading structure.

## [1.0.7] - 2026-07-02

### Changed

- Renamed README examples from `upper` to `uppercase`.
- Cleaned duplicated command test coverage without changing public behavior.

## [1.0.6] - 2026-07-02

### Added

- Added explicit long boolean values such as `--flag=true` and `--flag=false`.
- Added schema-known boolean negation such as `--no-flag`.
- Added short option aliases such as `-f` and `-n value`.
- Added alias validation and duplicate detection between short and long option forms.
- Documented supported option syntax.

## [1.0.5] - 2026-07-01

### Changed

- Rebuilt README as the main public documentation entry point.

### Removed

- Removed separate generated reference docs from the published documentation flow.

## [1.0.4] - 2026-07-01

### Changed

- Reorganized README and documentation references.

## [1.0.3] - 2026-07-01

### Added

- Added README table of contents.

### Changed

- Polished README formatting and emphasis.

## [1.0.2] - 2026-06-30

### Added

- Added module boundary comments to production source files.

### Changed

- Clarified CLI scope and supported syntax in README.
- Updated package description and keywords.

## [1.0.1] - 2026-06-30

### Changed

- Published documentation updates after the first stable release.
- No dedicated version commit is present in local git history for this patch.

## [1.0.0] - 2026-06-30

### Added

- First stable release of the new `icore` CLI mechanics package.
- Added declarative option parsing and validation.
- Added schema-aware argv parsing.
- Added option presence metadata through `parseOptionsDetailed`.
- Added option schema composition through `mergeOptionsSchema`.
- Added command registry routing.
- Added typed command handler input.
- Added CommonJS package entry points and TypeScript declarations.

### Changed

- Lowered the runtime Node.js engine to `>=16.9.0`.

## [1.0.0-alpha] - 2026-06-28

### Added

- Started the new CLI mechanics codebase after pruning the legacy package code.
- Added the initial TypeScript build, test, and lint setup for the new package.

## [0.1.38] - 2019-06-12

### Added

- Added legacy tests and documentation.

### Changed

- Final legacy web-framework line release.
- Updated the legacy package description.

### Removed

- Trimmed legacy runtime dependencies.

## [0.0.37 and earlier]

### Added

- Original legacy npm package line published between 2017 and 2019.
- Legacy history is preserved for package provenance.

### Changed

- Detailed changelog entries were not maintained for these releases.

[Unreleased]: https://github.com/woodger/icore/commits/develop
[1.0.19]: https://www.npmjs.com/package/icore/v/1.0.19
[1.0.18]: https://www.npmjs.com/package/icore/v/1.0.18
[1.0.17]: https://www.npmjs.com/package/icore/v/1.0.17
[1.0.16]: https://www.npmjs.com/package/icore/v/1.0.16
[1.0.15]: https://www.npmjs.com/package/icore/v/1.0.15
[1.0.14]: https://www.npmjs.com/package/icore/v/1.0.14
[1.0.13]: https://www.npmjs.com/package/icore/v/1.0.13
[1.0.12]: https://www.npmjs.com/package/icore/v/1.0.12
[1.0.11]: https://www.npmjs.com/package/icore/v/1.0.11
[1.0.10]: https://www.npmjs.com/package/icore/v/1.0.10
[1.0.9]: https://www.npmjs.com/package/icore/v/1.0.9
[1.0.8]: https://www.npmjs.com/package/icore/v/1.0.8
[1.0.7]: https://www.npmjs.com/package/icore/v/1.0.7
[1.0.6]: https://www.npmjs.com/package/icore/v/1.0.6
[1.0.5]: https://www.npmjs.com/package/icore/v/1.0.5
[1.0.4]: https://www.npmjs.com/package/icore/v/1.0.4
[1.0.3]: https://www.npmjs.com/package/icore/v/1.0.3
[1.0.2]: https://www.npmjs.com/package/icore/v/1.0.2
[1.0.1]: https://www.npmjs.com/package/icore/v/1.0.1
[1.0.0]: https://www.npmjs.com/package/icore/v/1.0.0
[1.0.0-alpha]: https://www.npmjs.com/package/icore/v/1.0.0-alpha
[0.1.38]: https://www.npmjs.com/package/icore/v/0.1.38
[0.0.37 and earlier]: https://www.npmjs.com/package/icore?activeTab=versions
