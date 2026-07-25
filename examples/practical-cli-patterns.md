# Practical CLI Patterns

These examples show application-level patterns built on top of icore. They use
neutral command names, but the shapes are meant for real CLI applications with
many commands, shared options, utility commands, and compatibility behavior.

## Global Help And Version Shortcuts

In a larger CLI, `--help`, `-h`, `--version`, and `-v` often work before command
execution. They should not require command-specific required options or runtime
context.

This behavior is not automatic in icore because it is application policy, not
command mechanics. Keeping it in the bootstrap runner is the most explicit
choice: utility shortcuts can bypass command-specific validation, while regular
commands still use the registry and their own schemas.

Put this logic in the bootstrap runner, before the command registry runs a
business command:

```ts
import {
  parseArgv,
  parseOptionsSubsetDetailed,
  type OptionsSchema
} from 'icore';

const bootstrapOptionsSchema = {
  help: {
    type: 'boolean',
    alias: 'h',
    syntax: 'flag'
  },
  version: {
    type: 'boolean',
    alias: 'v',
    syntax: 'flag'
  },
  offline: {
    type: 'boolean',
    syntax: 'flag'
  }
} as const satisfies OptionsSchema;

function parseBootstrapInput(args: readonly string[]) {
  const argv = parseArgv(args, bootstrapOptionsSchema);
  const parsed = parseOptionsSubsetDetailed(
    bootstrapOptionsSchema,
    argv.options
  );

  return {
    positionals: argv.positionals,
    options: parsed.options,
    rest: parsed.rest
  };
}
```

Short aliases are schema behavior: `parseArgv(...)` maps `-h` to `help` and
`-v` to `version`. The application does not need to normalize argv or declare
separate `h` and `v` options.

Only bootstrap-owned options are validated here. Command-specific options are
returned in `rest` for inspection but should normally remain in the original
argv passed to `app.prepare(...)`. Do not reconstruct command argv from the
subset result. That avoids a common mistake where global parsing rejects,
reorders, or drops valid command options before the command is resolved.

Include every bootstrap option whose type affects token ownership. In this
example `offline` is declared as boolean, so shortcut parsing will not consume
the following command segment as its value.

The user can ask for top-level help:

```bash
workspace-cli --help
workspace-cli -h
workspace-cli help
```

The application prints its command list:

```text
Usage:
  workspace-cli <command> [options]

Commands:
  help [command]
  version
  jobs list
  jobs run
```

The user can ask for command help without providing required command options:

```bash
workspace-cli jobs run --help
workspace-cli help jobs run
```

The application prints only that command:

```text
jobs run - Run a job

Usage:
  workspace-cli jobs run --job-id=ID [--dry-run]

Options:
  --job-id=value   Required job identifier
  --dry-run        Validate input without running the job
```

Version can also be a command and a global shortcut:

```bash
workspace-cli version
workspace-cli --version
workspace-cli -v
```

The application prints runtime information:

```text
workspace-cli 1.4.0
node v24.13.1
platform linux x64
```

Invalid boolean assignments are still rejected before command execution:

```bash
workspace-cli --help=false
```

The terminal shows:

```text
Expected '--help' as boolean flag
```

## Utility Commands As Regular Commands

Utility commands can use the same command registry as the rest of the
application. The command below accepts extra positionals so `help jobs run` can
target another command:

This approach is usually better than hard-coding utility commands outside the
registry because `help` and `version` remain visible public commands. The cost
is that bootstrap still needs shortcut handling for `--help`, `-h`, `--version`,
and `-v` if those forms are part of the public interface.

```ts
import { createCommand } from 'icore';

const command = createCommand();

const helpCommand = command.define({
  path: ['help'],
  options: {},
  allowExtraPositionals: true,
  handle({ positionals }) {
    if (positionals.length === 0) {
      return renderTopLevelHelp();
    }

    return renderCommandHelp(positionals.map(String).join(' '));
  }
});

const versionCommand = command.define({
  path: ['version'],
  options: {},
  allowExtraPositionals: true,
  handle() {
    return renderVersionInfo();
  }
});
```

This keeps utility command routing explicit. The application still owns the
actual help text and version text.

## Build Help From Command Metadata

Keep help text with each command definition, then build the help inventory from
`commands.definitions`. Definitions contain canonical commands only, so aliases
do not create duplicate entries:

```ts
import { createCommand } from 'icore';

type CliCommandMetadata = {
  description: string;
  usage: readonly string[];
};

const documentedCommand = createCommand.withTypes<{
  context: undefined;
  result: string;
  metadata: CliCommandMetadata;
  metadataRequired: true;
}>();

const listJobsCommand = documentedCommand.define({
  path: ['jobs', 'list'],
  aliases: [
    ['job', 'ls']
  ],
  options: {
    status: {
      type: 'string',
      choices: ['queued', 'running', 'done', 'failed']
    }
  },
  metadata: {
    description: 'List jobs',
    usage: [
      'workspace-cli jobs list [--status=STATUS]'
    ]
  },
  handle() {
    return 'No jobs\n';
  }
});

const documentedCommands = documentedCommand.registry([
  listJobsCommand
] as const);

const commandHelpEntries = documentedCommands.definitions.map((definition) => ({
  name: definition.path.join(' '),
  aliases: (definition.aliases ?? []).map((path) => path.join(' ')),
  description: definition.metadata.description,
  usage: definition.metadata.usage,
  optionNames: Object.keys(definition.options)
}));
```

Use `commandHelpEntries` for top-level and group help. For command-specific
help, match the requested path against `definition.path` and
`definition.aliases`, but render the canonical path from `definition.path`.

`icore` exposes definitions and typed metadata but deliberately does not choose
help layout, wording, grouping, or whether aliases should be visible. Those
remain application policy.

## Shared Application Options

Real commands often reuse connection, output, or runtime switches. Keep those
schemas small and compose them with command-specific schemas:

Composition is useful when the same options appear across many commands. It is
not a reason to create generic schemas for one-off options. If only one command
uses an option, define it directly on that command.

```ts
import {
  mergeOptionsSchema,
  type OptionsSchema
} from 'icore';

const runtimeOptions = {
  config: {
    type: 'string'
  },
  profile: {
    type: 'string'
  },
  offline: {
    type: 'boolean'
  }
} as const satisfies OptionsSchema;

const outputOptions = {
  format: {
    type: 'string',
    choices: ['table', 'json', 'csv'],
    default: 'table'
  }
} as const satisfies OptionsSchema;

const listJobsOptions = mergeOptionsSchema(runtimeOptions, outputOptions, {
  status: {
    type: 'string',
    choices: ['queued', 'running', 'done', 'failed']
  },
  limit: {
    type: 'number',
    integer: true,
    min: 1,
    max: 100,
    default: 20
  }
} as const);
```

The user can combine shared and command-specific options:

```bash
workspace-cli jobs list --profile staging --format json --status failed --limit 10
```

The command handler receives:

```ts
{
  config: undefined,
  profile: 'staging',
  offline: undefined,
  format: 'json',
  status: 'failed',
  limit: 10
}
```

## Deprecated Option Aliases

When a public CLI option is renamed, keep the compatibility option close to the
canonical option and resolve the conflict explicitly:

This is not the cleanest contract, but it is useful when existing users may
already depend on the old name. Keep the deprecated option visible in code,
warn when it is used, and reject ambiguous calls that pass both names.

```ts
const itemIdOptions = {
  'item-id': {
    type: 'string'
  },
  'legacy-id': {
    type: 'string'
  }
} as const;

type ItemIdOptions = {
  'item-id'?: string;
  'legacy-id'?: string;
};

function resolveItemId(options: ItemIdOptions): string {
  if (options['item-id'] !== undefined && options['legacy-id'] !== undefined) {
    throw new Error("Use either '--item-id' or deprecated '--legacy-id', not both");
  }

  if (options['item-id'] !== undefined) {
    return options['item-id'];
  }

  if (options['legacy-id'] !== undefined) {
    return options['legacy-id'];
  }

  throw new Error("Expected '--item-id'");
}
```

The canonical option is quiet:

```bash
workspace-cli catalog get --item-id=item-42
```

The deprecated option can still work while the application prints a warning to
stderr:

```bash
workspace-cli catalog get --legacy-id=item-42
```

The terminal can show:

```text
Warning: '--legacy-id' is deprecated; use '--item-id' instead.
```

Using both options is rejected:

```bash
workspace-cli catalog get --item-id=item-42 --legacy-id=item-42
```

The terminal shows:

```text
Use either '--item-id' or deprecated '--legacy-id', not both
```

## Edge Cases Worth Testing

Boolean flags do not consume the next token as a value:

This behavior is intentional. It prevents `--offline false` from silently
meaning something different than the supported boolean syntax.

```bash
workspace-cli jobs list --offline false
```

The parser sees `offline: true` and leaves `false` as a positional token. If the
command does not allow extra positionals, command validation rejects it.

Schema-known string and number options can consume dash-prefixed values:

This is why parsing receives the command schema. Without the schema, `-draft`
or `-1` could be mistaken for another option-like token.

```bash
workspace-cli search --query -draft --limit -1
```

This is useful for search text and signed numbers. Schema validation can still
reject the parsed value later, for example when `limit` has `min: 1`.

The option terminator turns everything after it into positional input:

This is useful when the user needs to pass text that looks like an option to the
application itself.

```bash
workspace-cli search -- --query -draft --offline
```

The tokens `--query`, `-draft`, and `--offline` are no longer parsed as options.

Duplicate long and short forms are rejected as the same argument:

Rejecting duplicates is stricter than "last value wins", but it prevents hidden
precedence rules in command contracts.

```bash
workspace-cli jobs list --offline -o
```

That is a duplicate when `offline` declares `alias: 'o'`.
