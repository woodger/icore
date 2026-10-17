# Command-Line Arguments

`icore` supports a small GNU-style option syntax. It receives `process.argv.slice(2)`, separates the command name and subcommands from options, and uses the command's option definition to validate values.

Supported forms:

- long options: `--name value`, `--name=value`;
- boolean flags: `--flag`, `--no-flag`;
- short names declared in the option definition: `-f`, `-n value`;
- option terminator: `--`.

The supported set is intentionally small. It covers common terminal usage while avoiding shell-specific surprises and hidden precedence rules.

## Long options

Use a separate value:

```bash
node dist/cli.js users get --name Alice
```

The raw option value is:

```json
{
  "name": "Alice"
}
```

Use an equals sign when it reads better:

```bash
node dist/cli.js users get --name=Alice
```

The command function receives the same parsed value.

Supporting both forms keeps the CLI comfortable for humans and scripts. Both forms map to the same option value, so command handlers do not need to care which spelling the user chose.

String and number options defined for the command can consume values that start with `-`:

```bash
node dist/cli.js search --label -draft --limit -1
```

That works when the command's option definition declares `label` as `type: 'string'` and `limit` as `type: 'number'`.

This is why argument parsing accepts an option definition. Without it, values like `-draft` and `-1` are hard to distinguish from options.

## Boolean flags

Use the option name to set a boolean to `true`:

```bash
node dist/cli.js reports list --archived
```

Use `--no-<name>` to set a known boolean option to `false`:

```bash
node dist/cli.js reports list --no-archived
```

Do not pass explicit boolean values:

```bash
node dist/cli.js reports list --archived=true
node dist/cli.js reports list --archived=false
```

Those forms are rejected. A boolean option is either present as a flag or, when its option definition allows it, negated with `--no-<name>`.

Rejecting explicit boolean values is stricter, but it avoids a long list of quasi-boolean strings such as `yes`, `no`, `1`, and `0`.

This command:

```bash
node dist/cli.js reports list --archived false
```

sets `archived` to `true` and leaves `false` as a positional token. It does not mean `archived: false`.

## Short Option Names

Short names work only when the option definition declares them.

For a boolean alias:

```ts
const options = {
  verbose: {
    type: 'boolean',
    alias: 'v'
  }
} as const;
```

The user can type:

```bash
node dist/cli.js users get -v
```

The command function receives:

```json
{
  "verbose": true
}
```

For a string or number alias, put the value in the next token:

```ts
const options = {
  name: {
    type: 'string',
    alias: 'n'
  },
  limit: {
    type: 'number',
    alias: 'l'
  }
} as const;
```

The user can type:

```bash
node dist/cli.js users get -n Alice -l 10
```

The command function receives:

```json
{
  "name": "Alice",
  "limit": 10
}
```

Attached short values are not supported:

```bash
node dist/cli.js users get -nAlice
```

Grouped short booleans are not supported:

```bash
node dist/cli.js users get -abc
```

Use one declared alias per token.

This limitation is deliberate. Combining short options can be convenient, but it creates more parsing edge cases and makes command examples harder to read.

## Option terminator

Use `--` to stop option parsing. The terminator itself is removed; every token after it becomes positional, even when it starts with `-`.

This is useful when the application needs to receive raw user text, patterns, or values that look like options.

```bash
node dist/cli.js search -- --name Alice -v
```

The parser treats `--name`, `Alice`, and `-v` as positional arguments after the command name.

## Duplicate options

Do not pass the same option twice:

```bash
node dist/cli.js users get --format json --format table
```

Do not pass the same option through both its long name and its short alias:

```bash
node dist/cli.js users get --verbose -v
```

Both forms are rejected as duplicate arguments.

Rejecting duplicates is usually safer than choosing the first or last value. It forces the caller to send one clear value and keeps command behavior deterministic.

## Unknown options

Unknown long options are rejected when the command's options are validated:

```bash
node dist/cli.js users get --unknown value
```

Unknown short arguments are not expanded automatically. If the selected command does not allow them as positional arguments, validation rejects them as unexpected positional arguments.

For help, version, shared options, and older option names, see [Common CLI Patterns](practical-cli-patterns.md).
