# Interactive Output And Progress

Use `createTerminalOutput()` when regular terminal output and an interactive
progress line must share stdout. Use one instance for the complete CLI
invocation.

## Create One Output Owner

```ts
import {
  createTerminalApp,
  createTerminalOutput,
  createTerminalProgress
} from 'icore';

const terminal = createTerminalOutput();

const app = createTerminalApp({
  commands,
  output: terminal.output
});

const progress = createTerminalProgress({
  output: terminal.lines
});
```

`terminal.output.write(...)`, `terminal.output.stdout.write(...)`, and
`terminal.lines` use the same stdout queue. Stderr has an independent queue.
Creating another `TerminalOutput` for help, progress, or command output creates
another queue and loses cross-component ordering.

Output written while a progress line is active should go through
`progress.writeLine(...)`, which finishes the active line, writes the message,
and restores progress. Close progress before the terminal app writes its final
result.

## Use Line Capabilities

`terminal.lines` exposes:

```ts
terminal.lines.isInteractive;
terminal.lines.columns;

terminal.lines.writeLine('Starting sync');
terminal.lines.replaceLine('Syncing 25.0%');
terminal.lines.finishLine();

await terminal.lines.flush();
```

`replaceLine(...)` is one atomic queue operation. Cursor movement, line
clearing, and text writing cannot be interleaved with another operation from
the same `TerminalOutput`. `replaceLine(...)` and `finishLine()` do nothing
when `isInteractive` is false; the application owns non-TTY output policy.

Line methods enqueue synchronously and do not return promises. `flush()` is a
barrier: it waits for operations queued before that exact call, but later
operations do not keep it pending.

The first stdout failure is sticky. The queue stores that failure, skips later
stdout writes, and rejects subsequent stdout barriers with the same value.
Detached line operations never create unhandled promise rejections.

## Render Generic Progress

```ts
progress.start({
  label: 'Syncing candles',
  current: 0,
  total: 1_000,
  details: ['saved 0'],
  elapsedMs: 0
});

progress.update({
  label: 'Syncing candles',
  current: 250,
  total: 1_000,
  details: ['saved 240'],
  elapsedMs: 5_000
});

progress.complete({
  label: 'Syncing candles',
  current: 1_000,
  total: 1_000,
  details: ['saved 990'],
  elapsedMs: 20_000
});

await progress.close();
```

Interactive redraws are throttled to 250 milliseconds by default. Set
`refreshIntervalMs` when another interval is needed. `start(...)`,
`update(...)`, `writeLine(...)`, and `complete(...)` do nothing after
`close()` begins. Repeated `close()` calls return the same promise.

Non-interactive progress does not render `start`, `update`, or `complete`
states. The consuming application owns its non-TTY policy and can emit
periodic plain messages through `progress.writeLine(...)`.

Process signals and the surrounding resource lifecycle also remain application
responsibilities.

## Replace The Renderer

The renderer receives a new readonly snapshot for every render:

```ts
const customProgress = createTerminalProgress({
  output: terminal.lines,
  render(snapshot) {
    return `${snapshot.label}: ${snapshot.current}/${snapshot.total}`
      + ` (${snapshot.percentage.toFixed(1)}%)`;
  }
});
```

The snapshot contains:

```ts
type TerminalProgressSnapshot = {
  readonly label: string;
  readonly current: number;
  readonly total: number;
  readonly details: readonly string[];
  readonly elapsedMs?: number;
  readonly percentage: number;
  readonly etaMs?: number;
};
```

Percentage is clamped to `0..100`; a zero total produces `0`. ETA is omitted
when `current` is zero, elapsed time is zero or absent, progress is complete,
or an estimate cannot be calculated. Renderer output is truncated to the
current terminal width after the renderer returns.

ETA uses `ceil(elapsedMs / current * (total - current))`. Calling
`complete(...)` does not force percentage to `100`; pass `current === total`
when the operation completed all planned work. The default renderer displays
percentage with one decimal place.

The default renderer uses English `elapsed` and `eta` labels and fixed `en-US`
number grouping. `formatTerminalCount(...)` and
`formatTerminalDuration(...)` are available to custom renderers and final
reports.

Renderer failures are synchronous and do not poison the output queue. Invalid
negative or non-finite progress values also throw synchronously.

## Preserve Error Ordering

Close stdout progress before reporting an error to stderr. Since `close()` may
itself reject, catch that failure without losing the original command error:

```ts
let failure: { error: unknown } | undefined;

try {
  await runCommandWithProgress(progress);
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

The command failure remains primary so a stdout cleanup failure cannot replace
a usage error and change its application-selected exit code.

## Plain-Text Limitation

Interactive line and progress content supports single-line plain text only.
ANSI escape sequences and control characters are not supported.

Width calculation intentionally uses JavaScript string length and assumes one
string code unit per terminal column. Emoji, combining characters, tabs, and
full-width Unicode characters may be measured or truncated incorrectly.
