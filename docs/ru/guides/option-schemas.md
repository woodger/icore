# Схемы опций

> Русский перевод [английской версии](../../guides/option-schemas.md). При
> расхождении актуальной считается английская версия.

[简体中文](../../zh/guides/option-schemas.md)

Используйте option schemas для описания публичных аргументов команды. Схема
определяет, что пользователь может ввести в терминале и какие типизированные
значения получит command handler.

Схема намеренно невелика: она охватывает примитивные CLI-типы и правила
validation, а application-specific parsing остаётся в приложении. Благодаря
этому icore остаётся переиспользуемым, а domain rules не проникают в command
mechanics.

## Начните с одной команды

Размещайте команду рядом с application code, которому принадлежит её
поведение.

Для большинства команд это предпочтительнее центрального файла «всех опций».
Читатель видит рядом публичный CLI-контракт и handler.

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

Теперь команда принимает одну обязательную string option, одну string option с
choices, одну boolean option и одну ограниченную number option.

`as const` важен, потому что сохраняет literal choices для вывода типов
TypeScript. Без него handler продолжит работать в runtime, но выведенный тип
будет шире и менее полезен.

## Однократная привязка типов команд приложения

Используйте `createCommand.withTypes<...>()`, когда все команды приложения имеют
общие контракты context, result и metadata:

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

Result binding является верхней границей: handler из примера по-прежнему
выводится как возвращающий `string`, а не более широкий `string | void`.
Schema, literal canonical и alias paths, а также подготовленный payload тоже
остаются конкретными для `statusCommand`.

Не указывайте `metadataRequired`, если команды могут не иметь metadata.
Настройка изменяет только definitions, созданные этим bound builder; обычный
`createCommand()` и другие builders сохраняют прежние контракты.

Если у приложения нет контракта command metadata, укажите
`metadata: undefined` в bindings и не указывайте `metadataRequired`. Общая
привязка останется явной, но command definitions не будут обязаны иметь
свойство metadata.

Bindings описывают независимые application-level types. Если metadata зависит
от точной option schema, проверяйте эту связь для каждой команды через
`satisfies` или оставьте небольшой application-owned wrapper. Bound builder не
создаёт context, resources, clients, signals или long-running handles; их
lifecycle остаётся application-owned.

## Запуск из терминала

Пользователь может передавать длинные опции:

```bash
node dist/cli.js reports list --project alpha --format json --archived --limit 5
```

Handler получает:

```json
{
  "project": "alpha",
  "format": "json",
  "archived": true,
  "limit": 5
}
```

Пользователь может передавать объявленные короткие aliases:

```bash
node dist/cli.js reports list -p alpha -l 5
```

Для опций, которых не было в input, handler получает defaults:

```json
{
  "project": "alpha",
  "format": "table",
  "archived": false,
  "limit": 5
}
```

Defaults полезны для стабильного поведения команды, но одновременно являются
частью публичного контракта. Используйте их только тогда, когда неявное значение
очевидно и безопасно.

## Использование boolean negation

Известную схеме boolean option можно выключить через `--no-<name>`:

```bash
node dist/cli.js reports list --project alpha --archived
node dist/cli.js reports list --project alpha --no-archived
```

Первая команда передаёт handler-у `archived: true`, вторая —
`archived: false`.

Такая форма явнее, чем поддержка `--archived=false`, и не создаёт неоднозначных
текстовых значений вроде `0`, `no` или `off`.

Не передавайте явные boolean values:

```bash
node dist/cli.js reports list --project alpha --archived=true
node dist/cli.js reports list --project alpha --archived=false
```

Обе формы отклоняются. Boolean options используют flag syntax, а не значения
`true` / `false`.

## Ограничение boolean option синтаксисом flag-only

Используйте `syntax: 'flag'` для опций, которые означают только «включить это
поведение».

Это более строгий контракт. Он подходит для опций вроде `--dry-run`, где
отсутствие flag уже имеет понятный смысл.

```ts
const schema = {
  'dry-run': {
    type: 'boolean',
    default: false,
    syntax: 'flag'
  }
} as const;
```

Терминал принимает:

```bash
node dist/cli.js reports list --dry-run
```

Терминал отклоняет:

```bash
node dist/cli.js reports list --no-dry-run
node dist/cli.js reports list --dry-run=false
```

## Переиспользование общих частей схемы

Когда несколько команд используют одинаковые публичные options, храните
небольшие части схем и объединяйте их на границе команды.

Это сокращает дублирование, не скрывая command-specific intent. Абстракция
становится неудачной, когда переиспользуемой схеме требуется много исключений
для отдельных команд.

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

Если имя опции повторяется, более поздняя схема переопределяет более раннюю.
Сохраняйте это поведение намеренным и заметным рядом с command definition.

Более крупные application patterns, объединяющие shared schemas, global
shortcuts и compatibility options, приведены в
[practical-cli-patterns.md](practical-cli-patterns.md).
