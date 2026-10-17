# Create Output Values

`createPresentation()` is the usual way to format terminal output. Use the direct APIs below when code needs an explicit output value or must call a renderer itself.

Use `presentation.render(...)` when one output value works for every format. Call renderers directly when JSON, table, and CSV need different data from the same report.

## Empty And Text Output

Use `presentation.empty()` when a command succeeds without terminal output. Use `presentation.text(...)` when the command already owns final text.

```ts
import { createPresentation } from 'icore';

const presentation = createPresentation();

const noOutput = presentation.empty();
const readyText = presentation.text('cache cleared\n');
```

These values work in every format. Rendering them as `table`, `json`, or `csv` does not add structure.

## Records

Use `record(...)` and `records(...)` when JSON, table, and CSV use the same top-level fields.

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

`PresentationRecord` has a string index signature, while a regular TypeScript interface does not. Map application objects to object literals to select output fields without a cast:

```ts
interface JobReportRow {
  id: string;
  status: string;
  internalTraceId: string;
}

function presentJobs(rows: readonly JobReportRow[]) {
  return presentation.records(rows.map((row) => ({
    id: row.id,
    status: row.status
  })));
}
```

This is convenient when:

- every format should expose the same fields;
- generic conversion of values into table and CSV cells is sufficient;
- table and CSV headers can be inferred from non-empty data.

This form does not select fields or format cells differently for each format. A nested value useful in JSON does not automatically make a useful table. Select fields before creating the output value; generic formatting code should not inspect application objects.

In table format, `record(row)` produces a vertical `field`/`value` table. Use `records([row])` when one object should appear as a horizontal table with field names in its header.

For an empty `records([])` value, JSON renders as an empty array while table and CSV render as empty text. An explicit table or CSV value can retain headers for one format. When one command needs both JSON `[]` and a header-only empty table or CSV, call the renderers separately for each format.

## Explicit Tables And CSV Rows

Use `table(...)` when the application already owns prepared text cells. Use `csv(...)` when the application already owns CSV scalar rows.

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

These forms are useful when the application needs full control over column order and cell values. One table or CSV value still has the same data in every format; call renderers directly when each format needs its own fields or formatting.

Text-table cells are plain text. Width calculation uses JavaScript string length rather than terminal display width, so ANSI sequences, emoji, combining characters, tabs, and full-width Unicode may be aligned incorrectly. JSON and CSV rendering do not use text-table column alignment.

## Check A Requested Format

Use `presentation.formats`, `presentationFormats`, and `isPresentationFormat(...)` when application code accepts a format option.

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

This keeps the allowed formats aligned with the renderer. Do not copy the string union into application code.

## Render An Output Value

`presentation.render(...)` calls `renderPresentationResult(...)`.

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

Prefer `presentation.render(...)` in application code. The standalone function is useful for tests or custom output values.

## Check An Output Value

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

This is useful when code receives an unknown value. Inside a command function, returning a known output value is usually clearer.

## Call Renderers Directly

`createPresentation()` exposes renderers for code that already has input for a specific format.

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

The standalone functions do the same work:

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

With direct renderers, the application chooses the format. They are useful for adapters and tests, and when each format needs different data. For example, JSON can preserve a complete nested report while a table exposes selected columns with application-specific cell formatting:

```ts
const jsonText = renderJson(report);
const tableText = renderTextTable([
  ['id', 'status'],
  ...report.orders.map((order) => [
    order.id,
    order.status
  ])
]);
```

The application selects a renderer after reading the requested format. `icore` does not derive a table from a JSON object. When all formats use the same record fields, return an output value and let `presentation.render(...)` choose the renderer.
