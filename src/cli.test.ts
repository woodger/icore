import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  defineCommand,
  defineCommandRegistry,
  isCommandName,
  mergeOptionsSchema,
  parseArgv,
  parseOptions,
  parseOptionsDetailed,
  resolveCommand,
  resolveCommandFromArgs,
  runCommand,
  runCommandFromRegistry,
  type CommandName,
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

describe('command registry', () => {
  type RegistryContext = {
    accountId: string;
  };

  const usersCommand = defineCommand({
    path: ['users'],
    options: {},
    allowExtraPositionals: true,
    handle({ context }: { context: RegistryContext }) {
      return `users:${context.accountId}`;
    }
  });

  const accountsCommand = defineCommand({
    path: ['users', 'get-accounts'],
    options: {
      format: {
        type: 'string',
        choices: ['json', 'table'],
        default: 'table'
      },
      verbose: {
        type: 'boolean'
      }
    },
    allowExtraPositionals: true,
    handle({ options, positionals, context }: {
      options: {
        format: 'json' | 'table';
        verbose: boolean | undefined;
      };
      positionals: string[];
      context: RegistryContext;
    }) {
      return [
        context.accountId,
        options.format,
        String(options.verbose),
        positionals.join(',')
      ].join(':');
    }
  });

  const registry = defineCommandRegistry([
    usersCommand,
    accountsCommand
  ] as const);

  test('defines command names and checks registered names', () => {
    const commandName: CommandName<typeof accountsCommand> = 'users get-accounts';

    assert.deepStrictEqual(registry.commandNames, [
      'users',
      'users get-accounts'
    ]);
    assert.strictEqual(commandName, 'users get-accounts');
    assert.strictEqual(isCommandName(registry, 'users get-accounts'), true);
    assert.strictEqual(isCommandName(registry, 'unknown'), false);
  });

  test('rejects duplicate command paths', () => {
    assert.throws(
      () => defineCommandRegistry([
        accountsCommand,
        accountsCommand
      ] as const),
      /Unexpected duplicate command 'users get-accounts'/
    );
  });

  test('resolves the most specific matching command from positionals', () => {
    const resolved = resolveCommand(registry, [
      'users',
      'get-accounts',
      'extra'
    ]);

    assert.strictEqual(resolved.name, 'users get-accounts');
    assert.strictEqual(resolved.command, accountsCommand);
    assert.deepStrictEqual(resolved.path, ['users', 'get-accounts']);
    assert.deepStrictEqual(resolved.positionals, ['extra']);
  });

  test('resolves commands from raw args using command option schemas', () => {
    const resolved = resolveCommandFromArgs(registry, [
      '--verbose',
      'users',
      'get-accounts',
      'extra'
    ]);

    assert.strictEqual(resolved.name, 'users get-accounts');
    assert.strictEqual(resolved.command, accountsCommand);
    assert.deepStrictEqual(resolved.positionals, ['extra']);
  });

  test('runs resolved command from registry', async () => {
    assert.strictEqual(
      await runCommandFromRegistry(registry, [
        '--verbose',
        'users',
        'get-accounts',
        '--format',
        'json',
        'extra'
      ], {
        accountId: 'account-id'
      }),
      'account-id:json:true:extra'
    );
  });

  test('rejects unknown commands', async () => {
    assert.throws(
      () => resolveCommand(registry, ['unknown']),
      /Unknown command: unknown/
    );

    await assert.rejects(
      () => runCommandFromRegistry(registry, ['unknown'], {
        accountId: 'account-id'
      }),
      /Unknown command: unknown/
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
