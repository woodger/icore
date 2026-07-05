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
  empty(): EmptyPresentationView;
  text(value: string): TextPresentationView;
  record(value: PresentationRecord | null): RecordPresentationView;
  records(value: readonly PresentationRecord[]): RecordsPresentationView;
  table(rows: readonly TextTableRow[]): TablePresentationView;
  csv(rows: readonly CsvRow[]): CsvPresentationView;
};

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
