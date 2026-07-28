import assert from 'node:assert';
import { describe, test } from 'node:test';
import { createPresentationViewFactory } from './view';

describe('createPresentationViewFactory', () => {
  test('creates an empty view', () => {
    const presentation = createPresentationViewFactory();

    assert.deepStrictEqual(presentation.empty(), {
      type: 'empty'
    });
  });

  test('creates a text view', () => {
    const presentation = createPresentationViewFactory();

    assert.deepStrictEqual(presentation.text('ok\n'), {
      type: 'text',
      value: 'ok\n'
    });
  });

  test('creates a record view', () => {
    const presentation = createPresentationViewFactory();

    assert.deepStrictEqual(presentation.record({
      id: 'account-id'
    }), {
      type: 'record',
      value: {
        id: 'account-id'
      }
    });
  });

  test('creates a records view', () => {
    const presentation = createPresentationViewFactory();

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
  });

  test('creates a table view', () => {
    const presentation = createPresentationViewFactory();

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
  });

  test('creates a CSV view', () => {
    const presentation = createPresentationViewFactory();

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
