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
});
