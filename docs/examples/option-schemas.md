# Define Command Options

English | [Русский](../ru/examples/option-schemas.md) | [简体中文](../zh/examples/option-schemas.md)

Use an option definition to describe a command's public arguments. It states what a user can type in the terminal and which typed values the function that runs the command receives.

The option definition covers strings, booleans, numbers, and their validation rules. Application-specific parsing stays in the application, along with its business rules.

## Start with one command

Put a command near the application code that implements it:

For most commands, this is clearer than a central file containing every option. A reader can see the command-line interface and the function that runs the command together.

Example command:

```bash
node dist/cli.js reports list --project alpha --format json --archived --limit 5
```

The following shows how `reports list` and its options are parsed:

```ts
// Describe the options accepted by `reports list`.
import { createCommand, type InferOptions } from 'icore';

// Get the command function type.
type ReportOptions = InferOptions<typeof reportOptions>;

const command = createCommand();

const reportOptions = {
  project: {
    type: 'string',
    required: true,
    alias: 'p'
  },
  format: {
    type: 'string',
    choices: ['table', 'json', 'csv'],
    default: 'table'
  },
  archived: {
    type: 'boolean',
    default: false
  },
  limit: {
    type: 'number',
    integer: true,
    min: 1,
    max: 100,
    default: 20,
    alias: 'l'
  }
} as const;

const reportCommand = command.define({
  path: ['reports', 'list'],
  options: reportOptions,
  handle({ options }: {
    options: ReportOptions;
  }) {
    return JSON.stringify(options, null, 2) + '\n';
  }
});
```

For that command line, the command function receives:

```json
{
  "project": "alpha",
  "format": "json",
  "archived": true,
  "limit": 5
}
```

The command accepts one required string, one string limited to listed values, one boolean, and one number within a range.

`as const` preserves the listed string values for [TypeScript](https://www.typescriptlang.org/) inference. Without it, the command still runs, but [TypeScript](https://www.typescriptlang.org/) infers a broader and less useful type.

## Share Types Used By Every Command

Use `createCommand.withTypes<...>()` only when every command uses the same types for:

- `context`: a value received by the command function;
- `result`: the value returned by that function;
- `metadata`: static command information, such as its description.

```ts
// Share these types only when every command uses them.
import { createCommand } from 'icore';

type CliCommandContext = {
  requestId: string;
};

type CliCommandResult = string | void;

type CliCommandMetadata = {
  description: string;
};

const command = createCommand.withTypes<{
  context: CliCommandContext;
  result: CliCommandResult;
  metadata: CliCommandMetadata;
  metadataRequired: true;
}>();

const statusCommand = command.define({
  path: ['system', 'status'],
  aliases: [
    ['health']
  ],
  options: {
    verbose: {
      type: 'boolean',
      default: false
    }
  },
  metadata: {
    description: 'Show system status'
  },
  prepare({ options }) {
    return {
      prefix: options.verbose ? 'System status' : 'Status'
    };
  },
  handle({ context, payload }) {
    return `${payload.prefix} (${context.requestId})\n`;
  }
});
```

The `result` type is only the broadest result the application allows. [TypeScript](https://www.typescriptlang.org/) still infers this example function as returning `string`, rather than `string | void`. Its option definition, command name, aliases, and prepared data also remain specific to `statusCommand`.

Do not set `metadataRequired` when a command may omit `metadata`. The setting affects only definitions created by this typed builder; ordinary `createCommand()` calls and other builders are unchanged.

When the application has no shared `metadata`, use `metadata: undefined` in the type arguments and omit `metadataRequired`. This makes that choice explicit without requiring a `metadata` property on every command.

The type arguments describe separate values used by the application. If `metadata` depends on a command's exact options, check that relationship on the command with `satisfies` or keep a small wrapper in the application. The builder does not create values for `context`, database connections, API clients, signal handlers, or long-running work; the application does that itself.

## Run it from the terminal

The same command also accepts declared short aliases:

```bash
node dist/cli.js reports list -p alpha -l 5
```

The command function receives default values for options the user did not provide:

```json
{
  "project": "alpha",
  "format": "table",
  "archived": false,
  "limit": 5
}
```

Defaults are part of the command-line interface. Use them only when the implicit value is obvious and safe.

## Use boolean negation

A known boolean option can be turned off with `--no-<name>`:

```bash
node dist/cli.js reports list --project alpha --archived
node dist/cli.js reports list --project alpha --no-archived
```

The first command function receives `archived: true`; the second receives `archived: false`.

This form is more explicit than accepting `--archived=false`. It also avoids ambiguous text values such as `0`, `no`, or `off`.

Explicit `true` and `false` values for boolean options are **not supported**:

```bash
node dist/cli.js reports list --project alpha --archived=true
node dist/cli.js reports list --project alpha --archived=false
```

Both forms are rejected. Boolean options use flag syntax, not `true` / `false` values.

## Restrict a boolean to flag-only syntax

Use `syntax: 'flag'` for options that should only mean "enable this behavior":

This is stricter. It suits options such as `--dry-run`, where the flag being absent already has a clear meaning.

```ts
// Accept only the flag form for this option.
const schema = {
  'dry-run': {
    type: 'boolean',
    default: false,
    syntax: 'flag'
  }
} as const;
```

The terminal accepts:

```bash
node dist/cli.js reports list --dry-run
```

The terminal rejects:

```bash
node dist/cli.js reports list --no-dry-run
node dist/cli.js reports list --dry-run=false
```

## Reuse Shared Option Definitions

When several commands use the same public options, keep small option definitions and merge them where the command is defined:

This avoids duplication without hiding what is specific to a command. Keep an option definition local when reuse would require many exceptions.

```ts
// Combine reusable paging options with reusable output options.
import { mergeOptionsSchema } from 'icore';

const pagingOptions = {
  limit: {
    type: 'number',
    integer: true,
    min: 1,
    max: 100,
    default: 20
  }
} as const;

const outputOptions = {
  format: {
    type: 'string',
    choices: ['table', 'json', 'csv'],
    default: 'table'
  }
} as const;

const options = mergeOptionsSchema(pagingOptions, outputOptions);
```

When an option name is repeated, the later definition replaces the earlier one. Keep that choice visible near the command definition.

For applications with shared options, global help or version flags, and older option names, see [Common CLI Patterns](practical-cli-patterns.md).
