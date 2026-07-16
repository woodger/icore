import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  renderCsv,
  renderCsvRow
} from '../../index';

describe('renderCsvRow', () => {
  test('escapes comma, quote, carriage return and newline cells', () => {
    const output = renderCsvRow([
      'plain',
      'with,comma',
      'with "quote"',
      'carriage\rreturn',
      'line\nbreak',
      42,
      true
    ]);

    assert.equal(
      output,
      'plain,"with,comma","with ""quote""","carriage\rreturn","line\nbreak",42,true'
    );
  });
});

describe('renderCsv', () => {
  test('renders rows with a trailing newline', () => {
    const output = renderCsv([
      ['id', 'name'],
      [1, 'Alice']
    ]);

    assert.equal(output, [
      'id,name',
      '1,Alice',
      ''
    ].join('\n'));
  });

  test('renders empty rows as an empty string', () => {
    assert.equal(renderCsv([]), '');
  });
});
