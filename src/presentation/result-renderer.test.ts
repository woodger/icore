import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  isPresentationResult,
  renderPresentationResult
} from '../cli';

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
});
