# Output Writers

`createOutput()` is the preferred output entrypoint. It exposes semantic
`write(...)` and `error(...)` methods while keeping raw stdout/stderr channels
available for lower-level integrations.

Prefer semantic methods first. Direct writer primitives are useful in tests,
streaming adapters, and custom terminal boundaries.

For interactive lines or progress, use `createTerminalOutput()` instead. Its
semantic output and line operations share one ordered stdout queue; see
[Interactive Output And Progress](interactive-output.md).

## Use Semantic Output

```ts
import { createOutput } from 'icore';

const output = createOutput();

await output.write('regular command output\n');
await output.error('warning: using cached data\n');
```

The convention is simple: command results go to stdout, diagnostics go to
stderr. Keeping that split makes shell pipelines usable.

## Use Explicit Channels

Use `output.stdout.write(...)` and `output.stderr.write(...)` when a specific
channel must be passed into another component.

```ts
await output.stdout.write('regular command output\n');
await output.stderr.write('warning: using cached data\n');
```

This is lower-level than `output.write(...)` and `output.error(...)`. Prefer it
only when the channel identity matters.

## Inject Test Sinks

Pass custom sinks to `createOutput(...)` when tests or applications need to
capture text.

```ts
let stdout = '';
let stderr = '';

const output = createOutput({
  stdout: {
    write(chunk) {
      stdout += chunk;
    }
  },
  stderr: {
    write(chunk) {
      stderr += chunk;
    }
  }
});

await output.write('ok\n');
await output.error('warning\n');
```

This is better than mocking `process.stdout` globally. The output dependency is
explicit and local to the terminal boundary.

## Create Node Writers Directly

`createStdoutWriter(...)` and `createStderrWriter(...)` create individual text
writers.

```ts
import {
  createStderrWriter,
  createStdoutWriter
} from 'icore';

const stdout = createStdoutWriter();
const stderr = createStderrWriter();

await stdout.write('ok\n');
await stderr.write('warning\n');
```

Use these when a custom facade owns channel composition. For normal CLI code,
`createOutput()` is clearer because it preserves stdout/stderr semantics in one
object.

## Use A Backpressure-Aware Writer

`createBackpressureTextWriter(...)` adapts a text sink and waits when the sink
reports backpressure.

```ts
import { createBackpressureTextWriter } from 'icore';

const writer = createBackpressureTextWriter({
  write(chunk) {
    return process.stdout.write(chunk);
  },
  once(event, listener) {
    process.stdout.once(event, listener);
  }
});

await writer.write('large chunk\n');
```

This is useful for streaming commands. It is more code than direct
`process.stdout.write(...)`, but it prevents a fast producer from ignoring a
slow consumer.

## Use Promise-Returning Sinks

Sinks can also return a promise from `write(...)`.

```ts
const writer = createBackpressureTextWriter({
  async write(chunk) {
    await sendToRemoteConsole(chunk);
  }
});

await writer.write('forwarded output\n');
```

This shape is useful when output is not a Node stream. The tradeoff is that the
application owns the reliability and ordering guarantees of that sink.
