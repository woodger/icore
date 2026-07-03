# Changelog

All notable user-facing changes to this package are documented here.

This file was reconstructed from npm publish metadata and local git history.
Older releases did not have a maintained changelog, so early entries are
intentionally conservative.

## 1.0.13 - Unreleased

### Added

- Added machine-readable `IcoreError` codes and details.
- Added opt-in `strict: true` command resolution for rejecting options before command paths.
- Added `strict: true` support to direct `runCommand` execution.
- Added typed prepared command `payload` returned from `prepare` and passed to `handle`.
- Added this changelog.

### Changed

- Boolean options reject explicit values such as `--flag=true` and `--flag=false`; use `--flag` and `--no-flag`.

## 1.0.12 - 2026-07-02

- Replaced the preliminary flag-only boolean option naming with `syntax: 'flag'`.
- Documented flag-only boolean option behavior.

## 1.0.11 - 2026-07-02

- Added preliminary flag-only boolean option support.

## 1.0.10 - 2026-07-02

- Added two-phase command execution.
- Added `PreparedCommandInput`.
- Added `PreparedCommand`.
- Added `prepareCommandFromArgs`.
- Added `runPreparedCommand`.
- Added command `metadata`.
- Added command `prepare` hook.
- Changed `runCommand` and `runCommandFromRegistry` to use the prepare-and-run flow internally.
- Added focused tests for prepare-time validation and handler safety.

## 1.0.9 - 2026-07-02

- Refined npm package metadata.
- Updated repository metadata for npm.
- Simplified published package contents.

## 1.0.8 - 2026-07-02

- Updated package author metadata.
- Normalized README heading structure.

## 1.0.7 - 2026-07-02

- Renamed README examples from `upper` to `uppercase`.
- Cleaned duplicated command test coverage without changing public behavior.

## 1.0.6 - 2026-07-02

- Added explicit long boolean values such as `--flag=true` and `--flag=false`.
- Added schema-known boolean negation such as `--no-flag`.
- Added short option aliases such as `-f` and `-n value`.
- Added alias validation and duplicate detection between short and long option forms.
- Documented supported option syntax.

## 1.0.5 - 2026-07-01

- Rebuilt README as the main public documentation entry point.
- Removed separate generated reference docs from the published documentation flow.

## 1.0.4 - 2026-07-01

- Reorganized README and documentation references.

## 1.0.3 - 2026-07-01

- Added README table of contents.
- Polished README formatting and emphasis.

## 1.0.2 - 2026-06-30

- Clarified CLI scope and supported syntax in README.
- Added module boundary comments to production source files.
- Updated package description and keywords.

## 1.0.1 - 2026-06-30

- Published documentation updates after the first stable release.
- No dedicated version commit is present in local git history for this patch.

## 1.0.0 - 2026-06-30

- First stable release of the new `icore` CLI mechanics package.
- Added declarative option parsing and validation.
- Added schema-aware argv parsing.
- Added option presence metadata through `parseOptionsDetailed`.
- Added option schema composition through `mergeOptionsSchema`.
- Added command registry routing.
- Added typed command handler input.
- Added CommonJS package entry points and TypeScript declarations.
- Lowered the runtime Node.js engine to `>=16.9.0`.

## 1.0.0-alpha - 2026-06-28

- Started the new CLI mechanics codebase after pruning the legacy package code.
- Added the initial TypeScript build, test, and lint setup for the new package.

## 0.1.38 - 2019-06-12

- Final legacy web-framework line release.
- Added legacy tests and documentation.
- Updated the legacy package description.
- Trimmed legacy runtime dependencies.

## 0.0.37 and earlier

- Original legacy npm package line published between 2017 and 2019.
- Legacy history is preserved for package provenance.
- Detailed changelog entries were not maintained for these releases.
