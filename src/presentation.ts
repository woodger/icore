/**
 * The presentation module contains reusable terminal rendering mechanics.
 *
 * Allowed here:
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

function renderCsvValue(value: CsvCell): string {
  const text = String(value);

  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}
