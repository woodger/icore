import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  IcoreError,
  parseArgv
} from '../index';

describe('parseArgv', () => {
  test('parses positionals and long options', () => {
    assert.deepStrictEqual(
      parseArgv([
        'users',
        'get-accounts',
        '--token',
        'secret',
        '--format=json',
        '--insecure'
      ]),
      {
        positionals: ['users', 'get-accounts'],
        options: {
          token: 'secret',
          format: 'json',
          insecure: true
        }
      }
    );
  });

  test('rejects duplicated options', () => {
    assert.throws(
      () => parseArgv(['--format', 'json', '--format', 'table']),
      /Unexpected duplicate argument '--format'/
    );
  });

  test('throws machine-readable duplicate argument errors', () => {
    assert.throws(
      () => parseArgv(['--format', 'json', '--format', 'table']),
      (error) => {
        assert.ok(error instanceof IcoreError);
        assert.strictEqual(error.code, 'DUPLICATE_ARGUMENT');
        assert.strictEqual(error.message, "Unexpected duplicate argument '--format'");
        assert.deepStrictEqual(error.details, {
          argument: '--format',
          option: 'format'
        });

        return true;
      }
    );
  });

  test('throws machine-readable malformed option errors', () => {
    assert.throws(
      () => parseArgv(['--=value']),
      (error) => {
        assert.ok(error instanceof IcoreError);
        assert.strictEqual(error.code, 'UNEXPECTED_ARGUMENT');
        assert.strictEqual(error.message, "Unexpected argument '--=value'");
        assert.deepStrictEqual(error.details, {
          reason: 'malformed-option',
          argument: '--=value'
        });

        return true;
      }
    );
  });

  test('uses schema to keep boolean flags from consuming following positionals', () => {
    assert.deepStrictEqual(
      parseArgv([
        'users',
        'get-accounts',
        '--insecure',
        'extra'
      ], {
        insecure: {
          type: 'boolean'
        }
      }),
      {
        positionals: ['users', 'get-accounts', 'extra'],
        options: {
          insecure: true
        }
      }
    );
  });

  test('parses short boolean aliases from schema', () => {
    assert.deepStrictEqual(
      parseArgv([
        'users',
        'get-accounts',
        '-v'
      ], {
        verbose: {
          type: 'boolean',
          alias: 'v'
        }
      }),
      {
        positionals: ['users', 'get-accounts'],
        options: {
          verbose: true
        }
      }
    );
  });

  test('parses short string and number aliases with separate values', () => {
    assert.deepStrictEqual(
      parseArgv([
        'users',
        'get-accounts',
        '-n',
        'User',
        '-c',
        '10'
      ], {
        name: {
          type: 'string',
          alias: 'n'
        },
        count: {
          type: 'number',
          alias: 'c'
        }
      }),
      {
        positionals: ['users', 'get-accounts'],
        options: {
          name: 'User',
          count: '10'
        }
      }
    );
  });

  test('keeps boolean flags from consuming explicit false positionals', () => {
    assert.deepStrictEqual(
      parseArgv([
        'users',
        'get-accounts',
        '--insecure',
        'false'
      ], {
        insecure: {
          type: 'boolean'
        }
      }),
      {
        positionals: ['users', 'get-accounts', 'false'],
        options: {
          insecure: true
        }
      }
    );
  });

  test('keeps short boolean aliases from consuming explicit false positionals', () => {
    assert.deepStrictEqual(
      parseArgv([
        'users',
        'get-accounts',
        '-v',
        'false'
      ], {
        verbose: {
          type: 'boolean',
          alias: 'v'
        }
      }),
      {
        positionals: ['users', 'get-accounts', 'false'],
        options: {
          verbose: true
        }
      }
    );
  });

  test('keeps unknown and unsupported short arguments as positionals', () => {
    assert.deepStrictEqual(
      parseArgv([
        'users',
        'get-accounts',
        '-x',
        '-',
        '-n10',
        '-abc'
      ], {
        name: {
          type: 'string',
          alias: 'n'
        }
      }),
      {
        positionals: ['users', 'get-accounts', '-x', '-', '-n10', '-abc'],
        options: {}
      }
    );
  });

  test('keeps short arguments after terminator as positionals', () => {
    assert.deepStrictEqual(
      parseArgv([
        'cmd',
        '--',
        '-v'
      ], {
        verbose: {
          type: 'boolean',
          alias: 'v'
        }
      }),
      {
        positionals: ['cmd', '-v'],
        options: {}
      }
    );
  });

  test('rejects duplicate options provided by short and long names', () => {
    assert.throws(
      () => parseArgv([
        '-v',
        '--verbose'
      ], {
        verbose: {
          type: 'boolean',
          alias: 'v'
        }
      }),
      /Unexpected duplicate argument '--verbose'/
    );
  });

  test('rejects invalid aliases', () => {
    for (const alias of [
      '',
      'vv',
      '-',
      '1',
      ' ',
      'é'
    ]) {
      assert.throws(
        () => parseArgv([], {
          verbose: {
            type: 'boolean',
            alias
          }
        }),
        /Expected alias for '--verbose' as single ASCII letter/
      );
    }
  });

  test('rejects duplicate aliases', () => {
    assert.throws(
      () => parseArgv([], {
        verbose: {
          type: 'boolean',
          alias: 'v'
        },
        version: {
          type: 'boolean',
          alias: 'v'
        }
      }),
      /Unexpected duplicate alias '-v'/
    );
  });

  test('throws machine-readable alias schema errors', () => {
    assert.throws(
      () => parseArgv([], {
        verbose: {
          type: 'boolean',
          alias: '1'
        }
      }),
      (error) => {
        assert.ok(error instanceof IcoreError);
        assert.strictEqual(error.code, 'INVALID_OPTION_ALIAS');
        assert.strictEqual(error.message, "Expected alias for '--verbose' as single ASCII letter");
        assert.deepStrictEqual(error.details, {
          argument: '--verbose',
          option: 'verbose',
          alias: '1'
        });

        return true;
      }
    );

    assert.throws(
      () => parseArgv([], {
        verbose: {
          type: 'boolean',
          alias: 'v'
        },
        version: {
          type: 'boolean',
          alias: 'v'
        }
      }),
      (error) => {
        assert.ok(error instanceof IcoreError);
        assert.strictEqual(error.code, 'DUPLICATE_ALIAS');
        assert.strictEqual(error.message, "Unexpected duplicate alias '-v'");
        assert.deepStrictEqual(error.details, {
          alias: 'v',
          argument: '-v'
        });

        return true;
      }
    );
  });

  test('does not consume terminator as a short string alias value', () => {
    assert.deepStrictEqual(
      parseArgv([
        'cmd',
        '-n',
        '--',
        'value'
      ], {
        name: {
          type: 'string',
          alias: 'n'
        }
      }),
      {
        positionals: ['cmd', 'value'],
        options: {
          name: true
        }
      }
    );
  });

  test('does not consume terminator as a short number alias value', () => {
    assert.deepStrictEqual(
      parseArgv([
        'cmd',
        '-c',
        '--',
        '10'
      ], {
        count: {
          type: 'number',
          alias: 'c'
        }
      }),
      {
        positionals: ['cmd', '10'],
        options: {
          count: true
        }
      }
    );
  });

  test('parses negated long boolean options from schema', () => {
    assert.deepStrictEqual(
      parseArgv([
        'users',
        'get-accounts',
        '--no-cache'
      ], {
        cache: {
          type: 'boolean'
        }
      }),
      {
        positionals: ['users', 'get-accounts'],
        options: {
          cache: false
        }
      }
    );
  });

  test('keeps consuming following values for schema string options', () => {
    assert.deepStrictEqual(
      parseArgv([
        'users',
        'get-accounts',
        '--token',
        'secret'
      ], {
        token: {
          type: 'string'
        }
      }),
      {
        positionals: ['users', 'get-accounts'],
        options: {
          token: 'secret'
        }
      }
    );
  });

  test('uses schema to consume option values that start with a dash', () => {
    assert.deepStrictEqual(
      parseArgv([
        'users',
        'get-accounts',
        '--limit',
        '-1',
        '--label',
        '-draft'
      ], {
        limit: {
          type: 'number'
        },
        label: {
          type: 'string'
        }
      }),
      {
        positionals: ['users', 'get-accounts'],
        options: {
          limit: '-1',
          label: '-draft'
        }
      }
    );
  });

  test('treats arguments after terminator as positionals', () => {
    assert.deepStrictEqual(
      parseArgv([
        'cmd',
        '--',
        '--name',
        'value',
        '-x'
      ], {
        name: {
          type: 'string'
        }
      }),
      {
        positionals: ['cmd', '--name', 'value', '-x'],
        options: {}
      }
    );
  });
});
