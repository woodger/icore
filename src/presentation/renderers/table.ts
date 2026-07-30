/**
 * The text table renderer module converts text rows to aligned terminal text.
 *
 * Allowed here:
 * - computing column widths;
 * - rendering already prepared string cells;
 *
 * This file must not contain domain-specific scalar formatting.
 */

import type { TextTableRow } from '../view';

/**
 * Renders prepared text rows as an aligned table without changing cell values.
 *
 * Widths use JavaScript string length. ANSI sequences, emoji, combining
 * characters, tabs, and full-width Unicode are not display-width aware.
 */
export function renderTextTable(rows: readonly TextTableRow[]): string {
  if (rows.length === 0) {
    return '';
  }

  const columnCount = Math.max(...rows.map((row) => row.length));
  const widths = Array.from({ length: columnCount }, (unusedValue, columnIndex) => {
    void unusedValue;

    return Math.max(...rows.map((row) => (row[columnIndex] ?? '').length));
  });

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
