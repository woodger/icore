# Design Notes

## Purpose

`icore` is a small CLI mechanics module. It standardizes command definitions,
argument parsing, primitive option validation, command registry resolution, and
typed command handler input.

It intentionally stops before application behavior. Your application still
owns business validation, API request mapping, SDK calls, process lifecycle,
and output formatting.

## Why icore?

Use `icore` when you need more than raw argument parsing:

- typed command definitions;
- command registry resolution;
- required options;
- string choices;
- number parsing with integer, minimum, and maximum constraints;
- option presence metadata;
- typed command handler input.

Use [`node:util.parseArgs`](https://nodejs.org/api/util.html#utilparseargsconfig)
directly when you only need low-level argument parsing.

## Non-goals

`icore` stops at CLI mechanics. It does not build API DTOs, call SDKs, format
output, manage process lifecycle, or validate business rules.

It also does not handle:

- provider-specific request modes;
- generated contract mapping;
- mutually exclusive application modes;
- presentation formatting as JSON, tables, CSV, or another application format;
- database, HTTP, gRPC, or SDK lifecycle management.

Keep those decisions near the command handler or in your application layer.

## Supported Syntax

| Syntax | Supported | Notes |
|---|---:|---|
| `--name value` | yes | string and number options |
| `--name=value` | yes | string and number options |
| `--flag` | yes | boolean options |
| `--flag=true` | no | boolean options are flag-only |
| `-f` | no | short aliases are not supported |
| `--no-cache` | no | negative boolean flags are not supported |
| repeated options | no | duplicates are rejected |
| multiple values | no | arrays are not supported |

## Design Goals

- describe CLI mechanics declaratively;
- use literal option types: `type: 'string' | 'boolean' | 'number'`;
- keep handlers free from repetitive option parsing;
- keep domain and API semantics outside the framework;
- provide predictable user-facing errors;
- avoid runtime dependencies.

## Project Boundary

Good responsibilities for `icore`:

- option schema evaluation;
- command path checking;
- common argument errors;
- typed command handler input.

Responsibilities that should stay outside `icore`:

- business validation;
- SDK lifecycle management;
- provider-specific request modes;
- generated contract mapping;
- presentation formatting.
