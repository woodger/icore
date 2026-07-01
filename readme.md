# icore

[![npm version](https://img.shields.io/npm/v/icore.svg)](https://www.npmjs.com/package/icore)
[![node](https://img.shields.io/node/v/icore.svg)](https://www.npmjs.com/package/icore)
[![types](https://img.shields.io/npm/types/icore.svg)](https://www.npmjs.com/package/icore)
[![license](https://img.shields.io/npm/l/icore.svg)](LICENSE)

Small dependency-free command line interface mechanics for [Node.js®](https://nodejs.org) applications.

### Installation

To use `icore` in your project, run:

```sh
npm install icore
```

### Table of Contents

* [API](#api)
  * [`parseArgv(args, schema?)`](#parseargvargs-schema)
  * [`parseOptions(schema, values)`](#parseoptionsschema-values)
  * [`parseOptionsDetailed(schema, values)`](#parseoptionsdetailedschema-values)
  * [`defineCommand(command)`](#definecommandcommand)
  * [`defineCommandRegistry(commands)`](#definecommandregistrycommands)
  * [`isCommandName(registry, value)`](#iscommandnameregistry-value)
  * [`resolveCommand(registry, positionals)`](#resolvecommandregistry-positionals)
  * [`resolveCommandFromArgs(registry, args)`](#resolvecommandfromargsregistry-args)
  * [`runCommandFromRegistry(registry, args, context)`](#runcommandfromregistryregistry-args-context)
  * [`mergeOptionsSchema(...schemas)`](#mergeoptionsschemaschemas)
  * [`runCommand(command, args, context)`](#runcommandcommand-args-context)
* [Example](#example)
* [Option Schemas](#option-schemas)
* [Type Inference](#type-inference)
* [Facade of arguments](#facade-of-arguments)
* [Error Messages](#error-messages)

### API

#### `parseArgv(args, schema?)`

Parses raw CLI arguments into positionals and raw option values.

```ts
import { parseArgv } from 'icore';

const argv = parseArgv([
  'hello',
  '--name',
  'User',
  '--upper'
]);
```

Result:

```ts
{
  positionals: ['hello'],
  options: {
    name: 'User',
    upper: true
  }
}
```

When an option schema is provided, boolean options are parsed as flag-only
options without consuming the following positional argument:

```ts
const argv = parseArgv([
  'hello',
  '--upper',
  'User'
], {
  upper: {
    type: 'boolean'
  }
});
```

Result:

```ts
{
  positionals: ['hello', 'User'],
  options: {
    upper: true
  }
}
```

#### `parseOptions(schema, values)`

Validates raw option values using an option schema and returns typed options.

```ts
import { parseOptions } from 'icore';

const options = parseOptions({
  name: {
    type: 'string',
    default: 'world'
  },
  upper: {
    type: 'boolean'
  }
} as const, {
  name: 'User',
  upper: true
});
```

Result:

```ts
{
  name: 'User',
  upper: true
}
```

#### `parseOptionsDetailed(schema, values)`

Validates raw option values and returns parsed options together with
user-provided metadata.

```ts
import { parseOptionsDetailed } from 'icore';

const result = parseOptionsDetailed({
  name: {
    type: 'string',
    default: 'world'
  },
  upper: {
    type: 'boolean'
  }
} as const, {
  upper: true
});
```

Result:

```ts
{
  options: {
    name: 'world',
    upper: true
  },
  provided: {
    name: false,
    upper: true
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
```

#### `defineCommandRegistry(commands)`

Defines a command registry while preserving literal command path types.

```ts
import { defineCommandRegistry } from 'icore';

const registry = defineCommandRegistry([
  helloCommand,
  helloFormalCommand
] as const);
```

The registry exposes ordered commands and derived command names:

```ts
registry.commandNames;
```

Result:

```ts
[
  'hello',
  'hello formal'
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
  'hello',
  'formal',
  'User'
]);
```

Result:

```ts
{
  name: 'hello formal',
  path: ['hello', 'formal'],
  command: helloFormalCommand,
  positionals: ['User']
}
```

When several command paths match, the most specific command wins. For example,
`hello formal` is preferred over `hello`.

#### `resolveCommandFromArgs(registry, args)`

Resolves a command from raw CLI arguments. Each candidate command is parsed with
its own option schema, so boolean flags do not accidentally consume command path
segments.

```ts
const resolved = resolveCommandFromArgs(registry, [
  'hello',
  '--name',
  'User',
  '--upper'
]);
```

#### `runCommandFromRegistry(registry, args, context)`

Resolves a command from a registry and runs its handler.

```ts
const output = await runCommandFromRegistry(
  registry,
  ['hello', '--name', 'User', '--upper'],
  context
);
```

This is **registry-level mechanics only**. Application-specific setup, side
effects, and output formatting still belong outside `icore`.

#### `mergeOptionsSchema(...schemas)`

Merges multiple option schemas while preserving literal option definition types.
Later schemas override earlier schemas with the same option name.

```ts
import { mergeOptionsSchema } from 'icore';

const nameOptions = {
  name: {
    type: 'string',
    default: 'world'
  }
} as const;

const greetingOptions = {
  upper: {
    type: 'boolean'
  }
} as const;

const options = mergeOptionsSchema(nameOptions, greetingOptions);
```

#### `runCommand(command, args, context)`

Parses arguments, validates options, checks command positionals, and runs the
handler.

```ts
const output = await runCommand(
  command,
  ['hello', '--name', 'User', '--upper'],
  context
);
```

**By default**, extra positionals are rejected. A command can opt in to extra
positionals with `allowExtraPositionals: true`.

### How It Works

![yuml diagram](http://yuml.me/diagram/scruffy;dir:LR;/class/[*argv*%20{bg:gray}|External;hello%20--name%20User%20--upper]->[*matches*%20{bg:lavender}|System;parse,%20resolve,%20validate,%20infer]->[*typed%20result*%20{bg:honeydew}|Container;command=hello;%20name=User;%20upper=true]->[*your%20app*%20{bg:cornsilk}|System;business%20logic%20and%20output])


### Example

```ts
import { defineCommand, runCommand } from 'icore';

const exampleCommand = defineCommand({
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
  exampleCommand,
  ['hello', '--name', 'User', '--upper'],
  {}
);

console.log(output);
```

Terminal output:

```console
$ node cli.js hello --name User --upper
HELLO, USER!
```

The command handler receives parsed options, user-provided option metadata,
remaining positionals, and caller provided context.

### Option Schemas

Options are described as plain objects.

**Option names are exact.** `icore` does not normalize `camelCase` to
`kebab-case`. Use quoted object keys when your public CLI option contains
`-`.

#### `type: 'string'`

```ts
const schema = {
  name: {
    type: 'string',
    required: true
  },
  style: {
    type: 'string',
    choices: ['short', 'long'],
    default: 'short'
  }
} as const;
```

String options reject missing required values, blank strings, boolean flag form,
and values outside `choices`.

#### `type: 'boolean'`

```ts
const schema = {
  upper: {
    type: 'boolean'
  }
} as const;
```

Boolean options accept **flag form only**:

```sh
--upper
```

Explicit values are rejected:

```sh
--upper true
--upper=true
```

#### `type: 'number'`

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

### Type Inference

Use `InferOptions` when you need the parsed option type explicitly.

```ts
import type { InferOptions } from 'icore';

const schema = {
  name: {
    type: 'string',
    default: 'world'
  },
  upper: {
    type: 'boolean'
  }
} as const;

type Options = InferOptions<typeof schema>;
```

`Options` is equivalent to:

```ts
type Options = {
  name: string;
  upper: boolean | undefined;
};
```

**Required options and options with defaults are always present.** Optional
options without defaults are returned as `T | undefined`.

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

type Schema = MergeOptionsSchemas<[typeof nameOptions, typeof greetingOptions]>;
```

Use `CommandName` when you need the inferred command name type explicitly.

```ts
import type { CommandName } from 'icore';

type Name = CommandName<typeof helloFormalCommand>;
```

`Name` is equivalent to:

```ts
type Name = 'hello formal';
```

### Facade of arguments

The table below provides examples of how to specify the syntax.

| Syntax | Supported |
|---|---:|
| `--name value` | yes |
| `--name=value` | yes |
| `--flag` | yes |
| `--flag=true` | no |
| `-f` | no |
| `--no-cache` | no |

### Error Messages

`icore` throws regular `Error` objects with predictable user-facing messages.
Applications should treat these messages as **display text**, not as a
**machine-readable API**.

Applications can catch these errors and decide how to print them. For example,
after printing `error.message`, terminal output can look like this:

```console
$ node cli.js hello --unknown
Unexpected argument '--unknown'

$ node cli.js hello --upper=true
Expected '--upper' as boolean flag
```

### Project Boundary

`icore` is intended to be a **small CLI mechanics module**. It should **not**
grow into a domain-specific framework for a particular SDK or API.

Good responsibilities for `icore`:

- option schema evaluation;
- command path checking;
- common argument errors;
- typed command handler input.
