# 实用 CLI 模式

[English](../../guides/practical-cli-patterns.md) | [Русский](../../ru/guides/practical-cli-patterns.md) | 简体中文

> 本文是英文版的简体中文翻译。如有差异，以英文版为准。

这些示例展示应用如何使用 `icore` 完成常见的命令行工作。命令名称是中性的，但示例适用于拥有许多命令、共享选项、帮助和版本命令以及旧选项名称的应用。

## 全局帮助和版本

在拥有许多命令的 CLI 中，`--help`、`-h`、`--version` 和 `-v` 通常在选择命令前生效。它们不应要求只由某一条命令使用的值。

`icore` 不会自动处理这些标志，因为应用自己决定帮助和版本的含义。请在选择命令前处理它们。这样全局标志可以绕过某条命令的验证，而普通命令仍使用命令注册表和自己的选项定义。

请在使用命令注册表运行应用命令前解析这些标志：

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

选项定义赋予 `-h` 和 `-v` 含义：`parseArgv(...)` 将它们映射为 `help` 和 `version`。应用不需要重写参数，也不需要分别定义 `h` 和 `v` 选项。

这里只检查全局标志。命令选项会在 `rest` 中返回以供查看，但通常仍应保留在传给 `app.prepare(...)` 的原始参数中。不要根据部分结果重建命令参数，否则全局解析可能在选择命令前错误地拒绝、重排或丢弃有效选项。

包含每个类型能告诉解析器是否会占用下一个参数的全局选项。本例将 `offline` 声明为布尔值，因此解析不会把后续命令段作为它的值。

用户可以请求顶层帮助：

```bash
workspace-cli --help
workspace-cli -h
workspace-cli help
```

应用输出命令列表：

```text
Usage:
  workspace-cli <command> [options]

Commands:
  help [command]
  version
  jobs list
  jobs run
```

用户可以在不提供命令必填选项的情况下请求命令帮助：

```bash
workspace-cli jobs run --help
workspace-cli help jobs run
```

应用只输出该命令：

```text
jobs run - Run a job

Usage:
  workspace-cli jobs run --job-id=ID [--dry-run]

Options:
  --job-id=value   Required job identifier
  --dry-run        Validate input without running the job
```

版本既可以是命令，也可以是全局标志：

```bash
workspace-cli version
workspace-cli --version
workspace-cli -v
```

应用输出自身版本、Node.js 版本和平台：

```text
workspace-cli 1.4.0
node v24.13.1
platform linux x64
```

无效的布尔值仍会在命令执行前被拒绝：

```bash
workspace-cli --help=false
```

终端显示：

```text
Expected '--help' as boolean flag
```

## 将帮助和版本作为普通命令

帮助和版本可以与应用其余部分使用同一个命令注册表。下面的命令接受额外的位置参数，因此 `help jobs run` 可以指向另一条命令：

这样 `help` 和 `version` 仍是可见的公共命令，而不是在注册表外单独定义。如果应用支持 `--help`、`-h`、`--version` 和 `-v`，它仍需在选择命令前处理它们。

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
  handle() {
    return renderVersionInfo();
  }
});
```

这样帮助和版本命令的路由清楚可见。帮助和版本文本仍由应用提供。

## 根据命令说明构建帮助

将帮助文本保存在每个命令定义中，再从 `commands.definitions` 构建命令列表。列表中每条主命令只出现一次，因此别名不会产生重复条目：

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

使用 `commandHelpEntries` 生成顶层和分组帮助。对于某条命令的帮助，将请求的名称与 `definition.path`、`definition.aliases` 匹配，但显示 `definition.path` 中的主名称。

`icore` 会公开命令定义和带类型的说明，但帮助的布局、措辞、分组和是否显示别名由应用决定。

## 多条命令使用的选项

命令经常复用连接设置、输出设置或标志。请保持这些选项定义小而明确，并把它们与单条命令的选项合并：

当相同选项出现在多条命令中时，共享选项定义很有用。如果一个选项只被一条命令使用，就直接在该命令中定义。

```ts
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

用户可以组合共享选项和命令自己的选项：

```bash
workspace-cli jobs list --profile staging --format json --status failed --limit 10
```

命令函数会收到：

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

## 重命名时保留旧选项名称

重命名公共 CLI 选项时，请将旧名称放在新名称附近，并明确处理同时传入两个名称的调用：

现有用户可能依赖旧名称。请在代码中保留它，使用时输出警告，并拒绝同时传入两个名称的调用。

```ts
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

新选项名称不输出警告：

```bash
workspace-cli catalog get --item-id=item-42
```

旧选项名称仍可工作，同时应用向标准错误输出警告：

```bash
workspace-cli catalog get --legacy-id=item-42
```

终端可以显示：

```text
Warning: '--legacy-id' is deprecated; use '--item-id' instead.
```

同时使用两个名称会被拒绝：

```bash
workspace-cli catalog get --item-id=item-42 --legacy-id=item-42
```

终端显示：

```text
Use either '--item-id' or deprecated '--legacy-id', not both
```

## 需要了解的参数情况

布尔标志不会把下一个参数当作值：

这可以防止 `--offline false` 悄悄表示与支持的布尔形式不同的含义。

```bash
workspace-cli jobs list --offline false
```

解析器得到 `offline: true`，并将 `false` 留作位置参数。如果命令不允许额外的位置参数，验证会拒绝它。

命令定义的字符串和数值选项可以接收以短横线开头的值：

这就是解析需要命令选项定义的原因。没有它时，`-draft` 或 `-1` 可能被误认为另一个选项。

```bash
workspace-cli search --query -draft --limit -1
```

这对搜索文本和有符号数字很有用。验证仍可在之后拒绝解析后的值，例如 `limit` 设置了 `min: 1` 时。

选项终止符会将其后的每个参数变成位置参数：

当应用需要看起来像选项的文本时，请使用它。

```bash
workspace-cli search -- --query -draft --offline
```

`--query`、`-draft` 和 `--offline` 不再被解析为选项。

同时使用长选项和它的短名称会被拒绝：

拒绝重复项可以避免隐藏的“哪个值优先”规则。

```bash
workspace-cli jobs list --offline -o
```

当 `offline` 声明了 `alias: 'o'` 时，这就是重复项。
