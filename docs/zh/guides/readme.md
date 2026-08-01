# 指南

> 本文是[英文版](../../guides/readme.md)的简体中文翻译。如有差异，以英文版为准。

[Русская версия](../../ru/guides/readme.md)

这些指南展示了供使用方项目采用的应用代码。它们说明应在项目中放置
什么、如何从终端运行、预期得到什么输出，以及某种结构为何有用或为何
受到有意限制。

## 终端应用

- [terminal-app.md](terminal-app.md) 是处理全局快捷方式、准备、由 metadata
  驱动的资源、执行、输出、清理和错误报告的主要生产级方案。精简的
  `app.run(...)` 路径仍位于 [README 快速开始](../../../readme.zh.md#快速开始)中。
- [practical-cli-patterns.md](practical-cli-patterns.md) 展示应用层模式，包括
  schema-aware 的全局 help/version 快捷方式、由 command metadata 驱动的 help、
  已弃用选项和参数边界情况处理。

## 分层工具集

- [option-schemas.md](option-schemas.md) 展示如何描述带有默认值、choices、
  aliases 和 TypeScript 类型推导的 string、boolean 与 number options。
- [CLI Argument Syntax（英文）](../../guides/cli-argument-syntax.md) 通过终端输入
  示例说明受支持的 CLI 参数语法。
- [Custom Command Flow（英文）](../../guides/custom-command-flow.md) 展示如何在
  不经过终端应用的 output 和 error-policy 边界时，显式使用
  `commands.prepare(...)`、`commands.run(...)` 与
  `commands.runFromArgs(...)`。
- [Presentation And Output（英文）](../../guides/presentation-output.md) 展示不
  执行命令时的 presentation rendering 和 output writing。

## 底层机制

- [Command Resolution（英文）](../../guides/command-resolution.md) 展示 command
  registries、canonical aliases、matched paths、显式解析、command-name guards
  和独立的 command definitions。
- [Two-Phase Primitives（英文）](../../guides/two-phase-primitives.md) 介绍 command
  facades 背后使用的底层 preparation 与 execution primitives。
- [Presentation Primitives（英文）](../../guides/presentation-primitives.md) 展示
  显式 presentation views、renderers 和 format guards。
- [Output Writers（英文）](../../guides/output-writers.md) 展示 stdout/stderr
  writer primitives、自定义 sink 接线和由应用拥有的交互式 output 边界。

## 旧版兼容性

- [Interactive Output And Progress（英文）](../../guides/interactive-output.md)
  仅为迁移说明 `2.x` 分支中已弃用的 terminal output 与 progress contracts。
  新代码应采用 [Output Writers（英文）](../../guides/output-writers.md) 中由应用
  拥有的模式。

## 兼容性与重构候选项

部分示例有意展示仍然有用、但不推荐作为新应用代码首选的公共 API。
相关取舍会在方法使用位置附近说明。

- [Command Resolution（英文）](../../guides/command-resolution.md) 说明
  `resolveCommandFromArgs(...)`。
- [Two-Phase Primitives（英文）](../../guides/two-phase-primitives.md) 说明
  `parseOptionsDetailed(...)` 和 `parseOptionsSubsetDetailed(...)`。
