# icore

[![npm version](https://img.shields.io/npm/v/icore.svg)](https://www.npmjs.com/package/icore)
[![node](https://img.shields.io/node/v/icore.svg)](https://www.npmjs.com/package/icore)
[![types](https://img.shields.io/npm/types/icore.svg)](https://www.npmjs.com/package/icore)
[![license](https://img.shields.io/npm/l/icore.svg)](LICENSE)

Small dependency-free command line interface mechanics for Node.js applications.

[API Reference](docs/api.md) | [Examples](docs/examples.md)

`icore` describes CLI commands with typed option schemas, resolves command
registries, validates primitive options, and passes typed input to handlers. It
stops at CLI mechanics: your application still owns business rules, SDK calls,
process lifecycle, and output formatting.

## How It Works

![yuml diagram](http://yuml.me/diagram/scruffy;dir:LR;/class/[*argv*%20{bg:gray}|External;users%20get%20--limit%2010%20--json]->[*matches*%20{bg:lavender}|System;parse,%20resolve,%20validate,%20infer]->[*typed%20result*%20{bg:honeydew}|Container;command=users/get;%20limit=10;%20json=true]->[*your%20app*%20{bg:cornsilk}|System;business%20logic%20and%20output])

## Install

To use `icore` in your project, run:

```sh
npm install icore
```

## Quick Start

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

## Documentation

- [Design notes](docs/design.md)
- [Project policies](docs/policy/index.md)

## Requirements

- Node.js `>=16.9.0`
- TypeScript declarations are included.
- Runtime dependencies: none.

## License

[MIT](LICENSE)
