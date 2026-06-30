# icore

Declarative command line interface mechanics for Node.js.

`icore` helps describe CLI commands with small option schemas and keeps command
handlers focused on application work. It standardizes argument parsing,
primitive option validation, defaults, choices, numeric ranges, and positional
argument checks. It can also resolve commands from a registry and report whether
each option was provided explicitly by the user or filled from a default.

### How it works?

![yuml diagram](http://yuml.me/diagram/scruffy;dir:LR;/class/[*argv*%20{bg:gray}|External;users%20get%20--limit%2010%20--json]->[*matches*%20{bg:lavender}|System;parse,%20resolve,%20validate,%20infer]->[*typed%20result*%20{bg:honeydew}|Container;command=users/get;%20limit=10;%20json=true]->[*your%20app*%20{bg:cornsilk}|System;business%20logic%20and%20output])

It does not try to model your business domain. API calls, request building,
response mapping, and output formatting should stay in the application that uses
`icore`.

## Installation

```sh
npm install icore
```

## Requirements

- Node.js `>=20.19.0`
- TypeScript is supported through bundled declaration files.

## Basic Usage

```ts
import { defineCommand, runCommand } from 'icore';

const command = defineCommand({
  path: ['users', 'get-accounts'],
  options: {
    format: {
      type: 'string',
      choices: ['json', 'table'],
      default: 'table'
    },
    insecure: {
      type: 'boolean'
    }
  },
  async handle({ options, context }) {
    const response = await context.sdk.users.getAccounts({});

    return context.formatAccounts(response.accounts, options.format);
  }
});

const output = await runCommand(
  command,
  ['users', 'get-accounts', '--format', 'json'],
  {
    sdk,
    formatAccounts
  }
);
```

The command handler receives parsed options, user-provided option metadata,
remaining positionals, and caller provided context.

## Design Goals

- describe CLI mechanics declaratively;
- use literal option types: `type: 'string' | 'boolean' | 'number'`;
- keep handlers free from repetitive option parsing;
- keep domain and API semantics outside the framework;
- provide predictable user-facing errors;
- avoid runtime dependencies.

## What icore Handles

`icore` handles generic CLI mechanics:

- parsing long options;
- validating known options;
- rejecting duplicated options;
- checking required options;
- applying and validating defaults;
- validating string choices;
- validating boolean flag form;
- composing option schemas;
- defining command registries;
- resolving commands by path;
- preserving user-provided option metadata;
- parsing numbers;
- validating integer, minimum, and maximum numeric constraints;
- checking command path and extra positional arguments.

## What icore Does Not Handle

`icore` intentionally does not handle application-specific behavior:

- building API request DTOs;
- calling SDKs or network clients;
- managing database, HTTP, or gRPC lifecycle;
- checking business invariants such as `from <= to`;
- resolving mutually exclusive command modes;
- formatting output as JSON, tables, CSV, or other application formats.

Keep those decisions near the command handler or in your application layer.

## Option Schemas

Options are described as plain objects.

Option names are exact. `icore` does not normalize camelCase to kebab-case or
kebab-case to camelCase. Use quoted object keys when your public CLI option
contains `-`.

### String Options

```ts
const schema = {
  token: {
    type: 'string',
    required: true
  },
  format: {
    type: 'string',
    choices: ['json', 'table'],
    default: 'table'
  }
} as const;
```

String options reject missing required values, blank strings, boolean flag form,
and values outside `choices`.

### Boolean Options

```ts
const schema = {
  insecure: {
    type: 'boolean'
  }
} as const;
```

Boolean options accept flag form only:

```sh
--insecure
```

Explicit values are rejected:

```sh
--insecure true
--insecure=true
```

### Number Options

```ts
const schema = {
  limit: {
    type: 'number',
    integer: true,
    min: 1,
    max: 1000,
    default: 100
  }
} as const;
```

Number options parse decimal numeric values and can validate integer and range
constraints. Defaults are validated with the same rules as user-provided values.

## API

### `parseArgv(args, schema?)`

Parses raw CLI arguments into positionals and raw option values.

```ts
import { parseArgv } from 'icore';

const argv = parseArgv([
  'users',
  'get-accounts',
  '--format=json',
  '--insecure'
]);
```

Result:

```ts
{
  positionals: ['users', 'get-accounts'],
  options: {
    format: 'json',
    insecure: true
  }
}
```

When an option schema is provided, boolean options are parsed as flag-only
options without consuming the following positional argument:

```ts
const argv = parseArgv([
  'users',
  'get-accounts',
  '--insecure',
  'extra'
], {
  insecure: {
    type: 'boolean'
  }
});
```

Result:

```ts
{
  positionals: ['users', 'get-accounts', 'extra'],
  options: {
    insecure: true
  }
}
```

### `parseOptions(schema, values)`

Validates raw option values using an option schema and returns typed options.

```ts
import { parseOptions } from 'icore';

const options = parseOptions({
  format: {
    type: 'string',
    choices: ['json', 'table'],
    default: 'table'
  },
  depth: {
    type: 'number',
    integer: true,
    min: 1,
    required: true
  }
} as const, {
  depth: '10'
});
```

Result:

```ts
{
  format: 'table',
  depth: 10
}
```

### `parseOptionsDetailed(schema, values)`

Validates raw option values and returns parsed options together with
user-provided metadata.

```ts
import { parseOptionsDetailed } from 'icore';

const result = parseOptionsDetailed({
  token: {
    type: 'string',
    required: true
  },
  format: {
    type: 'string',
    choices: ['json', 'table'],
    default: 'table'
  }
} as const, {
  token: 'secret'
});
```

Result:

```ts
{
  options: {
    token: 'secret',
    format: 'table'
  },
  provided: {
    token: true,
    format: false
  }
}
```

`provided` is useful when a default value and an omitted option have different
application-level meaning.

### `defineCommand(command)`

Defines a command while preserving its option schema types.

```ts
import { defineCommand } from 'icore';

const command = defineCommand({
  path: ['marketdata', 'get-order-book'],
  options: {
    'instrument-id': {
      type: 'string',
      required: true
    },
    depth: {
      type: 'number',
      integer: true,
      min: 1,
      required: true
    },
    format: {
      type: 'string',
      choices: ['json', 'table'],
      default: 'table'
    }
  },
  async handle({ options, context }) {
    const response = await context.sdk.marketdata.getOrderBook({
      instrumentId: options['instrument-id'],
      depth: options.depth
    });

    return context.formatOrderBook(response, options.format);
  }
});
```

### `defineCommandRegistry(commands)`

Defines a command registry while preserving literal command path types.

```ts
import { defineCommandRegistry } from 'icore';

const registry = defineCommandRegistry([
  usersGetAccountsCommand,
  marketdataGetOrderBookCommand
] as const);
```

The registry exposes ordered commands and derived command names:

```ts
registry.commandNames;
```

Result:

```ts
[
  'users get-accounts',
  'marketdata get-order-book'
]
```

Duplicate command paths are rejected.

### `isCommandName(registry, value)`

Checks whether an unknown value is a command name registered in the registry.

```ts
if (isCommandName(registry, value)) {
  // value is narrowed to the registry command name union.
}
```

### `resolveCommand(registry, positionals)`

Resolves a command from already parsed positional arguments.

```ts
import { resolveCommand } from 'icore';

const resolved = resolveCommand(registry, [
  'users',
  'get-accounts',
  'extra'
]);
```

Result:

```ts
{
  name: 'users get-accounts',
  path: ['users', 'get-accounts'],
  command: usersGetAccountsCommand,
  positionals: ['extra']
}
```

When several command paths match, the most specific command wins. For example,
`users get-accounts` is preferred over `users`.

### `resolveCommandFromArgs(registry, args)`

Resolves a command from raw CLI arguments. Each candidate command is parsed with
its own option schema, so boolean flags do not accidentally consume command path
segments.

```ts
const resolved = resolveCommandFromArgs(registry, [
  '--verbose',
  'users',
  'get-accounts'
]);
```

### `runCommandFromRegistry(registry, args, context)`

Resolves a command from a registry and runs its handler.

```ts
const output = await runCommandFromRegistry(
  registry,
  ['users', 'get-accounts', '--format', 'json'],
  context
);
```

This is registry-level mechanics only. Application-specific setup, API request
building, and output formatting still belong outside `icore`.

### `mergeOptionsSchema(...schemas)`

Merges multiple option schemas while preserving literal option definition types.
Later schemas override earlier schemas with the same option name.

```ts
import { mergeOptionsSchema } from 'icore';

const sdkOptions = {
  token: {
    type: 'string',
    required: true
  }
} as const;

const formatOptions = {
  format: {
    type: 'string',
    choices: ['json', 'table'],
    default: 'table'
  }
} as const;

const options = mergeOptionsSchema(sdkOptions, formatOptions);
```

### `runCommand(command, args, context)`

Parses arguments, validates options, checks command positionals, and runs the
handler.

```ts
const output = await runCommand(
  command,
  [
    'marketdata',
    'get-order-book',
    '--instrument-id',
    'instrument-id',
    '--depth',
    '10'
  ],
  context
);
```

By default, extra positionals are rejected. A command can opt in to extra
positionals with `allowExtraPositionals: true`.

## Type Inference

Use `InferOptions` when you need the parsed option type explicitly.

```ts
import type { InferOptions } from 'icore';

const schema = {
  format: {
    type: 'string',
    choices: ['json', 'table'],
    default: 'table'
  },
  dryRun: {
    type: 'boolean'
  }
} as const;

type Options = InferOptions<typeof schema>;
```

`Options` is equivalent to:

```ts
type Options = {
  format: 'json' | 'table';
  dryRun: boolean | undefined;
};
```

Required options and options with defaults are always present. Optional options
without defaults are returned as `T | undefined`.

Use `InferProvidedOptions` when you need the option presence type explicitly.

```ts
import type { InferProvidedOptions } from 'icore';

type Provided = InferProvidedOptions<typeof schema>;
```

`Provided` maps every schema option to `boolean`. `true` means the user
specified that option explicitly; defaults keep the flag `false`.

Use `MergeOptionsSchemas` when you need the merged schema type explicitly.

```ts
import type { MergeOptionsSchemas } from 'icore';

type Schema = MergeOptionsSchemas<[typeof sdkOptions, typeof formatOptions]>;
```

Use `CommandName` when you need the inferred command name type explicitly.

```ts
import type { CommandName } from 'icore';

type Name = CommandName<typeof usersGetAccountsCommand>;
```

`Name` is equivalent to:

```ts
type Name = 'users get-accounts';
```

## Error Messages

`icore` throws regular `Error` objects with stable messages.

Examples:

```txt
Unexpected argument '--unknown'
Unexpected duplicate argument '--format'
Unexpected duplicate command 'users get-accounts'
Unknown command: users get-unknown
Expected required argument '--token'
Expected '--format' as one of: json, table
Expected '--depth' as integer
Expected '--depth' to be greater than or equal to 1
```

Applications can catch these errors and decide how to print them.

## Project Boundary

`icore` is intended to be a small CLI mechanics module. It should not grow into a
domain-specific framework for a particular SDK or API.

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
