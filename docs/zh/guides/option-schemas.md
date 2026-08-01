# 选项模式

> 本文是[英文版](../../guides/option-schemas.md)的简体中文翻译。如有差异，
> 以英文版为准。

[Русская версия](../../ru/guides/option-schemas.md)

使用 option schemas 描述命令的公共参数。schema 决定用户可以在终端输入
什么，以及 command handler 会收到哪些类型化值。

schema 有意保持精简：它涵盖基本 CLI 类型和 validation rules，而应用特有的
parsing 留在应用中。这样既能保持 icore 可复用，也不会让 domain rules 渗入
command mechanics。

## 从一条命令开始

将命令放在拥有其行为的 application code 附近。

对大多数命令而言，这比集中维护一个“所有选项”文件更合适。读者可以在
同一位置看到公共 CLI 契约和 handler。

```ts
import {
  createCommand,
  type InferOptions
} from 'icore';

const command = createCommand();

const reportOptions = {
  project: {
    type: 'string',
    required: true,
    alias: 'p'
  },
  format: {
    type: 'string',
    choices: ['table', 'json', 'csv'],
    default: 'table'
  },
  archived: {
    type: 'boolean',
    default: false
  },
  limit: {
    type: 'number',
    integer: true,
    min: 1,
    max: 100,
    default: 20,
    alias: 'l'
  }
} as const;

type ReportOptions = InferOptions<typeof reportOptions>;

const reportCommand = command.define({
  path: ['reports', 'list'],
  options: reportOptions,
  handle({ options }: {
    options: ReportOptions;
  }) {
    return JSON.stringify(options, null, 2) + '\n';
  }
});
```

该命令现在接受一个必填 string option、一个带 choices 的 string option、
一个 boolean option 和一个受约束的 number option。

`as const` 很重要，因为它会保留 literal choices，供 TypeScript 推导类型。
如果省略，handler 在 runtime 仍可工作，但推导出的类型会更宽、作用更小。

## 一次性绑定应用命令类型

当应用的所有命令共享 context、result 和 metadata 契约时，请使用
`createCommand.withTypes<...>()`：

```ts
import { createCommand } from 'icore';

type CliCommandContext = {
  requestId: string;
};

type CliCommandResult = string | void;

type CliCommandMetadata = {
  description: string;
};

const command = createCommand.withTypes<{
  context: CliCommandContext;
  result: CliCommandResult;
  metadata: CliCommandMetadata;
  metadataRequired: true;
}>();

const statusCommand = command.define({
  path: ['system', 'status'],
  aliases: [
    ['health']
  ],
  options: {
    verbose: {
      type: 'boolean',
      default: false
    }
  },
  metadata: {
    description: 'Show system status'
  },
  prepare({ options }) {
    return {
      prefix: options.verbose ? 'System status' : 'Status'
    };
  },
  handle({ context, payload }) {
    return `${payload.prefix} (${context.requestId})\n`;
  }
});
```

Result binding 是上界：示例 handler 的返回值仍会被推导为 `string`，而不是
更宽的 `string | void`。schema、literal canonical 与 alias paths，以及
prepared payload 也都会保持为 `statusCommand` 的具体类型。

如果命令可以不带 metadata，请不要指定 `metadataRequired`。该设置只影响由
这个 bound builder 创建的 definitions；普通 `createCommand()` 和其他 builders
会保留原有契约。

如果应用没有 command metadata 契约，请在 bindings 中指定
`metadata: undefined`，并省略 `metadataRequired`。共享绑定仍然是显式的，
但 command definitions 不会被要求包含 metadata 属性。

Bindings 描述彼此独立的 application-level types。如果 metadata 依赖确切的
option schema，请对每条命令使用 `satisfies` 检查这种关系，或保留一个小型的
application-owned wrapper。Bound builder 不会创建 context、resources、clients、
signals 或 long-running handles；它们的 lifecycle 仍由应用拥有。

## 从终端运行

用户可以传入长选项：

```bash
node dist/cli.js reports list --project alpha --format json --archived --limit 5
```

Handler 收到：

```json
{
  "project": "alpha",
  "format": "json",
  "archived": true,
  "limit": 5
}
```

用户也可以传入已声明的短 aliases：

```bash
node dist/cli.js reports list -p alpha -l 5
```

对于 input 中未出现的选项，handler 会收到 defaults：

```json
{
  "project": "alpha",
  "format": "table",
  "archived": false,
  "limit": 5
}
```

Defaults 有助于保持命令行为稳定，但同时也是公共契约的一部分。只有当隐式值
明确且安全时才应使用它们。

## 使用布尔值取反

schema 已知的 boolean option 可以通过 `--no-<name>` 关闭：

```bash
node dist/cli.js reports list --project alpha --archived
node dist/cli.js reports list --project alpha --no-archived
```

第一条命令向 handler 传入 `archived: true`，第二条传入
`archived: false`。

这种形式比支持 `--archived=false` 更明确，也不会产生 `0`、`no` 或 `off`
这类有歧义的文本值。

不要传入显式 boolean values：

```bash
node dist/cli.js reports list --project alpha --archived=true
node dist/cli.js reports list --project alpha --archived=false
```

两种形式都会被拒绝。Boolean options 使用 flag syntax，而不是 `true` / `false`
值。

## 将布尔选项限制为仅标志语法

对于仅表示“启用此行为”的选项，请使用 `syntax: 'flag'`。

这是更严格的契约，适用于 `--dry-run` 等选项；此时 flag 缺失本身已有清晰
含义。

```ts
const schema = {
  'dry-run': {
    type: 'boolean',
    default: false,
    syntax: 'flag'
  }
} as const;
```

终端接受：

```bash
node dist/cli.js reports list --dry-run
```

终端拒绝：

```bash
node dist/cli.js reports list --no-dry-run
node dist/cli.js reports list --dry-run=false
```

## 复用模式的共享部分

当多条命令使用相同的公共 options 时，请保留小型 schema fragments，并在
命令边界处合并它们。

这样既能减少重复，也不会隐藏 command-specific intent。如果一个可复用
schema 需要为不同命令设置大量例外，它就不再是合适的抽象。

```ts
import { mergeOptionsSchema } from 'icore';

const pagingOptions = {
  limit: {
    type: 'number',
    integer: true,
    min: 1,
    max: 100,
    default: 20
  }
} as const;

const outputOptions = {
  format: {
    type: 'string',
    choices: ['table', 'json', 'csv'],
    default: 'table'
  }
} as const;

const options = mergeOptionsSchema(pagingOptions, outputOptions);
```

如果选项名重复，后面的 schema 会覆盖前面的 schema。请确保这种行为是有意
的，并且在 command definition 附近清晰可见。

组合 shared schemas、global shortcuts 和 compatibility options 的更大型应用
模式见 [practical-cli-patterns.md](practical-cli-patterns.md)。
