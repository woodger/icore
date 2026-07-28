import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  IcoreError,
  isIcoreError,
  type IcoreErrorDetails
} from './icore-error';

class ForeignBrandedIcoreError extends Error {
  constructor(
    readonly code: unknown,
    readonly category: unknown,
    readonly details: unknown
  ) {
    super('Foreign icore error');

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

describe('IcoreError', () => {
  test('categorizes usage errors', () => {
    const errors = [
      new IcoreError('UNKNOWN_COMMAND', 'unknown command', {
        reason: 'unresolved',
        command: 'unknown',
        positionals: ['unknown']
      }),
      new IcoreError('UNEXPECTED_ARGUMENT', 'unexpected argument', {
        reason: 'malformed-option',
        argument: '--=value'
      }),
      new IcoreError('DUPLICATE_ARGUMENT', 'duplicate argument', {
        argument: '--format',
        option: 'format'
      }),
      new IcoreError('EXPECTED_REQUIRED_ARGUMENT', 'required argument', {
        reason: 'option',
        argument: '--token',
        option: 'token'
      }),
      new IcoreError('INVALID_OPTION_TYPE', 'invalid type', {
        argument: '--limit',
        option: 'limit',
        expected: 'number',
        value: 'many'
      }),
      new IcoreError('INVALID_OPTION_CHOICE', 'invalid choice', {
        argument: '--format',
        option: 'format',
        choices: ['json'],
        value: 'xml'
      }),
      new IcoreError('UNEXPECTED_POSITIONAL', 'unexpected positional', {
        command: 'users',
        positional: 'extra',
        positionals: ['extra']
      })
    ];

    for (const error of errors) {
      assert.equal(error.category, 'usage');
      assert.equal(isIcoreError(error), true);
    }
  });

  test('categorizes definition errors', () => {
    const errors = [
      new IcoreError('INVALID_OPTION_ALIAS', 'invalid alias', {
        argument: '--verbose',
        option: 'verbose',
        alias: '1'
      }),
      new IcoreError('DUPLICATE_ALIAS', 'duplicate alias', {
        argument: '-v',
        alias: 'v'
      }),
      new IcoreError('INVALID_OPTION_DEFAULT', 'invalid default', {
        argument: '--limit',
        option: 'limit',
        expected: 'minimum',
        min: 1,
        value: 0
      }),
      new IcoreError('DUPLICATE_COMMAND', 'duplicate command', {
        command: 'users'
      })
    ];

    for (const error of errors) {
      assert.equal(error.category, 'definition');
      assert.equal(isIcoreError(error), true);
    }
  });
});

describe('isIcoreError', () => {
  test('recognizes a branded error from another physical copy', () => {
    const foreignError = new ForeignBrandedIcoreError(
      'UNKNOWN_COMMAND',
      'usage',
      {
        reason: 'unresolved',
        command: 'missing',
        positionals: ['missing']
      }
    );
    const error: unknown = foreignError;

    assert.equal(foreignError instanceof IcoreError, false);
    assert.ok(isIcoreError(error, 'UNKNOWN_COMMAND'));
    assert.equal(error.details.command, 'missing');
    assert.deepStrictEqual(error.details.positionals, ['missing']);
  });

  test('narrows an error to an exact code', () => {
    const error: unknown = new IcoreError(
      'UNKNOWN_COMMAND',
      'Unknown command: unknown',
      {
        reason: 'unresolved',
        command: 'unknown',
        positionals: ['unknown']
      }
    );

    assert.ok(isIcoreError(error, 'UNKNOWN_COMMAND'));
    assert.equal(error.details.command, 'unknown');
    assert.deepStrictEqual(error.details.positionals, ['unknown']);
  });

  test('preserves code and details correlation for any error', () => {
    const error: unknown = new IcoreError(
      'UNEXPECTED_ARGUMENT',
      "Unexpected argument '--unknown'",
      {
        reason: 'unknown-option',
        argument: '--unknown',
        option: 'unknown'
      }
    );

    assert.ok(isIcoreError(error));

    if (error.code === 'UNEXPECTED_ARGUMENT') {
      assert.equal(error.details.reason, 'unknown-option');

      if (error.details.reason === 'unknown-option') {
        assert.equal(error.details.option, 'unknown');
      }
    }
  });

  test('narrows required positional details', () => {
    const error: unknown = new IcoreError(
      'EXPECTED_REQUIRED_ARGUMENT',
      'Expected required argument <figi...>',
      {
        reason: 'positional',
        argument: '<figi...>',
        positional: 'figi'
      }
    );

    assert.ok(isIcoreError(error, 'EXPECTED_REQUIRED_ARGUMENT'));
    assert.equal(error.details.reason, 'positional');

    if (error.details.reason === 'positional') {
      assert.equal(error.details.argument, '<figi...>');
      assert.equal(error.details.positional, 'figi');
    }
  });

  test('returns false for other errors and non-matching codes', () => {
    const error = new IcoreError('DUPLICATE_COMMAND', 'duplicate command', {
      command: 'users'
    });

    assert.equal(isIcoreError(new Error('failed')), false);
    assert.equal(isIcoreError(error, 'UNKNOWN_COMMAND'), false);
  });

  test('rejects foreign errors with an invalid protocol shape', () => {
    const malformedDetails = new ForeignBrandedIcoreError(
      'UNKNOWN_COMMAND',
      'usage',
      []
    );
    const wrongCategory = new ForeignBrandedIcoreError(
      'UNKNOWN_COMMAND',
      'definition',
      {
        reason: 'unresolved',
        command: 'missing',
        positionals: ['missing']
      }
    );
    const unknownCode = new ForeignBrandedIcoreError(
      'UNKNOWN_CODE',
      'usage',
      {}
    );

    assert.equal(isIcoreError(malformedDetails), false);
    assert.equal(isIcoreError(wrongCategory), false);
    assert.equal(isIcoreError(unknownCode), false);
  });
});

function assertStaticDetailsContract(): void {
  // @ts-expect-error Strong details contracts require the third argument.
  new IcoreError('DUPLICATE_COMMAND', 'duplicate command');

  new IcoreError('DUPLICATE_COMMAND', 'duplicate command', {
    // @ts-expect-error Details must match the selected error code.
    argument: '--format',
    option: 'format'
  });

  // @ts-expect-error Path mismatches always identify the expected path.
  const details: IcoreErrorDetails<'UNKNOWN_COMMAND'> = {
    reason: 'path-mismatch',
    command: 'users',
    positionals: ['unknown']
  };

  // @ts-expect-error Required arguments must identify their semantic variant.
  const requiredDetails: IcoreErrorDetails<'EXPECTED_REQUIRED_ARGUMENT'> = {
    argument: '--token',
    option: 'token'
  };

  void details;
  void requiredDetails;
}

void assertStaticDetailsContract;
