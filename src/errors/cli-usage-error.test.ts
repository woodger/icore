import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  CliUsageError,
  isUsageError
} from './cli-usage-error';
import { IcoreError } from './icore-error';

describe('CliUsageError', () => {
  test('preserves the standard Error contract', () => {
    const error = new CliUsageError('Invalid date range');

    assert.ok(error instanceof Error);
    assert.equal(error.name, 'CliUsageError');
    assert.equal(error.message, 'Invalid date range');
  });
});

describe('isUsageError', () => {
  test('recognizes application usage errors and narrows their type', () => {
    const error: unknown = new CliUsageError('Invalid date range');

    assert.ok(isUsageError(error));
    assert.equal(error.message, 'Invalid date range');
  });

  test('recognizes icore usage errors', () => {
    const error = new IcoreError(
      'UNKNOWN_COMMAND',
      'Unknown command: missing',
      {
        reason: 'unresolved',
        command: 'missing',
        positionals: ['missing']
      }
    );

    assert.equal(isUsageError(error), true);
  });

  test('rejects icore definition errors', () => {
    const error = new IcoreError(
      'DUPLICATE_COMMAND',
      'Duplicate command: status',
      {
        command: 'status'
      }
    );

    assert.equal(isUsageError(error), false);
  });

  test('rejects unrelated thrown values', () => {
    assert.equal(isUsageError(new Error('failed')), false);
    assert.equal(isUsageError('failed'), false);
  });
});
