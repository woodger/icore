import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  createCommands,
  createOutput,
  createStdoutWriter,
  createTerminalApp,
  createPresentation,
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
    assert.equal(typeof createOutput, 'function');
    assert.equal(typeof createCommands, 'function');
    assert.equal(typeof createPresentation, 'function');
    assert.equal(typeof createTerminalApp, 'function');
    assert.deepStrictEqual(createPresentation().view.text('ok\n'), {
      type: 'text',
      value: 'ok\n'
    });
    assert.deepStrictEqual(presentationFormatOptions.format.choices, [
      'json',
      'table',
      'csv'
    ]);
  });
});
