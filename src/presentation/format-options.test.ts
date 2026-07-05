import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  isPresentationFormat,
  presentationFormatOptions
} from '../cli';

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

describe('isPresentationFormat', () => {
  test('checks supported presentation formats', () => {
    assert.equal(isPresentationFormat('json'), true);
    assert.equal(isPresentationFormat('xml'), false);
  });
});
