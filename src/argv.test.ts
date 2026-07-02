import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  parseArgv
} from './cli';

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
