import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  IcoreError,
  type IcoreErrorCode
} from './icore-error';

describe('IcoreError', () => {
  test('categorizes usage errors', () => {
    const codes: readonly IcoreErrorCode[] = [
      'UNKNOWN_COMMAND',
      'UNEXPECTED_ARGUMENT',
      'DUPLICATE_ARGUMENT',
      'EXPECTED_REQUIRED_ARGUMENT',
      'INVALID_OPTION_TYPE',
      'INVALID_OPTION_CHOICE',
      'UNEXPECTED_POSITIONAL'
    ];

    for (const code of codes) {
      assert.equal(new IcoreError(code, code).category, 'usage');
    }
  });

  test('categorizes definition errors', () => {
    const codes: readonly IcoreErrorCode[] = [
      'INVALID_OPTION_ALIAS',
      'DUPLICATE_ALIAS',
      'INVALID_OPTION_DEFAULT',
      'DUPLICATE_COMMAND'
    ];

    for (const code of codes) {
      assert.equal(new IcoreError(code, code).category, 'definition');
    }
  });
});
