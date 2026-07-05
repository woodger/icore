/**
 * The CSV renderer module converts generic CSV rows to terminal text.
 *
 * Allowed here:
 * - CSV row joining;
 * - CSV cell escaping for comma, quote, and newline values;
 *
 * This file must not contain application report mapping.
 */

import type {
  CsvCell,
  CsvRow
} from '../view';

export function renderCsvRow(values: CsvRow): string {
  return values.map(renderCsvValue).join(',');
}

export function renderCsv(rows: readonly CsvRow[]): string {
  if (rows.length === 0) {
    return '';
  }

  return `${rows.map(renderCsvRow).join('\n')}\n`;
}

function renderCsvValue(value: CsvCell): string {
  const text = String(value);

  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}
