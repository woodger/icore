# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Historical entries before this file was introduced were reconstructed from npm
publish metadata and local git history. Older entries are intentionally
conservative.

Version boundaries between `1.0.12` and `1.0.15` are draft-level and should be
verified against git tags.

## [Unreleased]

### Added

- Added `TerminalApp.runPrepared(...)` for running prepared commands through terminal rendering and output.

### Changed

- Changed `createTerminalApp` typing to accept command registries with void and prepared payloads.
- Updated testing instructions to use `yarn build` and `yarn test`.

## [1.0.16]

### Added

- Added `createTerminalApp()` as the top-level terminal application composition API.
- Added semantic presentation facade: `createPresentation()`.
- Added semantic output facade: `createOutput()` with `output.write(...)` and `output.error(...)`.
- Added terminal-ready command output support: text, async text streams, presentation results, and empty output.
- Added guide-style examples for terminal app, command flow, option schemas, presentation, output, and lower-level mechanics.

### Changed

- Documentation was reorganized around `command`, `presentation`, and `output`.
- Examples were grouped by usage level: Terminal Application, Layer Toolkit, Primitive Mechanics.
- Public README now positions `icore` as terminal application mechanics, not only argv parsing.

## [1.0.15]

### Added

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

### Changed

- Extracted generic JSON/CSV/table rendering mechanics from project-specific CLI code.

## [1.0.14]

### Added

- Added command mechanics facade: `createCommand()`.
- Added command registry flow:
  - `command.define(...)`
  - `command.registry(...)`
  - `commands.prepare(...)`
  - `commands.run(...)`
  - `commands.runFromArgs(...)`
- Added lower-level command primitives:
  - `defineCommand`
  - `defineCommandRegistry`
  - `createCommands`
  - `resolveCommand`
  - `prepareCommandFromArgs`
  - `runPreparedCommand`
  - `runCommandFromRegistry`
  - `runCommand`

### Changed

- CLI command execution became explicitly two-phase: prepare without runtime context, then run with context.

## [1.0.13]

### Added

- Added typed option schema composition with `mergeOptionsSchema`.
- Added option inference helpers for parsed values and provided metadata.
- Added command-name guards:
  - `isCommandName`
  - `isPreparedCommandName`
- Added detailed option parsing contracts for cases where caller needs explicit provided/not-provided metadata.

### Changed

- Boolean option handling was tightened around flag syntax: `--flag` and `--no-flag`.

## [1.0.12]

### Added

- Added core typed CLI option mechanics based on literal schemas:
  - `type: 'string'`
  - `type: 'boolean'`
  - `type: 'number'`
- Added GNU-style argv parsing:
  - `--name value`
  - `--name=value`
  - `--flag`
  - short aliases
  - `--` terminator
- Added machine-readable `IcoreError`.
- Added initial TypeScript-first public API for command-line mechanics.

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
