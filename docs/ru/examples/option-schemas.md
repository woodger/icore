# Описание опций команд

[English](../../examples/option-schemas.md) | Русский | [简体中文](../../zh/examples/option-schemas.md)

> Русский перевод английской версии. При расхождении актуальной считается английская версия.

Используйте описание опций, чтобы задать публичные аргументы команды. Оно определяет, что пользователь может ввести в терминале и какие типизированные значения получит функция команды.

Описание опций охватывает строки, логические и числовые значения и правила их проверки. Разбор, зависящий от конкретного приложения, и его правила предметной области остаются в приложении.

## Начните с одной команды

Размещайте команду рядом с кодом приложения, который её выполняет.

Для большинства команд это понятнее центрального файла «всех опций». Читатель видит рядом интерфейс командной строки и функцию, которая выполняет команду.

Пример команды:

```bash
node dist/cli.js reports list --project alpha --format json --archived --limit 5
```

Ниже описаны команда `reports list` и её опции:

```ts
// Опишите опции, которые принимает `reports list`.
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

// Выведите тип объекта, который получает функция команды.
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

Для этой командной строки функция команды получает:

```json
{
  "project": "alpha",
  "format": "json",
  "archived": true,
  "limit": 5
}
```

Команда принимает одну обязательную строку, одну строку из списка значений, одно логическое значение и одно число в заданном диапазоне.

`as const` сохраняет перечисленные строковые значения для вывода типов TypeScript. Без него команда всё равно запустится, но TypeScript выведет более широкий и менее полезный тип.

## Общие типы для всех команд

Используйте `createCommand.withTypes<...>()`, только когда все команды используют одни и те же типы для:

- `context` — значения, которые приложение передаёт функции команды;
- `result` — значение, которое эта функция возвращает;
- `metadata` — неизменяемые сведения о команде, например её описание.

```ts
// Используйте эти типы, только если они нужны всем командам.
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

Тип `result` задаёт только самый широкий результат, который допускает приложение. TypeScript всё равно выводит для функции из примера `string`, а не более широкий `string | void`. Описание опций, имя команды, псевдонимы и подготовленные данные также остаются конкретными для `statusCommand`.

Не указывайте `metadataRequired`, если команда может не иметь `metadata`. Настройка влияет только на описания, созданные этим типизированным конструктором; обычные вызовы `createCommand()` и другие конструкторы не меняются.

Если у приложения нет общих `metadata`, укажите `metadata: undefined` в параметрах типа и не указывайте `metadataRequired`. Так решение остаётся явным, но свойство `metadata` не становится обязательным для каждой команды.

Параметры типа описывают независимые значения, которыми пользуется приложение. Если `metadata` зависит от точных опций команды, проверяйте эту связь в самой команде через `satisfies` или оставьте небольшой конструктор в приложении. Этот конструктор не создаёт `context`, подключения к базе данных, API-клиенты, обработчики сигналов или долгоживущие задачи: всё это создаёт приложение.

## Запуск из терминала

Та же команда также принимает объявленные короткие псевдонимы:

```bash
node dist/cli.js reports list -p alpha -l 5
```

Для опций, которые пользователь не указал, функция команды получает значения по умолчанию:

```json
{
  "project": "alpha",
  "format": "table",
  "archived": false,
  "limit": 5
}
```

Значения по умолчанию входят в интерфейс командной строки. Используйте их, только когда неявное значение очевидно и безопасно.

## Отключение логической опции

Известную логическую опцию можно выключить через `--no-<name>`:

```bash
node dist/cli.js reports list --project alpha --archived
node dist/cli.js reports list --project alpha --no-archived
```

Первая команда передаёт функции `archived: true`, вторая — `archived: false`.

Такая форма явнее, чем поддержка `--archived=false`, и не создаёт неоднозначных текстовых значений вроде `0`, `no` или `off`.

Не передавайте логические значения явно:

```bash
node dist/cli.js reports list --project alpha --archived=true
node dist/cli.js reports list --project alpha --archived=false
```

Обе формы отклоняются. Логические опции работают как флаги, а не принимают значения `true` / `false`.

## Опция, которая работает только как флаг

Используйте `syntax: 'flag'` для опций со значением «включить это поведение».

Это более строгое правило. Оно подходит для опций вроде `--dry-run`, где отсутствие флага уже имеет понятный смысл.

```ts
// Принимайте для этой опции только форму флага.
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

## Переиспользование общих описаний опций

Когда несколько команд используют одинаковые публичные опции, храните небольшие описания опций и объединяйте их в определении команды.

Это сокращает дублирование и не скрывает особенности команды. Оставляйте описание опции рядом с командой, если для его повторного использования требуется много исключений.

```ts
// Объедините повторно используемые опции постраничной выдачи и формата вывода.
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

Если имя опции повторяется, более позднее описание заменяет раннее. Делайте этот выбор заметным рядом с определением команды.

Для приложений с общими опциями, глобальными флагами справки или версии и старыми именами опций см. [Распространённые приёмы для CLI](practical-cli-patterns.md).
