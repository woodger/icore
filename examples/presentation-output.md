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
into application services. The tradeoff is that domain objects must be mapped to
generic presentation records before they are rendered.

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
views should not discover domain meaning by themselves.

Render the view and write it to stdout. Write operational messages to stderr:

```ts
await output.write(presentation.render(result, 'table'));
await output.error('Rendered job table\n');
```

Write machine-consumable command output to stdout and operational status to
stderr. That convention keeps shell pipelines usable.

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
