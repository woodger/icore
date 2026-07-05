/**
 * The presentation result renderer converts generic presentation views into
 * terminal text using the selected output format.
 *
 * Allowed here:
 * - dispatching presentation views to JSON, CSV, and table renderers;
 * - converting generic records to renderer input rows;
 * - validating generic presentation result shapes;
 *
 * This file must not contain command execution, stdout/stderr delivery, or
 * application report mapping.
 */

import type { PresentationFormat } from './format-options';
import { renderCsv } from './renderers/csv';
import { renderJson } from './renderers/json';
import { renderTextTable } from './renderers/table';
import type {
  CsvRow,
  PresentationRecord,
  PresentationResult,
  TextTableRow
} from './view';

/**
 * Renders a presentation result after the caller selects the terminal format.
 *
 * Record-like views are projected to table or CSV rows inside this boundary so
 * applications do not duplicate generic renderer input shaping.
 */
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

/**
 * Checks whether an unknown command result is a supported presentation result.
 */
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

function toCsvCell(value: unknown): CsvRow[number] {
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
