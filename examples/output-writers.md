# Output Writers

`createOutput()` is the preferred output entrypoint. It exposes semantic
`write(...)` and `error(...)` methods while keeping raw stdout/stderr channels
available for lower-level integrations.

Prefer semantic methods first. Direct writer primitives are useful in tests,
streaming adapters, and custom terminal boundaries.

Interactive lines and progress are application-owned. The deprecated
`createTerminalOutput()` and `createTerminalProgress()` contracts remain
exported only for `2.x` compatibility; see the
[legacy migration guide](interactive-output.md) when maintaining existing
code.

## Application-Owned Interactive Output

For new Consumers, keep interactive behavior in the terminal infrastructure or
bootstrap layer. `icore` should receive only semantic stdout/stderr output:

- application code emits progress state or domain events meaningful to the
  operation;
- the infrastructure reporter decides TTY behavior, line redraw, terminal
  width, labels, signal handling, and cleanup;
- bootstrap creates one reporter per invocation and closes it before writing a
  final result or reporting an error;
- `createOutput()` remains the shared boundary for regular output and
  diagnostics.

Do not interleave reporter writes with `output.write(...)`. If an application
must support both at the same time, its infrastructure layer must provide the
serialization; `createOutput()` does not coordinate application-owned line
operations.

The exact reporter contract is application-owned. A representative lifecycle
looks like this:

```ts
import { createOutput, createTerminalApp } from 'icore';

// These two names are supplied by the consuming project.
const output = createOutput();
const app = createTerminalApp({ commands, output });
const progress = new TerminalProgressReporter({
  stdout: process.stdout
});

let failure: unknown;

try {
  await runApplication({ progress });
}
catch (error) {
  failure = error;
}

try {
  await progress.close();
}
catch (error) {
  failure ??= error;
}

if (failure !== undefined) {
  process.exitCode = await app.reportError(failure, {
    phase: 'external'
  });
}
```

`TerminalProgressReporter` and `runApplication(...)` in this example belong to
the consuming project. Keep domain mapping, resource ownership, and process
signals out of `icore`.

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
