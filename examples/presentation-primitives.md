# Presentation Primitives

`createPresentation()` is the preferred entrypoint for terminal rendering. The
primitives below are useful when a command needs explicit view types or when an
adapter wants to use a renderer directly.

Prefer `presentation.render(...)` first. Direct renderers are lower-level and
make the caller responsible for choosing the right input shape.

## Empty And Text Views

Use `presentation.empty()` when a command succeeds without terminal output.
Use `presentation.text(...)` when the command already owns final text.

```ts
import { createPresentation } from 'icore';

const presentation = createPresentation();

const noOutput = presentation.empty();
const readyText = presentation.text('cache cleared\n');
```

These views are format-independent. Rendering them as `table`, `json`, or `csv`
does not invent structure.

## Record And Records Views

Use `record(...)` and `records(...)` when application data can be represented as
generic key/value objects.

```ts
const oneJob = presentation.record({
  id: 'job-42',
  status: 'running'
});

const manyJobs = presentation.records([
  {
    id: 'job-41',
    status: 'done'
  },
  {
    id: 'job-42',
    status: 'running'
  }
]);

presentation.render(oneJob, 'table');
presentation.render(manyJobs, 'json');
```

This is the most convenient view for regular reports. The tradeoff is that
field selection has to happen before the view is created; generic presentation
code should not inspect domain objects.

## Explicit Table And CSV Views

Use `table(...)` when the application already owns prepared text cells.
Use `csv(...)` when the application already owns CSV scalar rows.

```ts
const table = presentation.table([
  ['id', 'status'],
  ['job-41', 'done'],
  ['job-42', 'running']
]);

const csv = presentation.csv([
  ['id', 'status'],
  ['job-41', 'done'],
  ['job-42', 'running']
]);
```

These forms are less convenient than `records(...)`, but they are useful when
the application needs full control over column sequence and cell values.

## Supported Formats

Use `presentation.formats`, `presentationFormats`, and
`isPresentationFormat(...)` when a custom boundary accepts a format option.

```ts
import {
  isPresentationFormat,
  presentationFormats
} from 'icore';

function normalizeFormat(value: unknown) {
  return isPresentationFormat(value) ? value : 'table';
}

presentation.formats;
presentationFormats;
```

This keeps format checks aligned with the renderer. Avoid copying the string
union into application code.

## Render Through The Facade

`presentation.render(...)` delegates to `renderPresentationResult(...)`.

```ts
import { renderPresentationResult } from 'icore';

const view = presentation.records([
  {
    id: 'job-42',
    status: 'running'
  }
]);

const fromFacade = presentation.render(view, 'csv');
const fromPrimitive = renderPresentationResult(view, 'csv');
```

Prefer the facade in application code. The standalone function is useful for
tests or custom presentation objects.

## Check Presentation Results

Use `isPresentationResult(...)` before rendering unknown command output.

```ts
import { isPresentationResult } from 'icore';

function renderUnknown(value: unknown): string {
  if (!isPresentationResult(value)) {
    throw new Error('Expected presentation result');
  }

  return presentation.render(value, 'table');
}
```

This is useful at generic boundaries. Inside a command handler, returning a
known presentation view is usually clearer.

## Use Direct Renderers

The facade exposes renderers for code that already has renderer-specific input.

```ts
const jsonText = presentation.renderers.json.render({
  ok: true
});

const tableText = presentation.renderers.table.render([
  ['field', 'value'],
  ['ok', 'true']
]);

const csvRow = presentation.renderers.csv.renderRow([
  'job-42',
  'running'
]);

const csvText = presentation.renderers.csv.render([
  ['id', 'status'],
  ['job-42', 'running']
]);
```

The standalone functions provide the same lower-level behavior:

```ts
import {
  renderCsv,
  renderCsvRow,
  renderJson,
  renderTextTable
} from 'icore';

renderJson({ ok: true });
renderTextTable([
  ['field', 'value'],
  ['ok', 'true']
]);
renderCsvRow(['job-42', 'running']);
renderCsv([
  ['id', 'status'],
  ['job-42', 'running']
]);
```

Direct renderers are sharp tools. They are good for adapters and tests, but
regular commands should usually return presentation views and let
`presentation.render(...)` choose the renderer.
