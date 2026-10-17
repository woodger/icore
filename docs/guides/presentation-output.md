# Format And Write Output

Use this guide when the application runs commands itself but still wants `icore` to format output and write to standard output or standard error.

This is useful when application code already has its own command runner or framework. `icore` can format the result without running the command.

Create the formatting and output objects where the application writes to the terminal:

```ts
// Create objects that format and write terminal output.
import {
  createOutput,
  createPresentation
} from 'icore';

const presentation = createPresentation();
const output = createOutput();
```

Keeping these objects where terminal output is written keeps standard-output and standard-error decisions out of application services. When every format uses the same fields, map application data to records containing those fields before formatting.

Build an output value from application data:

```ts
// Map application data to fields shared by every output format.
const result = presentation.records([
  {
    id: 'job-1',
    active: true
  },
  {
    id: 'job-2',
    active: false
  }
]);
```

The records already contain the fields to show. `records(...)` is a good fit only when JSON, table, and CSV use the same top-level fields. Table and CSV headers come from the records, so an empty record list has no headers in those formats.

Format the value and write it to standard output. Write operational messages to standard error:

```ts
// Write data to stdout and a status message to stderr.
await output.write(presentation.render(result, 'table'));
await output.error('Rendered job table\n');
```

Write command output intended for another program to standard output and operational status to standard error. This keeps shell pipelines usable.

When formats need different data, prepare the data for each format and call the renderer directly instead:

```ts
// Prepare table and CSV rows, then select the requested renderer.
import {
  renderCsv,
  renderJson,
  renderTextTable
} from 'icore';

const rows = [
  ['id', 'status'],
  ...report.jobs.map((job) => [
    job.id,
    job.status
  ])
];

let text: string;

switch (format) {
  case 'json':
    text = renderJson(report);
    break;
  case 'table':
    text = renderTextTable(rows);
    break;
  case 'csv':
    text = renderCsv(rows);
    break;
  default:
    throw new Error(`Unsupported presentation format: ${String(format)}`);
}

await output.write(text);
```

This keeps the complete nested report in JSON while letting table and CSV select and format their own columns. `icore` does not derive one format's data from another.

The user sees the table in stdout:

```text
id     active
job-1  true
job-2  false
```

The status line goes to stderr:

```text
Rendered job table
```
