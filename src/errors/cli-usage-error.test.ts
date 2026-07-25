import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  CliUsageError,
  isUsageError
} from './cli-usage-error';
import { IcoreError } from './icore-error';

class ForeignBrandedCliUsageError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'CliUsageError';
    Object.defineProperty(
      this,
      Symbol.for('icore.error.CliUsageError.v1'),
      {
        value: true
      }
    );
  }
}

class ForeignBrandedIcoreError extends Error {
  readonly code = 'UNKNOWN_COMMAND';
  readonly category = 'usage';
  readonly details = {
    reason: 'unresolved',
    command: 'missing',
    positionals: ['missing']
  };

  constructor() {
    super('Unknown command: missing');

    this.name = 'IcoreError';
    Object.defineProperty(
      this,
      Symbol.for('icore.error.IcoreError.v1'),
      {
        value: true
      }
    );
  }
}

const LegacyIcoreError = class IcoreError extends Error {
  readonly code = 'UNKNOWN_COMMAND';
  readonly category = 'usage';
  readonly details = {
    reason: 'unresolved',
    command: 'missing',
    positionals: ['missing']
  };

  constructor() {
    super('Unknown command: missing');

    this.name = 'IcoreError';
  }
};

const LegacyCliUsageError = class CliUsageError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'CliUsageError';
  }
};

describe('CliUsageError', () => {
  test('preserves the standard Error contract', () => {
    const error = new CliUsageError('Invalid date range');

    assert.ok(error instanceof Error);
    assert.equal(error.name, 'CliUsageError');
    assert.equal(error.message, 'Invalid date range');
  });
});

describe('isUsageError', () => {
  test('recognizes branded and legacy errors from other physical copies', () => {
    const brandedError = new ForeignBrandedCliUsageError('Invalid date range');
    const legacyError = new LegacyCliUsageError('Invalid date range');

    assert.equal(brandedError instanceof CliUsageError, false);
    assert.equal(legacyError instanceof CliUsageError, false);
    assert.equal(isUsageError(brandedError), true);
    assert.equal(isUsageError(legacyError), true);
  });

  test('recognizes branded and legacy icore errors from other copies', () => {
    const brandedError = new ForeignBrandedIcoreError();
    const legacyError = new LegacyIcoreError();

    assert.equal(brandedError instanceof IcoreError, false);
    assert.equal(legacyError instanceof IcoreError, false);
    assert.equal(isUsageError(brandedError), true);
    assert.equal(isUsageError(legacyError), true);
  });

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
    const renamedError = new Error('failed');

    renamedError.name = 'CliUsageError';

    assert.equal(isUsageError(new Error('failed')), false);
    assert.equal(isUsageError(renamedError), false);
    assert.equal(isUsageError('failed'), false);
  });
});
