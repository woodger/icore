import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  presentationFormatOptions,
  renderCsv,
  renderCsvRow,
  renderJson,
  renderTextTable
} from './cli';

describe('presentation renderers', () => {
  describe('presentationFormatOptions', () => {
    test('defines the shared format option contract', () => {
      assert.deepStrictEqual(presentationFormatOptions, {
        format: {
          type: 'string',
          choices: ['json', 'table', 'csv'],
          default: 'table'
        }
      });
    });
  });

  describe('renderJson', () => {
    test('renders pretty JSON with a trailing newline', () => {
      const output = renderJson([
        {
          id: 'account-1',
          name: 'Brokerage account'
        }
      ]);

      assert.equal(output, [
        '[',
        '  {',
        '    "id": "account-1",',
        '    "name": "Brokerage account"',
        '  }',
        ']',
        ''
      ].join('\n'));
    });
  });

  describe('renderCsvRow', () => {
    test('escapes comma, quote and newline cells', () => {
      const output = renderCsvRow([
        'plain',
        'with,comma',
        'with "quote"',
        'line\nbreak',
        42,
        true
      ]);

      assert.equal(output, 'plain,"with,comma","with ""quote""","line\nbreak",42,true');
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
});
