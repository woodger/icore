# Write Output

`createOutput()` is the usual way to write output. It provides `write(...)` for standard output and `error(...)` for standard error, while still exposing the individual channels when code needs them.

Start with `write(...)` and `error(...)`. Direct writer functions are useful in tests, streaming adapters, and code that needs one specific channel.

The application owns interactive lines and progress indicators.

## Keep Interactive Output In The Application

Keep interactive behavior in the application code that starts the CLI. Pass only regular standard output and standard error through `icore`:

- application code reports progress or events meaningful to its work;
- the progress reporter decides terminal detection, line redraw, width, labels, signal handling, and cleanup;
- the code that starts the CLI creates one reporter for a run and closes it before the final result or error;
- `createOutput()` writes ordinary output and diagnostics.

Do not mix progress-reporter writes with `output.write(...)`. If both must run at once, application code must serialize them; `createOutput()` does not coordinate interactive lines.

The application defines its own progress-reporter interface. For example:

```ts
import { createOutput, createTerminalApp } from 'icore';

// These two names are supplied by the consuming project.
const output = createOutput();
const app = createTerminalApp({ commands, output });
const progress = new TerminalProgressReporter({
  stdout: process.stdout
});

let failure: { error: unknown } | undefined;

try {
  await runApplication({ progress });
}
catch (error) {
  failure = { error };
}

try {
  await progress.close();
}
catch (error) {
  failure ??= { error };
}

if (failure !== undefined) {
  process.exitCode = await app.reportError(failure.error, {
    phase: 'external'
  });
}
```

`TerminalProgressReporter` and `runApplication(...)` in this example belong to the application. Keep application data mapping, resources, and process signals there too.

## Write Command Output And Errors

```ts
import { createOutput } from 'icore';

const output = createOutput();

await output.write('regular command output\n');
await output.error('warning: using cached data\n');
```

Command results go to standard output, and diagnostics go to standard error. This keeps shell pipelines usable.

## Use One Channel Directly

Use `output.stdout.write(...)` and `output.stderr.write(...)` when another component needs a specific channel.

```ts
await output.stdout.write('regular command output\n');
await output.stderr.write('warning: using cached data\n');
```

Use this only when the receiving code needs to know which channel it writes to.

## Provide Output Destinations In Tests

Pass custom sinks to `createOutput(...)` when tests or applications need to capture text.

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

This keeps the output dependency explicit and avoids mocking `process.stdout` globally.

## Create Standard-Output And Standard-Error Writers

`createStdoutWriter(...)` and `createStderrWriter(...)` create individual text writers.

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

Use these when code assembles its own output object. For normal CLI code, `createOutput()` keeps standard output and standard error together.

## Wait For A Slow Stream

`createBackpressureTextWriter(...)` wraps a text destination and waits when the destination cannot accept more text yet.

```ts
import { createBackpressureTextWriter } from 'icore';

const writer = createBackpressureTextWriter(process.stdout);

await writer.write('large chunk\n');
```

This is useful for commands that stream output. It prevents a fast producer from ignoring a slow destination.

When a Node stream is passed directly, a paused write rejects if the stream emits `error` or `close` before `drain`.

Already destroyed or ended Node streams reject before writing, rather than waiting for a drain event that cannot occur.

## Use Destinations That Return Promises

Sinks can also return a promise from `write(...)`.

```ts
const writer = createBackpressureTextWriter({
  async write(chunk) {
    await sendToRemoteConsole(chunk);
  }
});

await writer.write('forwarded output\n');
```

Use this when output is not a Node stream. The application then defines the destination's reliability and ordering guarantees.
