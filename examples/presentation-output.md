# Presentation And Output

Use this shape when command execution is handled elsewhere, but the application
still wants shared terminal rendering and stdout/stderr writing.

This split is useful when application code already has its own command runner
or framework. icore can still provide a consistent terminal view layer without
taking ownership of command execution.

Create presentation and output once near the terminal boundary:

```ts
import {
  createOutput,
  createPresentation
} from 'icore';

const presentation = createPresentation();
const output = createOutput();
```

Keeping these objects near the boundary avoids leaking stdout/stderr decisions
into application services. When every output format exposes the same fields,
domain objects can be mapped to generic presentation records before they are
rendered.

Build a view from application data:

```ts
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

The view contains already selected fields. This is deliberate: presentation
views should not discover domain meaning by themselves. `records(...)` is a
good fit only when the same flat shape is suitable for JSON, table, and CSV.
Table and CSV headers are inferred from data, so an empty records view renders
without headers in those formats.

Render the view and write it to stdout. Write operational messages to stderr:

```ts
await output.write(presentation.render(result, 'table'));
await output.error('Rendered job table\n');
```

Write machine-consumable command output to stdout and operational status to
stderr. That convention keeps shell pipelines usable.

When formats intentionally need different projections, render each projection
directly at this boundary instead:

```ts
import {
  renderJson,
  renderTextTable
} from 'icore';

const text = format === 'json'
  ? renderJson(report)
  : renderTextTable([
      ['id', 'status'],
      ...report.jobs.map((job) => [
        job.id,
        job.status
      ])
    ]);

await output.write(text);
```

This keeps the full nested report available to JSON while allowing a table to
select and format its own columns. icore deliberately does not derive one
projection from the other.

The user sees the table in stdout:

```text
id         active
job-1      true
job-2      false
```

The status line goes to stderr:

```text
Rendered job table
```
