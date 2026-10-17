# 指南

[English](../../guides/readme.md) | [Русский](../../ru/guides/readme.md) | 简体中文

> 本文是英文版的翻译。如有差异，以英文版为准。

这些指南说明应用如何使用 `icore`。请从要完成的任务开始；后面的章节介绍需要由应用掌握更多控制权时可直接使用的 API。

部分详细指南暂时只有英文版；以下链接用中文说明其内容。

## 构建终端应用

- [配置命令执行和资源清理](terminal-app.md) — 全局选项、资源创建和清理、输出与错误处理。[README 快速开始](../readme.md#快速开始)展示了 `app.run(...)`。
- [常用 CLI 模式](practical-cli-patterns.md) — 帮助和版本命令、公共选项与兼容性别名。

## 描述命令和选项

- [描述命令选项](option-schemas.md) — 字符串、布尔值、数值、允许值、默认值、别名和 TypeScript 类型推导。
- [参数语法](../../guides/cli-argument-syntax.md) — `icore` 接受的命令行参数写法。
- [手动准备并执行命令](../../guides/custom-command-flow.md) — 不通过终端应用来准备和执行命令。
- [格式化并写入输出](../../guides/presentation-output.md) — 不执行命令时准备并写入输出。

## 直接 API

- [直接查找命令](../../guides/command-resolution.md) — 命令注册表、别名、匹配到的命令名和直接查找。
- [直接准备、执行和解析参数](../../guides/two-phase-primitives.md) — 直接调用准备、执行和解析函数。
- [准备输出数据](../../guides/presentation-primitives.md) — 文本、记录、表格、CSV、JSON 和直接格式化函数。
- [直接写入输出](../../guides/output-writers.md) — 标准输出、标准错误和自定义目标的写入。

## 为现有集成保留的 API

这些 API 仍然公开，但新应用通常应从上面列出的 API 开始。

- [直接查找命令](../../guides/command-resolution.md)说明 `resolveCommandFromArgs(...)`。
- [直接准备、执行和解析参数](../../guides/two-phase-primitives.md)说明 `parseOptionsDetailed(...)` 和 `parseOptionsSubsetDetailed(...)`。
