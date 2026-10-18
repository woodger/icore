# icore

[English](../../readme.md) | [Русский](../ru/readme.md) | 简体中文

[![npm version](https://img.shields.io/npm/v/icore.svg)](https://www.npmjs.com/package/icore)
[![node](https://img.shields.io/node/v/icore.svg)](https://www.npmjs.com/package/icore)
[![types](https://img.shields.io/npm/types/icore.svg)](https://www.npmjs.com/package/icore)
[![license](https://img.shields.io/npm/l/icore.svg)](../../LICENSE)

> 本文是英文版的翻译。如有差异，以英文版为准。

`icore` 是一个用于在 [Node.js®](https://nodejs.org/) 应用中构建命令行界面的 TypeScript 库。它帮助应用描述命令、解析参数、执行选中的命令，并输出文本、表格、JSON 或 CSV。

该库提供通用的命令行机制。API 调用、配置、领域规则、帮助文本和交互式终端行为仍由应用负责。

## 安装

要在项目中使用 `icore`，请运行：

```sh
npm install icore
```

## 快速开始

创建命令，将它们放入[命令注册表](../examples/command-resolution.md#create-a-commands-object-from-existing-definitions)，然后把注册表传给 `createTerminalApp()`：

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

构建应用后：

```console
$ node dist/cli.js hello
Hello, world!

$ node dist/cli.js hello --name Alice --uppercase
HELLO, ALICE!
```

`options` 对象描述 `hello` 后面可接受的参数。`handle` 函数会收到解析后的值。

`app.run(...)` 会验证参数、执行选中的命令、格式化结果并写入终端。使用 `strict: true` 时，必须先写命令名和子命令，再写选项：`users get --id 42`。

## 选择 API

| 应用需要什么 | 从这里开始 | 示例 |
| --- | --- | --- |
| 立即执行命令 | `app.run(...)` | [快速开始](#快速开始) |
| 处理全局选项，或创建和关闭资源 | `app.prepare(...)` 和 `app.commands.run(...)` | [配置命令执行和资源清理](examples/terminal-app.md) |
| 描述命令及其选项 | `createCommand()`、`createCommand.withTypes()` 或 `createCommands()` | [描述命令选项](examples/option-schemas.md) |
| 在创建应用服务前准备命令 | `commands.prepare()` 和 `commands.run()` | [手动准备并执行命令](../examples/custom-command-flow.md) |
| 为 JSON、表格和 CSV 使用相同字段或不同数据 | 相同字段使用 `createPresentation()`；不同数据使用 `renderJson()`、`renderTextTable()` 或 `renderCsv()` | [格式化并写入输出](../examples/presentation-output.md) |
| 直接写入标准输出或标准错误 | `createOutput()` | [写入输出](../examples/output-writers.md) |
| 直接解析参数或查找命令 | `parseArgv()`、`resolveCommand()` 和相关导出 | [直接 API](../examples/readme.md#direct-apis) |

## 错误

`IcoreError` 表示无效的命令行参数或无效的命令定义。使用 `isIcoreError(...)` 检查此类错误，并用 `isUsageError(...)` 识别由用户输入造成的错误。对于应用自己的输入规则，请抛出 `CliUsageError`。当前的错误类型和代码定义在[错误源文件](https://github.com/woodger/icore/tree/main/src/errors)中。

## 示例

[全部示例](examples/readme.md)按任务分组。

发布历史见 [CHANGELOG.md](../../CHANGELOG.md)，项目决策见 [docs/roadmap.md](../roadmap.md)。

项目采用 [MIT 许可证](../../LICENSE)。
