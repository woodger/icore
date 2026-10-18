# 描述命令选项

[English](../../examples/option-schemas.md) | [Русский](../../ru/examples/option-schemas.md) | 简体中文

> 本文是英文版的简体中文翻译。如有差异，以英文版为准。

使用选项定义描述命令的公共参数。它说明用户可以在终端输入什么，以及执行命令的函数会收到哪些带类型的值。

选项定义涵盖字符串、布尔值、数值及其验证规则。依赖具体应用的解析和领域规则仍留在应用中。

## 从一条命令开始

将命令放在实现它的应用代码附近。

对大多数命令而言，这比集中维护一个“所有选项”文件更清楚。读者能在同一处看到命令行接口和执行命令的函数。

命令示例：

```bash
node dist/cli.js reports list --project alpha --format json --archived --limit 5
```

下面说明如何解析 `reports list` 及其选项：

```ts
// 说明 `reports list` 接受的选项。
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

// 获取命令函数的类型。
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

对于这条命令行，命令函数会收到：

```json
{
  "project": "alpha",
  "format": "json",
  "archived": true,
  "limit": 5
}
```

该命令接受一个必填字符串、一个限定为列出值的字符串、一个布尔值和一个范围受限的数值。

`as const` 会保留列出的字符串值，供 [TypeScript](https://www.typescriptlang.org/) 推导类型。如果省略，命令仍能运行，但 [TypeScript](https://www.typescriptlang.org/) 推导出的类型会更宽、作用更小。

## 为所有命令共享类型

只有当所有命令在下列内容上使用相同类型时，才使用 `createCommand.withTypes<...>()`：

- `context`：命令函数接收的值；
- `result`：该函数返回的值；
- `metadata`：命令的固定信息，例如描述。

```ts
// 只有所有命令都使用这些类型时才共享它们。
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

`result` 类型只定义应用允许的最宽结果。[TypeScript](https://www.typescriptlang.org/) 仍会把示例函数推导为返回 `string`，而不是更宽的 `string | void`。它的选项定义、命令名称、别名和准备后的数据也都保持为 `statusCommand` 的具体类型。

如果命令可以没有 `metadata`，请不要设置 `metadataRequired`。该设置只影响由这个带类型的构建器创建的定义；普通 `createCommand()` 调用和其他构建器不受影响。

如果应用没有共享的 `metadata`，请在类型参数中指定 `metadata: undefined`，并省略 `metadataRequired`。这样选择仍然明确，但不会要求每条命令都带有 `metadata` 属性。

类型参数描述应用使用的独立值。如果 `metadata` 依赖命令的确切选项，请在命令上使用 `satisfies` 检查这种关系，或在应用中保留一个小型构建器。该构建器不会创建 `context`、数据库连接、API 客户端、信号处理或长期运行的任务；这些由应用自己创建。

## 从终端运行

同一条命令也接受已声明的短别名：

```bash
node dist/cli.js reports list -p alpha -l 5
```

对于用户未提供的选项，命令函数会收到默认值：

```json
{
  "project": "alpha",
  "format": "table",
  "archived": false,
  "limit": 5
}
```

默认值是命令行接口的一部分。只有在隐含值明确且安全时才使用它们。

## 关闭布尔选项

已知的布尔选项可以通过 `--no-<name>` 关闭：

```bash
node dist/cli.js reports list --project alpha --archived
node dist/cli.js reports list --project alpha --no-archived
```

第一条命令向函数传入 `archived: true`，第二条传入 `archived: false`。

这种形式比支持 `--archived=false` 更明确，也不会产生 `0`、`no` 或 `off` 这类有歧义的文本值。

布尔选项**不支持**显式传入 `true` 或 `false`：

```bash
node dist/cli.js reports list --project alpha --archived=true
node dist/cli.js reports list --project alpha --archived=false
```

两种形式都会被拒绝。布尔选项作为标志使用，不接受 `true` / `false` 值。

## 只作为标志使用的选项

对于仅表示“启用此行为”的选项，请使用 `syntax: 'flag'`。

这是更严格的规则，适用于 `--dry-run` 等选项；此时不带标志本身已有清晰含义。

```ts
// 此选项只接受标志形式。
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

## 复用共享选项定义

当多条命令使用相同的公共选项时，请保留小型选项定义，并在定义命令时合并它们。

这样既能减少重复，也不会隐藏命令的特有部分。如果复用一个选项定义需要很多例外，就应把它留在命令旁边。

```ts
// 合并可复用的分页选项和输出选项。
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

如果选项名重复，后面的定义会替换前面的定义。请在命令定义旁边清楚地表明这是有意的。

涉及共享选项、全局帮助或版本标志以及旧选项名称的应用，请参阅[常用 CLI 模式](practical-cli-patterns.md)。
