import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  defineCommand,
  mergeOptionsSchema,
  parseArgv,
  parseOptions,
  parseOptionsDetailed,
  runCommand,
  type InferOptions,
  type InferProvidedOptions
} from './cli';

describe('mergeOptionsSchema', () => {
  test('merges schemas and preserves literal option types', () => {
    const sdkOptions = {
      token: {
        type: 'string',
        required: true
      },
      insecure: {
        type: 'boolean'
      }
    } as const;
    const formatOptions = {
      format: {
        type: 'string',
        choices: ['json', 'table'],
        default: 'table'
      }
    } as const;

    const schema = mergeOptionsSchema(sdkOptions, formatOptions);
    const options: InferOptions<typeof schema> = parseOptions(schema, {
      token: 'secret',
      insecure: true
    });
    const format: 'json' | 'table' = options.format;

    assert.deepStrictEqual(options, {
      token: 'secret',
      insecure: true,
      format: 'table'
    });
    assert.strictEqual(format, 'table');
  });

  test('uses later schemas for duplicate option names', () => {
    const schema = mergeOptionsSchema({
      format: {
        type: 'string',
        choices: ['json'],
        default: 'json'
      }
    } as const, {
      format: {
        type: 'string',
        choices: ['json', 'table'],
        default: 'table'
      }
    } as const);

    assert.deepStrictEqual(parseOptions(schema, {}), {
      format: 'table'
    });
  });
});

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

describe('parseOptionsDetailed', () => {
  test('returns parsed options and user-provided metadata', () => {
    const schema = {
      token: {
        type: 'string',
        required: true
      },
      format: {
        type: 'string',
        choices: ['json', 'table'],
        default: 'table'
      },
      insecure: {
        type: 'boolean'
      }
    } as const;

    type Options = InferOptions<typeof schema>;
    type Provided = InferProvidedOptions<typeof schema>;

    const result = parseOptionsDetailed(schema, {
      token: 'secret',
      insecure: true
    });
    const options: Options = result.options;
    const provided: Provided = result.provided;

    assert.deepStrictEqual(options, {
      token: 'secret',
      format: 'table',
      insecure: true
    });
    assert.deepStrictEqual(provided, {
      token: true,
      format: false,
      insecure: true
    });
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

  test('passes user-provided option metadata to handler', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {
        format: {
          type: 'string',
          choices: ['json', 'table'],
          default: 'table'
        }
      },
      handle({ provided }) {
        return provided.format ? 'explicit' : 'default';
      }
    });

    assert.strictEqual(
      await runCommand(command, ['users', 'get-accounts'], undefined),
      'default'
    );
  });

  test('uses command schema when parsing boolean flags', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {
        verbose: {
          type: 'boolean'
        }
      },
      allowExtraPositionals: true,
      handle({ options, positionals }) {
        return `${String(options.verbose)}:${positionals.join(',')}`;
      }
    });

    assert.strictEqual(
      await runCommand(
        command,
        ['users', 'get-accounts', '--verbose', 'account-id'],
        undefined
      ),
      'true:account-id'
    );
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
