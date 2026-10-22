/**
 * The presentation view module defines generic terminal view models.
 *
 * Allowed here:
 * - JSON-like record views;
 * - explicit table and CSV views;
 * - text and empty terminal result views;
 *
 * This file must not contain renderer implementation or application report
 * mapping.
 */

/** Primitive CSV cell value; rendering converts numbers and booleans to text. */
export type CsvCell = string | number | boolean;

/** Ordered, readonly cells for one CSV row, including caller-supplied headers. */
export type CsvRow = readonly CsvCell[];

/** Preformatted string cells for one row of an aligned text table. */
export type TextTableRow = readonly string[];

/** Readonly named fields projected to table, CSV, or JSON output. */
export type PresentationRecord = Readonly<Record<string, unknown>>;

/** Presentation result that produces no terminal text in any format. */
export type EmptyPresentationView = {
  type: 'empty';
};

/** Ready terminal text emitted unchanged in every presentation format. */
export type TextPresentationView = {
  type: 'text';
  value: string;
};

/** One record, or null, rendered as named fields or JSON according to the format. */
export type RecordPresentationView = {
  type: 'record';
  value: PresentationRecord | null;
};

/** Readonly record list whose fields determine table and CSV columns. */
export type RecordsPresentationView = {
  type: 'records';
  value: readonly PresentationRecord[];
};

/** Explicit rows of prepared text cells, without automatic record projection. */
export type TablePresentationView = {
  type: 'table';
  rows: readonly TextTableRow[];
};

/** Explicit rows of scalar CSV cells, without automatic record projection. */
export type CsvPresentationView = {
  type: 'csv';
  rows: readonly CsvRow[];
};

/** Supported presentation variants, discriminated by their `type` field. */
export type PresentationView =
  | EmptyPresentationView
  | TextPresentationView
  | RecordPresentationView
  | RecordsPresentationView
  | TablePresentationView
  | CsvPresentationView;

/** Public command-result alias for any supported presentation view. */
export type PresentationResult = PresentationView;

/** Creates presentation views while leaving format selection to rendering. */
export type PresentationViewFactory = {
  /** No output. */
  empty(): EmptyPresentationView;
  /** Ready terminal text. */
  text(value: string): TextPresentationView;
  /** One generic record. */
  record(value: PresentationRecord | null): RecordPresentationView;
  /** Generic records. */
  records(value: readonly PresentationRecord[]): RecordsPresentationView;
  /** Prepared text rows. */
  table(rows: readonly TextTableRow[]): TablePresentationView;
  /** CSV scalar rows. */
  csv(rows: readonly CsvRow[]): CsvPresentationView;
};

/**
 * Creates view-model factory methods without binding them to an output format.
 */
export function createPresentationViewFactory(): PresentationViewFactory {
  return {
    empty() {
      return {
        type: 'empty'
      };
    },
    text(value) {
      return {
        type: 'text',
        value
      };
    },
    record(value) {
      return {
        type: 'record',
        value
      };
    },
    records(value) {
      return {
        type: 'records',
        value
      };
    },
    table(rows) {
      return {
        type: 'table',
        rows
      };
    },
    csv(rows) {
      return {
        type: 'csv',
        rows
      };
    }
  };
}
