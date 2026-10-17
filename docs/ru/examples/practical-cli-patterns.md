# Распространённые приёмы для CLI

[English](../../examples/practical-cli-patterns.md) | Русский | [简体中文](../../zh/examples/practical-cli-patterns.md)

> Русский перевод английской версии. При расхождении актуальной считается английская версия.

Эти примеры показывают, как приложение может использовать `icore` для обычных задач командной строки. Имена команд здесь нейтральны, но примеры подходят приложениям с множеством команд, общими опциями, командами справки и версии и старыми именами опций.

## Глобальная справка и версия

В CLI с множеством команд `--help`, `-h`, `--version` и `-v` часто работают до выбора команды. Они не должны требовать значения, нужные только одной команде.

`icore` не обрабатывает эти флаги автоматически, потому что приложение само определяет смысл справки и версии. Обрабатывайте их до выбора команды. Тогда глобальные флаги могут обойти проверку конкретной команды, а обычные команды продолжат использовать реестр и собственные описания опций.

Разберите эти флаги до того, как реестр команд запустит команду приложения:

```ts
// Разберите только опции, которые работают до выбора команды.
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

Описание опций задаёт смысл `-h` и `-v`: `parseArgv(...)` сопоставляет их с `help` и `version`. Приложению не нужно переписывать аргументы или объявлять отдельные опции `h` и `v`.

Здесь проверяются только глобальные флаги. Опции команды возвращаются в `rest` для просмотра, но обычно остаются в исходных аргументах, передаваемых в `app.prepare(...)`. Не собирайте аргументы команды заново из частичного результата. Иначе глобальный разбор может отклонить, поменять местами или потерять допустимые опции до выбора команды.

Включайте каждую глобальную опцию, тип которой сообщает разборщику, поглощает ли она следующий аргумент. Здесь `offline` объявлена логической, поэтому разбор не примет следующий сегмент команды за её значение.

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

Пользователь может запросить help команды, не передавая её обязательные options:

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

Версия может быть и командой, и глобальным флагом:

```bash
workspace-cli version
workspace-cli --version
workspace-cli -v
```

Приложение выводит свою версию, версию Node.js и платформу:

```text
workspace-cli 1.4.0
node v24.13.1
platform linux x64
```

Некорректные логические значения по-прежнему отклоняются до выполнения команды:

```bash
workspace-cli --help=false
```

Терминал показывает:

```text
Expected '--help' as boolean flag
```

## Команды справки и версии

Справка и версия могут использовать тот же реестр команд, что и остальное приложение. Следующая команда принимает дополнительные позиционные аргументы, поэтому `help jobs run` может назвать другую команду:

Так `help` и `version` остаются видимыми публичными командами, а не задаются отдельно от реестра. Если приложение поддерживает `--help`, `-h`, `--version` и `-v`, оно всё равно должно обработать их до выбора команды.

```ts
// Оставьте справку и версию обычными командами в реестре.
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

Так маршрутизация команд справки и версии остаётся видимой. Текст справки и версии по-прежнему задаёт приложение.

## Построение справки из описаний команд

Храните текст справки вместе с определением команды, а список команд стройте по `commands.definitions`. В списке каждая основная команда встречается один раз, поэтому псевдонимы не создают повторов:

```ts
// Храните текст справки в определениях команд и стройте из них пункты списка.
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

Используйте `commandHelpEntries` для общей и групповой справки. Для справки по одной команде сопоставляйте запрошенное имя с `definition.path` и `definition.aliases`, но показывайте основное имя из `definition.path`.

`icore` предоставляет определения команд и типизированные описания, но приложение выбирает вид, формулировки и группировку справки, а также решает, показывать ли псевдонимы.

## Опции нескольких команд

Команды часто используют общие настройки подключения, вывода или флаги. Делайте такие описания опций небольшими и объединяйте их с опциями конкретной команды:

Общее описание опций полезно, когда одни и те же опции встречаются в нескольких командах. Если опция нужна только одной команде, определите её прямо в ней.

```ts
// Объедините общие опции с опциями, характерными для `jobs list`.
import {
  mergeOptionsSchema,
  type OptionsSchema
} from 'icore';

const sharedCliOptions = {
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

const listJobsOptions = mergeOptionsSchema(sharedCliOptions, outputOptions, {
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

Пользователь может объединить общие опции с опциями конкретной команды:

```bash
workspace-cli jobs list --profile staging --format json --status failed --limit 10
```

Функция команды получает:

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

## Старое имя опции при переименовании

При переименовании публичной опции CLI оставляйте старое имя рядом с новым и явно обрабатывайте вызов с обоими именами:

Существующие пользователи могут зависеть от старого имени. Оставьте его видимым в коде, выводите предупреждение при использовании и отклоняйте вызовы с обоими именами.

```ts
// Принимайте любое имя, но отклоняйте вызов, в котором указаны оба.
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

Новое имя опции не выводит предупреждений:

```bash
workspace-cli catalog get --item-id=item-42
```

Старое имя опции продолжает работать, а приложение выводит предупреждение в поток ошибок:

```bash
workspace-cli catalog get --legacy-id=item-42
```

Терминал может показать:

```text
Warning: '--legacy-id' is deprecated; use '--item-id' instead.
```

Использование обоих имён отклоняется:

```bash
workspace-cli catalog get --item-id=item-42 --legacy-id=item-42
```

Терминал показывает:

```text
Use either '--item-id' or deprecated '--legacy-id', not both
```

## Важные случаи разбора аргументов

Логические флаги не поглощают следующий аргумент как значение:

Это не позволяет `--offline false` незаметно означать что-то отличное от поддерживаемой формы логической опции.

```bash
workspace-cli jobs list --offline false
```

Разборщик видит `offline: true` и оставляет `false` как позиционный аргумент. Если команда не разрешает дополнительные позиционные аргументы, проверка его отклонит.

Строковые и числовые опции, описанные у команды, могут поглощать значения, начинающиеся с дефиса:

Именно поэтому разбор получает описание опций команды. Без него `-draft` или `-1` можно ошибочно принять за очередную опцию.

```bash
workspace-cli search --query -draft --limit -1
```

Это полезно для поискового текста и знаковых чисел. Проверка всё равно может позднее отклонить разобранное значение, например если у `limit` задано `min: 1`.

Терминатор опций превращает каждый следующий аргумент в позиционный:

Используйте его, когда приложению нужен текст, похожий на опцию.

```bash
workspace-cli search -- --query -draft --offline
```

`--query`, `-draft` и `--offline` больше не разбираются как опции.

Одновременное использование длинной опции и её короткого имени отклоняется:

Отклонение повторов не допускает скрытых правил о том, какое значение побеждает.

```bash
workspace-cli jobs list --offline -o
```

Это повтор, если для `offline` объявлен `alias: 'o'`.
