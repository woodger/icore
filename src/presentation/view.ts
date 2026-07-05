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

export type CsvCell = string | number | boolean;
export type CsvRow = readonly CsvCell[];
export type TextTableRow = readonly string[];
export type PresentationRecord = Readonly<Record<string, unknown>>;
export type EmptyPresentationView = {
  type: 'empty';
};
export type TextPresentationView = {
  type: 'text';
  value: string;
};
export type RecordPresentationView = {
  type: 'record';
  value: PresentationRecord | null;
};
export type RecordsPresentationView = {
  type: 'records';
  value: readonly PresentationRecord[];
};
export type TablePresentationView = {
  type: 'table';
  rows: readonly TextTableRow[];
};
export type CsvPresentationView = {
  type: 'csv';
  rows: readonly CsvRow[];
};
export type PresentationView =
  | EmptyPresentationView
  | TextPresentationView
  | RecordPresentationView
  | RecordsPresentationView
  | TablePresentationView
  | CsvPresentationView;
export type PresentationResult = PresentationView;

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
