# Examples

## Basic Command

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

## Command Registry

```ts
import {
  defineCommand,
  defineCommandRegistry,
  runCommandFromRegistry
} from 'icore';

const usersListCommand = defineCommand({
  path: ['users', 'list'],
  options: {
    limit: {
      type: 'number',
      integer: true,
      min: 1,
      max: 100,
      default: 20
    }
  },
  async handle({ options }) {
    return `List ${options.limit} users`;
  }
});

const registry = defineCommandRegistry([
  usersListCommand
] as const);

const output = await runCommandFromRegistry(
  registry,
  ['users', 'list', '--limit', '10'],
  {}
);
```

## Option Presence Metadata

Use `parseOptionsDetailed` when defaults and explicitly provided values have
different application-level meaning.

```ts
import { parseOptionsDetailed } from 'icore';

const result = parseOptionsDetailed({
  format: {
    type: 'string',
    choices: ['json', 'table'],
    default: 'table'
  }
} as const, {});

result.options.format;
result.provided.format;
```

`result.options.format` is `table`, and `result.provided.format` is `false`.

## CommonJS

```js
const {
  defineCommand,
  runCommand
} = require('icore');
```
