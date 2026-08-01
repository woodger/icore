# 实用 CLI 模式

[English](../../guides/practical-cli-patterns.md) | [Русский](../../ru/guides/practical-cli-patterns.md) | 简体中文

> 本文是英文版的简体中文翻译。如有差异，以英文版为准。

这些示例展示构建在 icore 之上的 application-level patterns。它们使用中性的
命令名称，但相关结构面向具有大量命令、共享 options、utility commands 和
compatibility behavior 的真实 CLI 应用。

## 全局 help 和 version 快捷方式

在大型 CLI 中，`--help`、`-h`、`--version` 和 `-v` 经常需要在命令执行前
生效。它们不应要求 command-specific required options 或 runtime context。

icore 不会自动提供这种行为，因为它属于应用策略，而不是 command mechanics。
将它明确放在 bootstrap runner 中最为清晰：utility shortcuts 可以绕过特定
命令的 validation，普通命令则继续使用 registry 与自己的 schemas。

请把这段逻辑放在 bootstrap runner 中，并在 command registry 执行业务命令
之前运行：

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

短 aliases 属于 schema behavior：`parseArgv(...)` 将 `-h` 映射到 `help`，
将 `-v` 映射到 `version`。应用不需要规范化 argv，也不需要分别声明 `h`
和 `v` options。

这里只验证 bootstrap 拥有的 options。Command-specific options 会在 `rest`
中返回以供检查，但通常仍应保留在传给 `app.prepare(...)` 的原始 argv 中。
不要根据 subset result 重建 command argv。这样可避免 global parsing 在命令
解析前错误地拒绝、重排或丢弃有效 command options。

应包含所有其类型会影响 token ownership 的 bootstrap options。本例将
`offline` 声明为 boolean，因此 shortcut parsing 不会把后续 command segment
作为它的值。

用户可以请求顶层 help：

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

用户可以在不提供 command required options 的情况下请求 command help：

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

Version 既可以是命令，也可以是全局 shortcut：

```bash
workspace-cli version
workspace-cli --version
workspace-cli -v
```

应用输出 runtime 信息：

```text
workspace-cli 1.4.0
node v24.13.1
platform linux x64
```

无效的 boolean assignments 仍会在命令执行前被拒绝：

```bash
workspace-cli --help=false
```

终端显示：

```text
Expected '--help' as boolean flag
```

## 将工具命令作为普通命令

Utility commands 可以与应用其余部分使用同一个 command registry。下面的
命令接受额外 positionals，因此 `help jobs run` 可以指向另一条命令：

这种方式通常比在 registry 外硬编码 utility commands 更合适，因为 `help`
和 `version` 仍是可见的公共命令。其代价是：如果 `--help`、`-h`、
`--version` 和 `-v` 属于公共接口，bootstrap 仍需处理这些 shortcuts。

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

这样 utility command routing 保持显式。实际 help 与 version 文本仍由应用
拥有。

## 根据命令元数据构建 help

将 help 文本保存在每个 command definition 中，再从
`commands.definitions` 构建 help inventory。Definitions 只包含 canonical
commands，因此 aliases 不会产生重复条目：

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

使用 `commandHelpEntries` 生成顶层与分组 help。对于特定命令的 help，将请求的
path 与 `definition.path`、`definition.aliases` 匹配，但渲染时使用
`definition.path` 中的 canonical path。

`icore` 会公开 definitions 和类型化 metadata，但有意不决定 help 的 layout、
措辞、分组方式或 aliases 是否可见。这些仍属于应用策略。

## 应用共享选项

实际命令经常复用 connection、output 或 runtime switches。请保持这些 schemas
小而专注，并与 command-specific schemas 组合：

当相同 options 出现在多条命令中时，组合很有价值；但这并不意味着应为仅
使用一次的 options 创建 generic schemas。若一个 option 只被一条命令使用，
就在该命令中直接定义。

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

用户可以组合共享 options 与 command-specific options：

```bash
workspace-cli jobs list --profile staging --format json --status failed --limit 10
```

Command handler 收到：

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

## 已弃用的选项别名

重命名公共 CLI option 时，请将 compatibility option 放在 canonical option
附近，并显式处理冲突：

这不是最简洁的契约，但当现有用户可能依赖旧名称时很有用。让 deprecated
option 在代码中保持可见，使用时发出 warning，同时拒绝同时传入两个名称的
歧义调用。

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

Canonical option 不输出警告：

```bash
workspace-cli catalog get --item-id=item-42
```

Deprecated option 可以继续工作，同时应用向 stderr 输出 warning：

```bash
workspace-cli catalog get --legacy-id=item-42
```

终端可以显示：

```text
Warning: '--legacy-id' is deprecated; use '--item-id' instead.
```

同时使用两个 options 会被拒绝：

```bash
workspace-cli catalog get --item-id=item-42 --legacy-id=item-42
```

终端显示：

```text
Use either '--item-id' or deprecated '--legacy-id', not both
```

## 值得测试的边界情况

Boolean flags 不会把下一个 token 当作值：

这是有意的行为，可以防止 `--offline false` 悄悄表示与受支持 boolean syntax
不同的含义。

```bash
workspace-cli jobs list --offline false
```

Parser 得到 `offline: true`，并将 `false` 留作 positional token。如果命令不
允许额外 positionals，command validation 会拒绝它。

schema 已知的 string 和 number options 可以取得以短横线开头的值：

这正是 parsing 需要 command schema 的原因。没有 schema 时，`-draft` 或
`-1` 可能被误认为另一个 option-like token。

```bash
workspace-cli search --query -draft --limit -1
```

这对搜索文本和有符号数字很有用。Schema validation 之后仍可拒绝解析后的
值，例如 `limit` 设置了 `min: 1` 时。

选项终止符会将其后的所有内容变成 positional input：

当用户需要把看起来像 option 的文本传给应用本身时，这很有用。

```bash
workspace-cli search -- --query -draft --offline
```

Tokens `--query`、`-draft` 和 `--offline` 不再被解析为 options。

重复的长形式与短形式会被作为同一个参数拒绝：

拒绝 duplicates 比“最后一个值优先”更严格，但能避免 command contracts 中
隐藏的优先级规则。

```bash
workspace-cli jobs list --offline -o
```

当 `offline` 声明了 `alias: 'o'` 时，这就是 duplicate。
