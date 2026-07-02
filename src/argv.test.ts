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
