import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  isPresentationResult,
  renderPresentationResult
} from './result-renderer';

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

describe('isPresentationResult', () => {
  test('checks presentation result shapes', () => {
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

  test('validates nested presentation result shapes', () => {
    const sparseRecords: unknown[] = [];
    sparseRecords.length = 1;

    assert.equal(isPresentationResult({
      type: 'records',
      value: [{ id: 'account-1' }]
    }), true);
    assert.equal(isPresentationResult({
      type: 'records',
      value: [null]
    }), false);
    assert.equal(isPresentationResult({
      type: 'records',
      value: [[]]
    }), false);
    assert.equal(isPresentationResult({
      type: 'records',
      value: sparseRecords
    }), false);
    assert.equal(isPresentationResult({
      type: 'table',
      rows: [['id'], ['account-1']]
    }), true);
    assert.equal(isPresentationResult({
      type: 'table',
      rows: [['id'], [1]]
    }), false);
    assert.equal(isPresentationResult({
      type: 'table',
      rows: [null]
    }), false);
    assert.equal(isPresentationResult({
      type: 'csv',
      rows: [['id', 'active'], [1, true]]
    }), true);
    assert.equal(isPresentationResult({
      type: 'csv',
      rows: [['id'], [null]]
    }), false);
    assert.equal(isPresentationResult({
      type: 'csv',
      rows: [null]
    }), false);
  });
});
