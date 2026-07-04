/**
 * The presentation module contains reusable terminal rendering mechanics.
 *
 * Allowed here:
 * - generic terminal presentation view models;
 * - generic JSON, CSV, and text table rendering;
 * - reusable presentation format option contracts;
 *
 * This file must not contain application report mapping, domain-specific
 * scalar formatting, command execution, or stdout/stderr delivery.
 */

import type { OptionsSchema } from './options';

export const presentationFormats = ['json', 'table', 'csv'] as const;

export const presentationFormatOptions = {
  format: {
    type: 'string',
    choices: presentationFormats,
    default: 'table'
  }
} as const satisfies OptionsSchema;

export type PresentationFormat = typeof presentationFormats[number];
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

export type PresentationRenderers = {
  json: {
    render(value: unknown): string;
  };
  table: {
    render(rows: readonly TextTableRow[]): string;
  };
  csv: {
    render(rows: readonly CsvRow[]): string;
    renderRow(row: CsvRow): string;
  };
};

export type Presentation = PresentationViewFactory & {
  formats: typeof presentationFormats;
  render(result: PresentationResult, format?: PresentationFormat): string;
  renderers: PresentationRenderers;
};

export function createPresentation(): Presentation {
  const viewFactory = createPresentationViewFactory();

  return {
    ...viewFactory,
    formats: presentationFormats,
    render: renderPresentationResult,
    renderers: {
      json: {
        render: renderJson
      },
      table: {
        render: renderTextTable
      },
      csv: {
        render: renderCsv,
        renderRow: renderCsvRow
      }
    }
  };
}

function createPresentationViewFactory(): PresentationViewFactory {
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

export function renderJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function renderCsvRow(values: CsvRow): string {
  return values.map(renderCsvValue).join(',');
}

export function renderCsv(rows: readonly CsvRow[]): string {
  if (rows.length === 0) {
    return '';
  }

  return `${rows.map(renderCsvRow).join('\n')}\n`;
}

export function renderTextTable(rows: readonly TextTableRow[]): string {
  if (rows.length === 0) {
    return '';
  }

  const columnCount = Math.max(...rows.map((row) => row.length));
  const widths = Array.from({ length: columnCount }, (_, columnIndex) =>
    Math.max(...rows.map((row) => (row[columnIndex] ?? '').length))
  );

  return [
    ...rows.map((row) =>
      widths
        .map((width, columnIndex) => (row[columnIndex] ?? '').padEnd(width))
        .join('  ')
        .trimEnd()
    ),
    ''
  ].join('\n');
}

export function renderPresentationResult(
  result: PresentationResult,
  format: PresentationFormat = 'table'
): string {
  if (result.type === 'empty') {
    return '';
  }

  if (result.type === 'text') {
    return result.value;
  }

  if (format === 'json') {
    return renderJson(presentationResultToJsonValue(result));
  }

  if (result.type === 'table') {
    return format === 'csv'
      ? renderCsv(result.rows)
      : renderTextTable(result.rows);
  }

  if (result.type === 'csv') {
    return format === 'csv'
      ? renderCsv(result.rows)
      : renderTextTable(rowsToTextRows(result.rows));
  }

  if (result.type === 'record') {
    return format === 'csv'
      ? renderCsv(recordToCsvRows(result.value))
      : renderTextTable(recordToTextRows(result.value));
  }

  return format === 'csv'
    ? renderCsv(recordsToCsvRows(result.value))
    : renderTextTable(recordsToTextRows(result.value));
}

export function isPresentationFormat(value: unknown): value is PresentationFormat {
  return typeof value === 'string'
    && presentationFormats.includes(value as PresentationFormat);
}

export function isPresentationResult(value: unknown): value is PresentationResult {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }

  const result = value as Record<string, unknown>;

  if (result['type'] === 'empty') {
    return true;
  }

  if (result['type'] === 'text') {
    return typeof result['value'] === 'string';
  }

  if (result['type'] === 'record') {
    return result['value'] === null || isRecord(result['value']);
  }

  if (result['type'] === 'records') {
    return Array.isArray(result['value']);
  }

  if (result['type'] === 'table' || result['type'] === 'csv') {
    return Array.isArray(result['rows']);
  }

  return false;
}

function renderCsvValue(value: CsvCell): string {
  const text = String(value);

  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function presentationResultToJsonValue(result: PresentationResult): unknown {
  if (result.type === 'empty') {
    return null;
  }

  if (result.type === 'text') {
    return result.value;
  }

  if (result.type === 'record') {
    return result.value;
  }

  if (result.type === 'records') {
    return result.value;
  }

  if (result.type === 'table') {
    return result.rows;
  }

  if (result.type === 'csv') {
    return result.rows;
  }

  return assertNever(result);
}

function recordToTextRows(record: PresentationRecord | null): TextTableRow[] {
  if (record === null) {
    return [];
  }

  return [
    ['field', 'value'],
    ...Object.keys(record).map((key) => [
      key,
      formatPresentationCell(record[key])
    ])
  ];
}

function recordsToTextRows(records: readonly PresentationRecord[]): TextTableRow[] {
  if (records.length === 0) {
    return [];
  }

  const keys = collectRecordKeys(records);

  return [
    keys,
    ...records.map((record) =>
      keys.map((key) => formatPresentationCell(record[key]))
    )
  ];
}

function recordToCsvRows(record: PresentationRecord | null): CsvRow[] {
  if (record === null) {
    return [];
  }

  const keys = Object.keys(record);

  return [
    keys,
    keys.map((key) => toCsvCell(record[key]))
  ];
}

function recordsToCsvRows(records: readonly PresentationRecord[]): CsvRow[] {
  if (records.length === 0) {
    return [];
  }

  const keys = collectRecordKeys(records);

  return [
    keys,
    ...records.map((record) =>
      keys.map((key) => toCsvCell(record[key]))
    )
  ];
}

function rowsToTextRows(rows: readonly CsvRow[]): TextTableRow[] {
  return rows.map((row) => row.map(formatPresentationCell));
}

function collectRecordKeys(records: readonly PresentationRecord[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) {
        keys.push(key);
        seen.add(key);
      }
    }
  }

  return keys;
}

function formatPresentationCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value) ?? String(value);
}

function toCsvCell(value: unknown): CsvCell {
  if (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }

  return formatPresentationCell(value);
}

function assertNever(value: never): never {
  throw new Error(`Unexpected presentation result: ${String(value)}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
