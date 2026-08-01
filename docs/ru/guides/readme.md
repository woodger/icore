# Руководства

> Русский перевод [английской версии](../../guides/readme.md). При расхождении
> актуальной считается английская версия.

[简体中文](../../zh/guides/readme.md)

Эти руководства показывают application code для Consumer-проектов. Они
объясняют, что поместить в проект, как запустить его из терминала, какой output
ожидать и почему конкретная структура полезна или намеренно ограничена.

## Терминальное приложение

- [terminal-app.md](terminal-app.md) — основной production recipe для global
  shortcuts, preparation, ресурсов на основе metadata, execution, output,
  cleanup и обработки ошибок. Компактный путь `app.run(...)` приведён в
  [быстром старте README](../../../readme.ru.md#быстрый-старт).
- [practical-cli-patterns.md](practical-cli-patterns.md) показывает
  application-level patterns для schema-aware глобальных help/version
  shortcuts, help на основе command metadata, deprecated options и обработки
  edge cases аргументов.

## Инструменты слоёв

- [option-schemas.md](option-schemas.md) показывает, как описывать string,
  boolean и number options с defaults, choices, aliases и выводимыми типами
  TypeScript.
- [CLI Argument Syntax (English)](../../guides/cli-argument-syntax.md) описывает
  поддерживаемый синтаксис CLI-аргументов с примерами terminal input.
- [Custom Command Flow (English)](../../guides/custom-command-flow.md)
  показывает явное использование `commands.prepare(...)`,
  `commands.run(...)` и `commands.runFromArgs(...)` без output и error-policy
  boundary терминального приложения.
- [Presentation And Output (English)](../../guides/presentation-output.md)
  показывает presentation rendering и запись output без command execution.

## Низкоуровневая механика

- [Command Resolution (English)](../../guides/command-resolution.md) показывает
  command registries, canonical aliases, matched paths, explicit resolution,
  command-name guards и отдельные command definitions.
- [Two-Phase Primitives (English)](../../guides/two-phase-primitives.md)
  описывает низкоуровневые primitives preparation и execution, используемые за
  command facades.
- [Presentation Primitives (English)](../../guides/presentation-primitives.md)
  показывает явные presentation views, renderers и format guards.
- [Output Writers (English)](../../guides/output-writers.md) показывает
  stdout/stderr writer primitives, подключение custom sink и application-owned
  boundary интерактивного output.

## Legacy compatibility

- [Interactive Output And Progress (English)](../../guides/interactive-output.md)
  описывает deprecated-контракты terminal output и progress ветки `2.x` только
  для миграции. Новый код должен следовать application-owned pattern из
  [Output Writers (English)](../../guides/output-writers.md).

## Кандидаты на compatibility и переработку

Некоторые примеры намеренно показывают публичные API, которые полезны, но не
рекомендуются как первый выбор для нового application code. Trade-off отмечен
рядом с использованием метода.

- [Command Resolution (English)](../../guides/command-resolution.md) описывает
  `resolveCommandFromArgs(...)`.
- [Two-Phase Primitives (English)](../../guides/two-phase-primitives.md)
  описывает `parseOptionsDetailed(...)` и
  `parseOptionsSubsetDetailed(...)`.
