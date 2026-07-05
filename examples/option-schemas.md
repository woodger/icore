# Option Schemas

Use option schemas to describe the public arguments of a command. The schema
defines what the user can type in the terminal and what typed values the command
handler receives.

The schema is deliberately small: it covers primitive CLI types and validation
rules, while application-specific parsing stays in the application. That keeps
icore reusable and prevents domain rules from leaking into command mechanics.

## Start with one command

Put a command close to the application code that owns the command behavior:

This is preferable to a central "all options" file for most commands. The
person reading the command can see the public CLI contract and the handler
together.

```ts
import {
  createCommand,
  type InferOptions
} from 'icore';

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

The `as const` is important because it preserves literal choices for TypeScript
inference. Without it, the handler would still work at runtime, but the inferred
type would be wider and less useful.

## Run it from the terminal

The user can pass long options:

```bash
node dist/cli.js reports list --project alpha --format json --archived --limit 5
```

The handler receives:

```json
{
  "project": "alpha",
  "format": "json",
  "archived": true,
  "limit": 5
}
```

The user can pass declared short aliases:

```bash
node dist/cli.js reports list -p alpha -l 5
```

The handler receives defaults for options that were not typed:

```json
{
  "project": "alpha",
  "format": "table",
  "archived": false,
  "limit": 5
}
```

Defaults are useful for stable command behavior, but they are also part of the
public contract. Prefer defaults only when the implicit value is obvious and
safe.

## Use boolean negation

Boolean options can be turned off with `--no-<name>` when the option is known by
the schema:

```bash
node dist/cli.js reports list --project alpha --archived
node dist/cli.js reports list --project alpha --no-archived
```

The first command gives the handler `archived: true`; the second gives it
`archived: false`.

This form is more explicit than accepting `--archived=false`. It also avoids
ambiguous text values such as `0`, `no`, or `off`.

Do not pass explicit boolean values:

```bash
node dist/cli.js reports list --project alpha --archived=true
node dist/cli.js reports list --project alpha --archived=false
```

Both forms are rejected. Boolean options use flag syntax, not `true` / `false`
values.

## Restrict a boolean to flag-only syntax

Use `syntax: 'flag'` for options that should only mean "enable this behavior":

This is a stricter contract. It is a good fit for options like `--dry-run`,
where the absence of the flag already has a clear meaning.

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

When several commands reuse the same public options, keep small schema pieces
and merge them at the command boundary:

This reduces duplication without hiding command-specific intent. It becomes a
bad abstraction when the reusable schema needs many exceptions for individual
commands.

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

For larger application patterns that combine shared schemas, global shortcuts,
and compatibility options, see
[practical-cli-patterns.md](practical-cli-patterns.md).
