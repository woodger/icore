# icore

[![npm version](https://img.shields.io/npm/v/icore.svg)](https://www.npmjs.com/package/icore)
[![node](https://img.shields.io/node/v/icore.svg)](https://www.npmjs.com/package/icore)
[![types](https://img.shields.io/npm/types/icore.svg)](https://www.npmjs.com/package/icore)
[![license](https://img.shields.io/npm/l/icore.svg)](LICENSE)

> 本文是[英文版](readme.md)的简体中文翻译。如有差异，以英文版为准。

[Русская версия](readme.ru.md)

一个面向 [Node.js®](https://nodejs.org) 应用的小型、无运行时依赖的命令行
界面与终端呈现机制模块。

`icore` 负责从 `process.argv` 到终端输出的整条路径：

- 声明式、可推导类型的选项 schema；
- 支持 canonical command aliases 的多段命令解析；
- 相互分离的 prepare 和 execute 阶段；
- JSON、CSV 与文本表格呈现；
- 感知 backpressure 的 stdout/stderr writers，以及可复用的 terminal error policy。

应用特有的 API 调用、配置、领域行为和 help 文本仍由使用方应用负责。

## 要求与安装

`icore` 要求 Node.js `>=16.9.0`，并包含 TypeScript declarations。

```sh
npm install icore
```

请从 `icore` 导入公共 API。对 `dist` 或 `src` 的 deep imports 不属于包契约。

## 目录

- [快速开始](#快速开始)
- [选择 API 层级](#选择-api-层级)
- [支持的参数语法](#支持的参数语法)
- [错误处理](#错误处理)
- [指南](#指南)
- [项目边界](#项目边界)

## 快速开始

创建命令，将它们放入 registry，然后把该 registry 传给
`createTerminalApp()`：

```ts
import {
  createCommand,
  createTerminalApp
} from 'icore';

const command = createCommand();

const commands = command.registry([
  command.define({
    path: ['hello'],
    options: {
      name: {
        type: 'string',
        default: 'world'
      },
      uppercase: {
        type: 'boolean'
      }
    },
    handle({ options }) {
      const greeting = `Hello, ${options.name}!`;

      return `${options.uppercase ? greeting.toUpperCase() : greeting}\n`;
    }
  })
] as const);

const app = createTerminalApp({ commands });

async function main(args: readonly string[]): Promise<void> {
  process.exitCode = await app.run(args, undefined, {
    strict: true
  });
}

void main(process.argv.slice(2));
```

编译应用后：

```console
$ node dist/cli.js hello
Hello, world!

$ node dist/cli.js hello --name Alice --uppercase
HELLO, ALICE!
```

schema 决定 handler 的选项类型。必填选项和具有默认值的选项始终存在；
可选项返回 `T | undefined`。

具有共享 context、result 和 metadata 契约的应用可以通过
`createCommand.withTypes<...>()` 一次性绑定这些类型，同时仍会为每条命令
推导 schema、path、aliases、准备后的 payload 和具体 result 类型。参见
[一次性绑定应用命令类型](docs/zh/guides/option-schemas.md#一次性绑定应用命令类型)。

`app.run(...)` 是精简路径。若应用需要处理全局 shortcuts、在准备后选择
runtime 资源或自行执行 cleanup，请使用
[生产级终端应用 lifecycle](docs/zh/guides/terminal-app.md)。

`strict: true` 会拒绝 command path 之前的 options。字符串输出会原样写入，
因此逐行输出时请在命令结果中添加 `\n`。默认解析仍接受 option-first
input。Bootstrap parsing 不会重排 argv，因此只有当 command-first syntax
属于应用的公共 CLI 契约时，才应启用 strict mode。

## 选择 API 层级

请从适合应用的最高层 API 开始：

| 任务 | 起点 | 详细指南 |
| --- | --- | --- |
| 简单终端应用 | `app.run(...)` | [快速开始](#快速开始) |
| 生产级 shortcuts 与资源 lifecycle | `app.prepare(...)` 和 `app.commands.run(...)` | [生产级终端应用](docs/zh/guides/terminal-app.md) |
| 命令与选项 schemas | `createCommand()`、`createCommand.withTypes()` 或 `createCommands()` | [选项模式](docs/zh/guides/option-schemas.md) |
| 自定义 prepare/execute lifecycle | `commands.prepare()` 和 `commands.run()` | [Custom Command Flow（英文）](docs/guides/custom-command-flow.md) |
| 所有格式共用一个扁平 projection | `createPresentation()` | [Presentation And Output（英文）](docs/guides/presentation-output.md) |
| JSON、table 或 CSV 使用不同 projections | `renderJson()`、`renderTextTable()` 或 `renderCsv()` | [Presentation And Output（英文）](docs/guides/presentation-output.md) |
| 显式写入 stdout/stderr | `createOutput()` | [Output Writers（英文）](docs/guides/output-writers.md) |
| parser 与 resolver primitives | `parseArgv()`、`resolveCommand()` 及相关 exports | [Primitive Mechanics（英文）](docs/guides/readme.md#primitive-mechanics) |

`createTerminalOutput()` 和 `createTerminalProgress()` 在 `2.x` 分支中仍作为
已弃用的 compatibility exports 提供。新 Consumer 不应使用它们：interactive
output 与 progress rendering 应由应用拥有。`createOutput()` 会处理 sink 的
backpressure，但不会把 application-owned progress 与普通输出串行化。推荐的
边界见 [application-owned output guide（英文）](docs/guides/output-writers.md#application-owned-interactive-output)，
保留的 [migration guide（英文）](docs/guides/interactive-output.md) 则说明旧版
契约。

终端应用提供以下主要 lifecycle 操作：

- `app.run(args, context, options?)` 执行 prepare、execute、render 和 write；
- `app.prepare(args, options?)` 在没有 runtime context 时验证输入；
- `app.runPrepared(prepared, context)` 执行已准备的命令；
- `app.writePreparedOutput(prepared, output)` 写入 caller 得到的 output；
- `app.reportError(error, context?)` 应用配置的 terminal error policy，并返回
  process-style exit code。

空 command registry 是 bootstrap-only `TerminalApp` 的受支持场景。它可在
完整 registry 加载前处理 caller-owned global shortcuts，并使用 presentation、
output 或 `reportError(...)`。空 registry 中没有可解析的命令：应创建另一个
含完整命令 registry 的应用，并复用相同的 output 与 error policy，而不是
原地修改 registry。

Command handlers 会收到解析后的 `options`、记录选项是否由用户提供的
`provided` metadata、剩余 `positionals`、caller-owned `context` 和可选的
prepared `payload`。

受支持的 terminal results 包括字符串、字符串异步流、presentation results
和 `undefined`。

在将未知的 caller-owned result 传给 `app.writePreparedOutput(...)` 之前，
使用 `isTerminalCommandOutput(...)` 缩小其类型。

文本表格 rendering 仅支持 plain-text cells。列宽通过 JavaScript string
length 计算，因此 ANSI sequences、emoji、combining characters、tabs 和
full-width Unicode 可能无法正确对齐。

```text
argv → resolve → validate/prepare → execute → render → stdout/stderr
```

公共 exports 的准确列表位于
[`src/index.ts`](https://github.com/woodger/icore/blob/main/src/index.ts) 以及
包内的 TypeScript declarations。Consumer 从包根目录导入这些 API；内部
module paths 不会导出。

## 支持的参数语法

受支持的语法有意保持精简和可预测：

| 形式 | 示例 | 说明 |
| --- | --- | --- |
| 带独立值的长选项 | `--name Alice` | String 与 number options 会取得该值 |
| 带连接值的长选项 | `--name=Alice` | 等同于独立形式 |
| Boolean flag | `--verbose` | 返回 `true` |
| Boolean negation | `--no-cache` | 对已知 boolean options 生效，但 `syntax: 'flag'` 除外 |
| 短 alias | `-v`、`-n Alice` | 必须在 schema 中声明为单个 ASCII 字母 |
| 选项终止符 | `--` | 后续每个 token 都成为 positional |

选项名称必须精确匹配：`icore` 不会把 `camelCase` 转换为 `kebab-case`。
不支持 `--verbose=true` 这样的显式 boolean values、`-nAlice` 这样的连接短值，
以及 `-abc` 这样的分组 aliases。

Parsing examples、edge cases、duplicate handling 与终止符契约见
[CLI Argument Syntax（英文）](docs/guides/cli-argument-syntax.md)。

## 错误处理

CLI parsing、validation、resolution 和 definitions 产生的错误用
`IcoreError` 表示。它扩展 `Error` 并包含：

- 稳定、机器可读的 `code`；
- `usage` 或 `definition` category；
- 与错误 code 对应的必填 `details`。

请使用 `isIcoreError(...)`，而不是手动转换 details。向 guard 传入 code
会缩小到对应的 details 结构：

```ts
import {
  createTerminalApp,
  isIcoreError,
  isUsageError
} from 'icore';

const help = 'Usage: cli hello [--name value]';

const app = createTerminalApp({
  commands,
  errorPolicy: {
    renderError(error) {
      const message = error instanceof Error
        ? error.message
        : String(error);

      if (isIcoreError(error, 'UNKNOWN_COMMAND')) {
        return `${message}\n\n${help}\n`;
      }

      return `${message}\n`;
    },
    resolveExitCode(error) {
      return isUsageError(error) ? 2 : 1;
    }
  }
});
```

在 `UNKNOWN_COMMAND` 分支内，`error.details.command` 和
`error.details.positionals` 等字段均具有严格类型。
`IcoreErrorDetailsMap` 是每种 code 的公共 source of truth。直接调用
`new IcoreError(...)` 时，必须提供与所选 code 匹配的第三个参数。

Application-owned semantic validation 可以抛出 `CliUsageError`，而不必为
错误分配 framework-owned `IcoreError` code：

```ts
import { CliUsageError } from 'icore';

throw new CliUsageError(
  "Expected '--from' to be earlier than or equal to '--to'"
);
```

`isUsageError(...)` 会识别 `CliUsageError`，以及 category 为 `usage` 的
`IcoreError` 实例。Rendering、help text 与 exit code 选择仍由应用决定。

两个 guards 都能识别同一 JavaScript realm 中由另一份物理 `icore` 副本
创建的兼容 branded errors。这不会把经 JSON、IPC 或 worker boundaries
序列化的错误恢复成类实例。

未提供 custom policy 时，终端应用会写入 `Error.message + "\n"`；对于其他
抛出值则写入 `String(error) + "\n"`，并返回 exit code `1`。应用特有的 help
仍属于应用策略。

Custom lifecycle 可以调用 `app.reportError(...)` 来复用相同的 rendering 和
exit-code policy。prepare、execute、write 与 external 各阶段的完整 flow 见
[生产级 lifecycle](docs/zh/guides/terminal-app.md#资源清理与错误顺序的所有权)。

## 指南

[中文指南索引](docs/zh/guides/readme.md) 从普通终端应用逐步通向底层机制。
建议从以下文档开始：

- [生产级终端应用](docs/zh/guides/terminal-app.md) — global shortcuts、
  preparation、按 metadata 选择资源、execution、output、cleanup 与可复用的
  error handling；
- [选项模式](docs/zh/guides/option-schemas.md) — strings、booleans、numbers、
  choices、defaults、aliases 和推导类型；
- [实用 CLI 模式](docs/zh/guides/practical-cli-patterns.md) — help/version
  shortcuts、共享 options 和 compatibility aliases；
- [Command Resolution（英文）](docs/guides/command-resolution.md) — registry、
  canonical aliases、matched paths、显式解析与 command-name guards；
- [Two-Phase Primitives（英文）](docs/guides/two-phase-primitives.md) —
  preparation、payloads、execution 与已提供选项的 metadata；
- [Presentation Primitives（英文）](docs/guides/presentation-primitives.md) —
  text、record、table、CSV、JSON 与 direct renderers。

版本历史见 [CHANGELOG.md](CHANGELOG.md)，指导性决策见
[docs/roadmap.md](docs/roadmap.md)。这些文档使用英文维护。

## 项目边界

`icore` 是一个小型终端机制模块，负责 generic behavior：选项 validation、
command resolution、handler 的类型化输入、presentation rendering、error
contracts，以及向 stdout/stderr 的输出。

它不负责应用 DTO mapping、API calls、配置加载、domain-specific validation、
resource lifecycle 或 help 内容。这些职责留给 Consumer。Interactive line
rendering 与 progress reporting 同样属于应用；旧版 compatibility exports
不应成为新代码的基础。

项目采用 [MIT 许可证](LICENSE)。
