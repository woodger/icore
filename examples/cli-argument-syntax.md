# CLI Argument Syntax

icore supports a practical GNU-style option syntax. The parser receives
`process.argv.slice(2)`, splits command path tokens from option tokens, and then
uses the command schema to validate option values.

Supported forms:

- long options: `--name value`, `--name=value`;
- boolean flags: `--flag`, `--no-flag`;
- short aliases declared in the schema: `-f`, `-n value`;
- option terminator: `--`.

The supported set is intentionally small. It covers common terminal usage while
avoiding shell-specific surprises and hidden precedence rules.

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

The handler receives the same parsed value.

Supporting both forms keeps the CLI comfortable for humans and scripts. Both
forms map to the same option value, so command handlers do not need to care
which spelling the user chose.

Schema-known string and number options can consume values that start with `-`:

```bash
node dist/cli.js search --label -draft --limit -1
```

That works when the command schema declares `label` as `type: 'string'` and
`limit` as `type: 'number'`.

This is one reason argv parsing accepts a schema hint. Without it, values like
`-draft` and `-1` are hard to distinguish from option-looking tokens.

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

Those forms are rejected. A boolean option is either present as a flag or, when
the schema allows it, negated with `--no-<name>`.

Rejecting explicit boolean values is stricter, but it avoids a long list of
quasi-boolean strings such as `yes`, `no`, `1`, and `0`.

This command:

```bash
node dist/cli.js reports list --archived false
```

sets `archived` to `true` and leaves `false` as a positional token. It does not
mean `archived: false`.

## Short aliases

Short aliases work only when the option schema declares them.

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

The handler receives:

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

The handler receives:

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

This limitation is deliberate. Compact short syntax can be convenient, but it
creates more parser edge cases and makes command examples harder to read. icore
chooses clarity over maximum GNU compatibility here.

## Option terminator

Use `--` to stop option parsing. The terminator itself is removed; every token
after it becomes positional, even when it starts with `-`.

This is useful when the application needs to receive raw user text, patterns, or
values that look like options.

```bash
node dist/cli.js search -- --name Alice -v
```

The parser treats `--name`, `Alice`, and `-v` as positional tokens after the
command path.

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

Rejecting duplicates is usually safer than choosing the first or last value. It
forces the caller to send one clear value and keeps command behavior
deterministic.

## Unknown options

Unknown long options are rejected when command options are validated:

```bash
node dist/cli.js users get --unknown value
```

Unknown short tokens are not expanded automatically. If the active command does
not allow them as positionals, command validation rejects them as unexpected
positional arguments.

For application-level patterns built from this syntax, see
[practical-cli-patterns.md](practical-cli-patterns.md).
