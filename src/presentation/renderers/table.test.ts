import assert from 'node:assert';
import { describe, test } from 'node:test';
import { renderTextTable } from './table';

describe('renderTextTable', () => {
  test('aligns columns and keeps a trailing newline', () => {
    const output = renderTextTable([
      ['id', 'name'],
      ['1', 'Long name'],
      ['100', 'A']
    ]);

    assert.equal(output, [
      'id   name',
      '1    Long name',
      '100  A',
      ''
    ].join('\n'));
  });

  test('renders empty rows as an empty string', () => {
    assert.equal(renderTextTable([]), '');
  });

  test('renders large tables without a function argument limit', () => {
    const rowCount = 150_000;
    const rows = Array.from({ length: rowCount }, () => ['x']);

    assert.equal(renderTextTable(rows), 'x\n'.repeat(rowCount));
  });

  test('aligns uneven rows including empty rows', () => {
    assert.equal(renderTextTable([
      [],
      ['id'],
      ['a', 'name'],
      ['long', 'b']
    ]), '\nid\na     name\nlong  b\n');
  });
});
