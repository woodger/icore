import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  createStdoutWriter,
  presentationFormatOptions,
  renderCsvRow,
  renderJson,
  renderTextTable
} from './index';

describe('package entrypoint', () => {
  test('exposes terminal presentation and output contracts', () => {
    assert.equal(typeof renderJson, 'function');
    assert.equal(typeof renderCsvRow, 'function');
    assert.equal(typeof renderTextTable, 'function');
    assert.equal(typeof createStdoutWriter, 'function');
    assert.deepStrictEqual(presentationFormatOptions.format.choices, [
      'json',
      'table',
      'csv'
    ]);
  });
});
