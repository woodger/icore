import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  defineCommand,
  parseArgv,
  parseOptions,
  runCommand,
  type InferOptions
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
});

describe('parseOptions', () => {
  test('parses string choices, boolean flags and number ranges', () => {
    const schema = {
      format: {
        type: 'string',
        choices: ['json', 'table'],
        default: 'table'
      },
      insecure: {
        type: 'boolean'
      },
      limit: {
        type: 'number',
        integer: true,
        min: 1,
        max: 1000,
        required: true
      }
    } as const;

    type Options = InferOptions<typeof schema>;

    const options: Options = parseOptions(schema, {
      insecure: true,
      limit: '100'
    });

    assert.deepStrictEqual(options, {
      format: 'table',
      insecure: true,
      limit: 100
    });
  });

  test('rejects unknown options', () => {
    assert.throws(
      () => parseOptions({}, { unknown: 'value' }),
      /Unexpected argument '--unknown'/
    );
  });

  test('rejects missing required options', () => {
    assert.throws(
      () => parseOptions({
        token: {
          type: 'string',
          required: true
        }
      }, {}),
      /Expected required argument '--token'/
    );
  });

  test('rejects explicit boolean values', () => {
    assert.throws(
      () => parseOptions({
        insecure: {
          type: 'boolean'
        }
      }, {
        insecure: 'true'
      }),
      /Expected '--insecure' as boolean flag/
    );
  });

  test('rejects non-integer and out-of-range numbers', () => {
    const schema = {
      depth: {
        type: 'number',
        integer: true,
        min: 1
      }
    } as const;

    assert.throws(
      () => parseOptions(schema, { depth: '1.5' }),
      /Expected '--depth' as integer/
    );

    assert.throws(
      () => parseOptions(schema, { depth: '0' }),
      /Expected '--depth' to be greater than or equal to 1/
    );
  });

  test('validates default values with the same option constraints', () => {
    assert.throws(
      () => parseOptions({
        format: {
          type: 'string',
          choices: ['json', 'table'],
          default: 'xml'
        }
      } as const, {}),
      /Expected '--format' as one of: json, table/
    );

    assert.throws(
      () => parseOptions({
        limit: {
          type: 'number',
          integer: true,
          min: 1,
          default: 0
        }
      } as const, {}),
      /Expected '--limit' to be greater than or equal to 1/
    );
  });
});

describe('runCommand', () => {
  test('runs handler with parsed options and context', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {
        format: {
          type: 'string',
          choices: ['json', 'table'],
          default: 'table'
        }
      },
      handle({ options, context }: {
        options: { format: 'json' | 'table' };
        context: { accountId: string };
      }) {
        return `${context.accountId}:${options.format}`;
      }
    });

    await assert.doesNotReject(async () => {
      assert.strictEqual(
        await runCommand(
          command,
          ['users', 'get-accounts', '--format', 'json'],
          { accountId: 'account-id' }
        ),
        'account-id:json'
      );
    });
  });

  test('rejects extra positionals by default', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {},
      handle() {
        return 'ok';
      }
    });

    await assert.rejects(
      () => runCommand(command, ['users', 'get-accounts', 'extra'], undefined),
      /Unexpected positional argument for 'users get-accounts': extra/
    );
  });
});
