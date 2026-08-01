# Практические CLI-паттерны

> Русский перевод [английской версии](../../guides/practical-cli-patterns.md).
> При расхождении актуальной считается английская версия.

[简体中文](../../zh/guides/practical-cli-patterns.md)

Эти примеры показывают application-level patterns, построенные поверх icore.
В них используются нейтральные имена команд, но сами структуры рассчитаны на
реальные CLI-приложения с множеством команд, общими options, utility-командами
и compatibility behavior.

## Глобальные shortcuts help и version

В большом CLI `--help`, `-h`, `--version` и `-v` часто работают до выполнения
команды. Они не должны требовать обязательные options конкретной команды или
runtime context.

В icore это поведение не является автоматическим, потому что оно относится к
политике приложения, а не к command mechanics. Явная обработка в bootstrap
runner — наиболее понятный выбор: utility shortcuts могут обойти validation
конкретной команды, а обычные команды по-прежнему используют registry и
собственные schemas.

Поместите эту логику в bootstrap runner перед запуском business-команды через
command registry:

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

Короткие aliases задаются схемой: `parseArgv(...)` сопоставляет `-h` с `help`,
а `-v` — с `version`. Приложению не нужно нормализовать argv или объявлять
отдельные options `h` и `v`.

Здесь проверяются только options, принадлежащие bootstrap. Options конкретной
команды возвращаются в `rest` для анализа, но обычно должны оставаться в
исходном argv, передаваемом в `app.prepare(...)`. Не собирайте command argv
заново из subset result. Это предотвращает распространённую ошибку, при которой
global parsing отклоняет, меняет порядок или теряет допустимые command options
до разрешения команды.

Включайте каждую bootstrap option, тип которой влияет на владение tokens. В
этом примере `offline` объявлена boolean, поэтому shortcut parsing не примет
следующий сегмент команды за её значение.

Пользователь может запросить help верхнего уровня:

```bash
workspace-cli --help
workspace-cli -h
workspace-cli help
```

Приложение выводит список команд:

```text
Usage:
  workspace-cli <command> [options]

Commands:
  help [command]
  version
  jobs list
  jobs run
```

Пользователь может запросить help команды, не передавая её обязательные
options:

```bash
workspace-cli jobs run --help
workspace-cli help jobs run
```

Приложение выводит только эту команду:

```text
jobs run - Run a job

Usage:
  workspace-cli jobs run --job-id=ID [--dry-run]

Options:
  --job-id=value   Required job identifier
  --dry-run        Validate input without running the job
```

Version также может быть командой и глобальным shortcut:

```bash
workspace-cli version
workspace-cli --version
workspace-cli -v
```

Приложение выводит сведения о runtime:

```text
workspace-cli 1.4.0
node v24.13.1
platform linux x64
```

Некорректные присваивания boolean по-прежнему отклоняются до выполнения
команды:

```bash
workspace-cli --help=false
```

Терминал показывает:

```text
Expected '--help' as boolean flag
```

## Utility-команды как обычные команды

Utility-команды могут использовать тот же command registry, что и остальное
приложение. Следующая команда принимает дополнительные positionals, поэтому
`help jobs run` может адресовать другую команду:

Обычно этот подход лучше, чем жёстко задавать utility-команды вне registry:
`help` и `version` остаются видимыми публичными командами. Цена подхода —
bootstrap всё равно должен обрабатывать shortcuts `--help`, `-h`, `--version`
и `-v`, если эти формы входят в публичный интерфейс.

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

Так routing utility-команд остаётся явным. Текст help и version по-прежнему
принадлежит приложению.

## Построение help по command metadata

Храните текст help вместе с каждой command definition, а его inventory
стройте по `commands.definitions`. Definitions содержат только канонические
команды, поэтому aliases не создают повторяющиеся записи:

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

Используйте `commandHelpEntries` для help верхнего уровня и групп. Для help
конкретной команды сопоставляйте запрошенный path с `definition.path` и
`definition.aliases`, но выводите канонический path из `definition.path`.

`icore` предоставляет definitions и типизированные metadata, но намеренно не
выбирает layout, формулировки и группировку help и не решает, должны ли aliases
быть видимыми. Это остаётся политикой приложения.

## Общие options приложения

Реальные команды часто переиспользуют connection, output или runtime switches.
Храните такие schemas небольшими и объединяйте их с command-specific schemas:

Композиция полезна, когда одни options встречаются во многих командах. Это не
повод создавать generic schemas для одноразовых options. Если option нужна
только одной команде, определите её прямо в этой команде.

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

Пользователь может объединить общие и command-specific options:

```bash
workspace-cli jobs list --profile staging --format json --status failed --limit 10
```

Command handler получает:

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

## Deprecated aliases опций

При переименовании публичной CLI option держите compatibility option рядом с
канонической и разрешайте конфликт явно:

Это не самый чистый контракт, но он полезен, если существующие пользователи
уже зависят от старого имени. Оставьте deprecated option видимой в коде,
показывайте warning при её использовании и отклоняйте неоднозначные вызовы с
обоими именами.

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

Каноническая option не выводит предупреждений:

```bash
workspace-cli catalog get --item-id=item-42
```

Deprecated option продолжает работать, а приложение выводит warning в stderr:

```bash
workspace-cli catalog get --legacy-id=item-42
```

Терминал может показать:

```text
Warning: '--legacy-id' is deprecated; use '--item-id' instead.
```

Использование обеих options отклоняется:

```bash
workspace-cli catalog get --item-id=item-42 --legacy-id=item-42
```

Терминал показывает:

```text
Use either '--item-id' or deprecated '--legacy-id', not both
```

## Edge cases, которые стоит тестировать

Boolean flags не поглощают следующий token как значение:

Это намеренное поведение. Оно не позволяет `--offline false` незаметно
означать что-то отличное от поддерживаемого boolean syntax.

```bash
workspace-cli jobs list --offline false
```

Parser видит `offline: true` и оставляет `false` positional token. Если команда
не разрешает дополнительные positionals, command validation отклонит его.

Известные схеме string и number options могут поглощать значения, начинающиеся
с дефиса:

Именно поэтому при parsing передаётся command schema. Без схемы `-draft` или
`-1` можно ошибочно принять за очередной option-like token.

```bash
workspace-cli search --query -draft --limit -1
```

Это полезно для поискового текста и знаковых чисел. Schema validation всё равно
может позднее отклонить разобранное значение, например если у `limit` задано
`min: 1`.

Терминатор опций превращает всё после него в positional input:

Это полезно, когда пользователь передаёт приложению текст, похожий на option.

```bash
workspace-cli search -- --query -draft --offline
```

Tokens `--query`, `-draft` и `--offline` больше не разбираются как options.

Повторяющиеся длинная и короткая формы отклоняются как один аргумент:

Отклонение duplicates строже правила «последнее значение побеждает», но не
допускает скрытых правил приоритета в command contracts.

```bash
workspace-cli jobs list --offline -o
```

Это duplicate, если для `offline` объявлен `alias: 'o'`.
