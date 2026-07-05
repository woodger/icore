import assert from 'node:assert';
import { describe, test } from 'node:test';
import { createPresentation } from '../cli';

describe('createPresentation', () => {
  test('creates a terminal presentation facade', () => {
    const presentation = createPresentation();

    assert.deepStrictEqual(presentation.formats, ['json', 'table', 'csv']);
    assert.deepStrictEqual(presentation.records([
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
    assert.equal(presentation.renderers.json.render({ id: 'account-id' }), [
      '{',
      '  "id": "account-id"',
      '}',
      ''
    ].join('\n'));
    assert.equal(presentation.renderers.table.render([
      ['id'],
      ['account-id']
    ]), [
      'id',
      'account-id',
      ''
    ].join('\n'));
    assert.equal(presentation.renderers.csv.render([
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

    assert.deepStrictEqual(presentation.empty(), {
      type: 'empty'
    });
    assert.deepStrictEqual(presentation.text('ok\n'), {
      type: 'text',
      value: 'ok\n'
    });
    assert.deepStrictEqual(presentation.record({ id: 'account-id' }), {
      type: 'record',
      value: {
        id: 'account-id'
      }
    });
    assert.deepStrictEqual(presentation.table([
      ['id'],
      ['account-id']
    ]), {
      type: 'table',
      rows: [
        ['id'],
        ['account-id']
      ]
    });
    assert.deepStrictEqual(presentation.csv([
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
