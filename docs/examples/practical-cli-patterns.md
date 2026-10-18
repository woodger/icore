# Common CLI Patterns

English | [Русский](../ru/examples/practical-cli-patterns.md) | [简体中文](../zh/examples/practical-cli-patterns.md)

These examples show how an application can use `icore` for common command-line behavior. The command names are neutral, but the examples apply to applications with many commands, shared options, help and version commands, and older option names.

## Global Help And Version

In a CLI with many commands, `--help`, `-h`, `--version`, and `-v` often work before a command is selected. They should not require values needed only by one command.

`icore` does not handle these flags automatically because an application decides what help and version mean. Handle them before selecting a command. The global flags can then bypass validation for a specific command, while regular commands still use the command registry and their own option definitions.

Parse these flags before using the command registry to run an application command:

```ts
// Parse only the options that work before a command is selected.
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

The option definition gives `-h` and `-v` their meanings: `parseArgv(...)` maps them to `help` and `version`. The application does not need to rewrite the arguments or define separate `h` and `v` options.

Only the global flags are checked here. Options for a command appear in `rest`, but normally stay in the original arguments passed to `app.prepare(...)`. Do not rebuild command arguments from the partial result. Otherwise global parsing can reject, reorder, or discard valid command options before a command is selected.

Include every global option whose type tells the parser whether it takes the next argument. Here `offline` is boolean, so parsing does not treat the following command segment as its value.

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

Version can be both a command and a global flag:

```bash
workspace-cli version
workspace-cli --version
workspace-cli -v
```

The application prints its version, Node.js version, and platform:

```text
workspace-cli 1.4.0
node v24.13.1
platform linux x64
```

Invalid boolean values are still rejected before command execution:

```bash
workspace-cli --help=false
```

The terminal shows:

```text
Expected '--help' as boolean flag
```

## Make Help And Version Regular Commands

Help and version can use the same command registry as the rest of the application. The command below accepts extra positional arguments, so `help jobs run` can name another command:

This keeps `help` and `version` visible as public commands instead of hard-coding them outside the registry. The application still needs to handle `--help`, `-h`, `--version`, and `-v` before command selection if it supports those forms.

```ts
// Keep help and version as regular commands in the registry.
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
  handle() {
    return renderVersionInfo();
  }
});
```

This makes the routing of help and version commands visible. The application still supplies the help text and version text.

## Build Help From Command Descriptions

Keep help text with each command definition, then build the command list from `commands.definitions`. The list contains each main command once, so aliases do not create duplicate entries:

```ts
// Store help text on command definitions and build entries from them.
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

Use `commandHelpEntries` for top-level and group help. For help about one command, compare the requested name with `definition.path` and `definition.aliases`, but show the main name from `definition.path`.

`icore` exposes command definitions and typed descriptions, but the application chooses the help layout, wording, grouping, and whether aliases are shown.

## Options Used By Several Commands

Commands often reuse connection settings, output settings, or flags. Keep those option definitions small and merge them with the options for one command:

Share an option definition when the same options appear in several commands. If only one command uses an option, define it directly on that command.

```ts
// Combine common options with options specific to `jobs list`.
import {
  mergeOptionsSchema,
  type OptionsSchema
} from 'icore';

const sharedCliOptions = {
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

const listJobsOptions = mergeOptionsSchema(sharedCliOptions, outputOptions, {
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

The user can combine shared options with options for one command:

```bash
workspace-cli jobs list --profile staging --format json --status failed --limit 10
```

The command function receives:

```text
{
  config: undefined,
  profile: 'staging',
  offline: undefined,
  format: 'json',
  status: 'failed',
  limit: 10
}
```

## Keep An Old Option Name During Migration

When a public CLI option is renamed, keep the old name near the new name and resolve a call that contains both explicitly:

Existing users may depend on the old name. Keep it visible in code, print a warning when it is used, and reject calls that pass both names.

```ts
// Accept either name, but reject a call that provides both.
import { CliUsageError } from 'icore';

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
    throw new CliUsageError(
      "Use either '--item-id' or deprecated '--legacy-id', not both"
    );
  }

  if (options['item-id'] !== undefined) {
    return options['item-id'];
  }

  if (options['legacy-id'] !== undefined) {
    return options['legacy-id'];
  }

  throw new CliUsageError("Expected '--item-id'");
}
```

The new option prints no warning:

```bash
workspace-cli catalog get --item-id=item-42
```

The old option can still work while the application prints a warning to standard error:

```bash
workspace-cli catalog get --legacy-id=item-42
```

The terminal can show:

```text
Warning: '--legacy-id' is deprecated; use '--item-id' instead.
```

Using both names is rejected:

```bash
workspace-cli catalog get --item-id=item-42 --legacy-id=item-42
```

The terminal shows:

```text
Use either '--item-id' or deprecated '--legacy-id', not both
```

## Argument Cases To Understand

Boolean flags do not consume the next argument as a value:

This prevents `--offline false` from silently meaning something other than the supported boolean form.

```bash
workspace-cli jobs list --offline false
```

The parser sees `offline: true` and leaves `false` as a positional argument. If the command does not allow extra positional arguments, validation rejects it.

String and number options defined for a command can consume values that start with a dash:

This is why parsing receives the command's option definition. Without it, `-draft` or `-1` could be mistaken for another option.

```bash
workspace-cli search --query -draft --limit -1
```

This is useful for search text and signed numbers. Validation can still reject the parsed value later, for example when `limit` has `min: 1`.

The option terminator turns every following argument into positional input:

Use it when the application needs text that looks like an option.

```bash
workspace-cli search -- --query -draft --offline
```

`--query`, `-draft`, and `--offline` are no longer parsed as options.

Using both a long option and its short name is rejected:

Rejecting duplicates avoids hidden rules about which value wins.

```bash
workspace-cli jobs list --offline -o
```

This is a duplicate when `offline` declares `alias: 'o'`.
