# Presentation And Output

Use this shape when command execution is handled elsewhere, but the application
still wants shared terminal rendering and stdout/stderr writing.

Create presentation and output once near the terminal boundary:

```ts
import {
  createOutput,
  createPresentation
} from 'icore';

const presentation = createPresentation();
const output = createOutput();
```

Build a view from application data:

```ts
const result = presentation.records([
  {
    id: 'account-1',
    active: true
  },
  {
    id: 'account-2',
    active: false
  }
]);
```

Render the view and write it to stdout. Write operational messages to stderr:

```ts
await output.write(presentation.render(result, 'table'));
await output.error('Rendered account table\n');
```

The user sees the table in stdout:

```text
id         active
account-1  true
account-2  false
```

The status line goes to stderr:

```text
Rendered account table
```
