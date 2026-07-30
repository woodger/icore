/**
 * Legacy terminal progress builds generic progress presentation on line
 * output.
 *
 * Allowed here:
 * - progress snapshots and derived values;
 * - throttled interactive rendering;
 * - restoring progress after regular line output;
 * - width-aware plain-text truncation;
 *
 * This file must not contain domain events, process signals, or application
 * lifecycle policy.
 * The module remains only as a `2.x` compatibility implementation; new
 * consumers should own progress state and rendering in their application.
 */

import type { TerminalLineOutput } from '../output/terminal-output';

const defaultRefreshIntervalMs = 250;
const defaultTerminalColumns = 120;
const countFormatter = new Intl.NumberFormat('en-US');

/**
 * Application-provided progress state.
 *
 * @deprecated Keep progress state in the consuming application.
 */
export type TerminalProgressState = {
  label: string;
  current: number;
  total: number;
  details: readonly string[];
  elapsedMs?: number;
};

/**
 * Readonly state with values derived by the progress layer.
 *
 * @deprecated Keep progress snapshots in the consuming application.
 */
export type TerminalProgressSnapshot = {
  readonly label: string;
  readonly current: number;
  readonly total: number;
  readonly details: readonly string[];
  readonly elapsedMs?: number;
  readonly percentage: number;
  readonly etaMs?: number;
};

/**
 * Converts a derived progress snapshot to one plain-text terminal line.
 *
 * @deprecated Keep progress rendering in the consuming application.
 */
export type TerminalProgressRenderer = (
  progress: TerminalProgressSnapshot
) => string;

/**
 * @deprecated Keep progress lifecycle in the consuming application.
 */
export type TerminalProgress = {
  start(progress: TerminalProgressState): void;
  update(progress: TerminalProgressState): void;
  writeLine(line: string): void;
  complete(progress: TerminalProgressState): void;
  close(): Promise<void>;
};

/**
 * @deprecated Keep progress composition in the consuming application.
 */
export type TerminalProgressOptions = {
  output: TerminalLineOutput;
  render?: TerminalProgressRenderer;
  refreshIntervalMs?: number;
  /** Clock used only for redraw throttling. */
  now?: () => number;
};

/**
 * Creates interactive progress over a shared terminal line output.
 *
 * Progress operations enqueue output synchronously. `close()` finishes an
 * active line and waits for the stdout barrier. It is idempotent, and later
 * progress operations are ignored.
 *
 * @deprecated Keep progress rendering and lifecycle in the consuming
 * application. This compatibility export will be removed in the next major.
 */
export function createTerminalProgress({
  output,
  render = renderTerminalProgress,
  refreshIntervalMs = defaultRefreshIntervalMs,
  now = Date.now
}: TerminalProgressOptions): TerminalProgress {
  assertNonNegativeFinite('refreshIntervalMs', refreshIntervalMs);

  let currentProgress: TerminalProgressSnapshot | undefined;
  let lastRenderedAt = 0;
  let progressLineActive = false;
  let closed = false;
  let closePromise: Promise<void> | undefined;

  function renderProgress(
    progress: TerminalProgressSnapshot
  ): string {
    const line = render(copyProgressSnapshot(progress));

    return truncateTerminalLine(line, output.columns);
  }

  function replaceProgressLine(line: string): void {
    output.replaceLine(line);
    progressLineActive = true;
  }

  function finishProgressLine(): void {
    if (!progressLineActive) {
      return;
    }

    output.finishLine();
    progressLineActive = false;
  }

  return {
    start(progress) {
      if (closed) {
        return;
      }

      const snapshot = createProgressSnapshot(progress, false);

      if (!output.isInteractive) {
        currentProgress = snapshot;

        return;
      }

      const line = renderProgress(snapshot);
      const renderedAt = readClock(now);

      currentProgress = snapshot;
      lastRenderedAt = renderedAt;
      replaceProgressLine(line);
    },
    update(progress) {
      if (closed) {
        return;
      }

      const snapshot = createProgressSnapshot(progress, false);

      if (
        !output.isInteractive
        || progress.current >= progress.total
      ) {
        currentProgress = snapshot;

        return;
      }

      const renderedAt = readClock(now);

      if (renderedAt - lastRenderedAt < refreshIntervalMs) {
        currentProgress = snapshot;

        return;
      }

      const line = renderProgress(snapshot);

      currentProgress = snapshot;
      lastRenderedAt = renderedAt;
      replaceProgressLine(line);
    },
    writeLine(line) {
      if (closed) {
        return;
      }

      const restored = (
        output.isInteractive
        && currentProgress !== undefined
      )
        ? {
          line: renderProgress(currentProgress),
          renderedAt: readClock(now)
        }
        : undefined;

      finishProgressLine();
      output.writeLine(line);

      if (restored !== undefined) {
        replaceProgressLine(restored.line);
        lastRenderedAt = restored.renderedAt;
      }
    },
    complete(progress) {
      if (closed) {
        return;
      }

      const snapshot = createProgressSnapshot(progress, true);

      if (output.isInteractive) {
        const line = renderProgress(snapshot);

        replaceProgressLine(line);
        finishProgressLine();
      }

      currentProgress = undefined;
    },
    close() {
      if (closePromise !== undefined) {
        return closePromise;
      }

      closed = true;
      currentProgress = undefined;

      try {
        finishProgressLine();
        closePromise = output.flush();
      }
      catch (error) {
        closePromise = Promise.reject(error);
      }

      return closePromise;
    }
  };
}

/**
 * Deterministic default renderer used by `createTerminalProgress()`.
 *
 * @deprecated Keep progress rendering in the consuming application.
 */
export function renderTerminalProgress(
  progress: TerminalProgressSnapshot
): string {
  const prefix = `${progress.label} ${progress.percentage.toFixed(1)}%`
    + ` ${formatTerminalCount(progress.current)}`
    + `/${formatTerminalCount(progress.total)}`;
  const details = progress.details
    .map((detail) => ` ${detail}`)
    .join('');
  const elapsed = progress.elapsedMs === undefined
    ? ''
    : ` elapsed ${formatTerminalDuration(progress.elapsedMs)}`;
  const eta = progress.etaMs === undefined
    ? ''
    : ` eta ${formatTerminalDuration(progress.etaMs)}`;

  return `${prefix}${details}${elapsed}${eta}`;
}

/**
 * Formats a terminal count with deterministic `en-US` grouping.
 *
 * @deprecated Keep progress formatting in the consuming application.
 */
export function formatTerminalCount(value: number): string {
  return countFormatter.format(value);
}

/**
 * Formats milliseconds as a compact, two-unit terminal duration.
 *
 * @deprecated Keep progress formatting in the consuming application.
 */
export function formatTerminalDuration(milliseconds: number): string {
  assertNonNegativeFinite('milliseconds', milliseconds);

  const totalSeconds = Math.floor(milliseconds / 1_000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor(totalSeconds % 86_400 / 3_600);
  const minutes = Math.floor(totalSeconds % 3_600 / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

function createProgressSnapshot(
  progress: TerminalProgressState,
  completed: boolean
): TerminalProgressSnapshot {
  assertProgressState(progress);

  const base = {
    label: progress.label,
    current: progress.current,
    total: progress.total,
    details: [...progress.details],
    percentage: calculatePercentage(progress.current, progress.total)
  };

  if (progress.elapsedMs === undefined) {
    return base;
  }

  const etaMs = estimateRemainingMs(progress, completed);

  if (etaMs === undefined) {
    return {
      ...base,
      elapsedMs: progress.elapsedMs
    };
  }

  return {
    ...base,
    elapsedMs: progress.elapsedMs,
    etaMs
  };
}

function copyProgressSnapshot(
  progress: TerminalProgressSnapshot
): TerminalProgressSnapshot {
  return {
    ...progress,
    details: [...progress.details]
  };
}

function calculatePercentage(
  current: number,
  total: number
): number {
  if (total === 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, current / total * 100));
}

function estimateRemainingMs(
  progress: TerminalProgressState,
  completed: boolean
): number | undefined {
  if (
    completed
    || progress.elapsedMs === undefined
    || progress.current === 0
    || progress.current >= progress.total
    || progress.elapsedMs === 0
  ) {
    return undefined;
  }

  const averageItemMs = progress.elapsedMs / progress.current;

  return Math.ceil(averageItemMs * (progress.total - progress.current));
}

function truncateTerminalLine(
  line: string,
  terminalColumns: number | undefined
): string {
  // Leave the final terminal column unused so writing the progress line does
  // not trigger an automatic wrap.
  const maximumLineLength = Math.max(
    1,
    (terminalColumns ?? defaultTerminalColumns) - 1
  );

  return line.length > maximumLineLength
    ? line.slice(0, maximumLineLength)
    : line;
}

function assertProgressState(progress: TerminalProgressState): void {
  assertNonNegativeFinite('current', progress.current);
  assertNonNegativeFinite('total', progress.total);

  if (progress.elapsedMs !== undefined) {
    assertNonNegativeFinite('elapsedMs', progress.elapsedMs);
  }
}

function assertNonNegativeFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Expected ${name} to be a finite non-negative number`);
  }
}

function readClock(now: () => number): number {
  const value = now();

  if (!Number.isFinite(value)) {
    throw new RangeError('Expected now() to return a finite number');
  }

  return value;
}
