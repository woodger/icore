# icore

[![npm version](https://img.shields.io/npm/v/icore.svg)](https://www.npmjs.com/package/icore)
[![node](https://img.shields.io/node/v/icore.svg)](https://www.npmjs.com/package/icore)
[![types](https://img.shields.io/npm/types/icore.svg)](https://www.npmjs.com/package/icore)
[![license](https://img.shields.io/npm/l/icore.svg)](LICENSE)

Small dependency-free command line interface mechanics for [Node.js®](https://nodejs.org) applications.

[API](#api) | [Option Schemas](#option-schemas) | [Type Inference](#type-inference)

#### How it works?

![yuml diagram](http://yuml.me/diagram/scruffy;dir:LR;/class/[*argv*%20{bg:gray}|External;users%20get%20--limit%2010%20--json]->[*matches*%20{bg:lavender}|System;parse,%20resolve,%20validate,%20infer]->[*typed%20result*%20{bg:honeydew}|Container;command=users/get;%20limit=10;%20json=true]->[*your%20app*%20{bg:cornsilk}|System;business%20logic%20and%20output])

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

### Installation

To use `icores` in your project, run:

```sh
npm install icore
```

### Table of Contents

- [`parseArgv(args, schema?)`](#parseargvargs-schema)
- [`parseOptions(schema, values)`](#parseoptionsschema-values)
- [`parseOptionsDetailed(schema, values)`](#parseoptionsdetailedschema-values)
- [`defineCommand(command)`](#definecommandcommand)
- [`defineCommandRegistry(commands)`](#definecommandregistrycommands)
- [`isCommandName(registry, value)`](#iscommandnameregistry-value)
- [`resolveCommand(registry, positionals)`](#resolvecommandregistry-positionals)
- [`resolveCommandFromArgs(registry, args)`](#resolvecommandfromargsregistry-args)
- [`runCommandFromRegistry(registry, args, context)`](#runcommandfromregistryregistry-args-context)
- [`mergeOptionsSchema(...schemas)`](#mergeoptionsschemaschemas)
- [`runCommand(command, args, context)`](#runcommandcommand-args-context)

### Design Goals

- describe CLI mechanics declaratively;
- use literal option types: `type: 'string' | 'boolean' | 'number'`;
- keep handlers free from repetitive option parsing;
- keep domain and API semantics outside the framework;
- provide predictable user-facing errors;
- avoid runtime dependencies.

### Basic Usage

```ts
import { defineCommand, runCommand } from 'icore';

const helloCommand = defineCommand({
  path: ['hello'],
  options: {
    name: {
      type: 'string',
      default: 'world'
    },
    upper: {
      type: 'boolean'
    }
  },
  async handle({ options }) {
    const message = `Hello, ${options.name}!`;

    return options.upper ? message.toUpperCase() : message;
  }
});

const output = await runCommand(
  helloCommand,
  ['hello', '--name', 'Stanislav', '--upper'],
  {}
);

console.log(output);
```

The command handler receives parsed options, user-provided option metadata,
remaining positionals, and caller provided context.

CommonJS is supported:

```js
const {
  defineCommand,
  runCommand
} = require('icore');
```

### Option Schemas

Options are described as plain objects.

Option names are exact. `icore` does not normalize camelCase to kebab-case or
kebab-case to camelCase. Use quoted object keys when your public CLI option
contains `-`.

#### String Options

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

#### Boolean Options

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

#### Number Options

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

### API

#### `parseArgv(args, schema?)`

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

#### `parseOptions(schema, values)`

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

#### `parseOptionsDetailed(schema, values)`

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

#### `defineCommand(command)`

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

#### `defineCommandRegistry(commands)`

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

#### `isCommandName(registry, value)`

Checks whether an unknown value is a command name registered in the registry.

```ts
if (isCommandName(registry, value)) {
  // value is narrowed to the registry command name union.
}
```

#### `resolveCommand(registry, positionals)`

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

#### `resolveCommandFromArgs(registry, args)`

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

#### `runCommandFromRegistry(registry, args, context)`

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

#### `mergeOptionsSchema(...schemas)`

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

#### `runCommand(command, args, context)`

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

### Type Inference

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

### Facade of arguments

The table below provides examples of how to specify the syntax.

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

### Error Messages

`icore` throws regular `Error` objects with predictable user-facing messages.
Applications should treat these messages as display text, not as a
machine-readable API.

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

### Project Boundary

`icore` is intended to be a small CLI mechanics module. It should not grow into a
domain-specific framework for a particular SDK or API.

Good responsibilities for `icore`:

- option schema evaluation;
- command path checking;
- common argument errors;
- typed command handler input.
