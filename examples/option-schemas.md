# Option Schemas

Use option schemas to describe the public arguments of a command. The schema
defines what the user can type in the terminal and what typed values the command
handler receives.

## Start with one command

Put a command close to the application code that owns the command behavior:

```ts
import {
  createCommand,
  type InferOptions
} from 'icore';

const command = createCommand();

const reportOptions = {
  account: {
    type: 'string',
    required: true,
    alias: 'a'
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

type ReportOptions = InferOptions<typeof reportOptions>;

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

The command now accepts one required string option, one string option with
choices, one boolean option, and one bounded number option.

## Run it from the terminal

The user can pass long options:

```bash
node dist/cli.js reports list --account brokerage --format json --archived --limit 5
```

The handler receives:

```json
{
  "account": "brokerage",
  "format": "json",
  "archived": true,
  "limit": 5
}
```

The user can pass declared short aliases:

```bash
node dist/cli.js reports list -a brokerage -l 5
```

The handler receives defaults for options that were not typed:

```json
{
  "account": "brokerage",
  "format": "table",
  "archived": false,
  "limit": 5
}
```

## Use boolean negation

Boolean options can be turned off with `--no-<name>` when the option is known by
the schema:

```bash
node dist/cli.js reports list --account brokerage --archived
node dist/cli.js reports list --account brokerage --no-archived
```

The first command gives the handler `archived: true`; the second gives it
`archived: false`.

Do not pass explicit boolean values:

```bash
node dist/cli.js reports list --account brokerage --archived=true
node dist/cli.js reports list --account brokerage --archived=false
```

Both forms are rejected. Boolean options use flag syntax, not `true` / `false`
values.

## Restrict a boolean to flag-only syntax

Use `syntax: 'flag'` for options that should only mean "enable this behavior":

```ts
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

## Reuse shared schema pieces

When several commands share the same public options, keep small schema pieces
and merge them at the command boundary:

```ts
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

Later schemas override earlier schemas when an option name is repeated. Keep
that behavior intentional and visible near the command definition.
