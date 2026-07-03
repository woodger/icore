import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  createPresentation,
  isPresentationFormat,
  isPresentationResult,
  presentationFormatOptions,
  renderCsv,
  renderCsvRow,
  renderJson,
  renderPresentationResult,
  renderTextTable
} from './cli';

describe('createPresentation', () => {
  test('creates a terminal presentation facade', () => {
    const presentation = createPresentation();

    assert.deepStrictEqual(presentation.formats, ['json', 'table', 'csv']);
    assert.deepStrictEqual(presentation.view.records([
      {
        id: 'account-id'
      }
    ]), {
      type: 'records',
      value: [
        {
          id: 'account-id'
        }
      ]
    });
    assert.equal(presentation.json.render({ id: 'account-id' }), [
      '{',
      '  "id": "account-id"',
      '}',
      ''
    ].join('\n'));
    assert.equal(presentation.table.render([
      ['id'],
      ['account-id']
    ]), [
      'id',
      'account-id',
      ''
    ].join('\n'));
    assert.equal(presentation.csv.render([
      ['id'],
      ['account-id']
    ]), [
      'id',
      'account-id',
      ''
    ].join('\n'));
  });

  test('creates presentation views', () => {
    const presentation = createPresentation();

    assert.deepStrictEqual(presentation.view.empty(), {
      type: 'empty'
    });
    assert.deepStrictEqual(presentation.view.text('ok\n'), {
      type: 'text',
      value: 'ok\n'
    });
    assert.deepStrictEqual(presentation.view.record({ id: 'account-id' }), {
      type: 'record',
      value: {
        id: 'account-id'
      }
    });
    assert.deepStrictEqual(presentation.view.table([
      ['id'],
      ['account-id']
    ]), {
      type: 'table',
      rows: [
        ['id'],
        ['account-id']
      ]
    });
    assert.deepStrictEqual(presentation.view.csv([
      ['id'],
      ['account-id']
    ]), {
      type: 'csv',
      rows: [
        ['id'],
        ['account-id']
      ]
    });
  });
});

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

describe('renderPresentationResult', () => {
  test('renders records as table by default', () => {
    const output = renderPresentationResult({
      type: 'records',
      value: [
        {
          id: 'account-1',
          active: true
        },
        {
          id: 'account-2',
          balance: 42
        }
      ]
    });

    assert.equal(output, [
      'id         active  balance',
      'account-1  true',
      'account-2          42',
      ''
    ].join('\n'));
  });

  test('renders records as csv', () => {
    const output = renderPresentationResult({
      type: 'records',
      value: [
        {
          id: 'account-1',
          active: true
        }
      ]
    }, 'csv');

    assert.equal(output, [
      'id,active',
      'account-1,true',
      ''
    ].join('\n'));
  });

  test('renders records as json', () => {
    const output = renderPresentationResult({
      type: 'record',
      value: {
        id: 'account-1'
      }
    }, 'json');

    assert.equal(JSON.parse(output).id, 'account-1');
  });

  test('keeps text and empty results format-independent', () => {
    assert.equal(renderPresentationResult({
      type: 'text',
      value: 'ok\n'
    }, 'json'), 'ok\n');
    assert.equal(renderPresentationResult({
      type: 'empty'
    }, 'csv'), '');
  });
});

describe('presentation guards', () => {
  test('checks presentation formats and result shapes', () => {
    assert.equal(isPresentationFormat('json'), true);
    assert.equal(isPresentationFormat('xml'), false);
    assert.equal(isPresentationResult({
      type: 'records',
      value: []
    }), true);
    assert.equal(isPresentationResult({
      type: 'records'
    }), false);
    assert.equal(isPresentationResult({
      value: []
    }), false);
  });
});
