import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  defineCommand,
  defineCommandRegistry,
  isCommandName,
  resolveCommand,
  resolveCommandFromArgs,
  runCommand,
  runCommandFromRegistry,
  type CommandName
} from './cli';

describe('command registry', () => {
  test('defines command names and checks registered names', () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {},
      handle() {
        return 'accounts';
      }
    });
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {},
        handle() {
          return 'users';
        }
      }),
      command
    ] as const);
    const commandName: CommandName<typeof command> = 'users get-accounts';

    assert.deepStrictEqual(commandRegistry.commandNames, [
      'users',
      'users get-accounts'
    ]);
    assert.strictEqual(commandName, 'users get-accounts');
    assert.strictEqual(isCommandName(commandRegistry, 'users get-accounts'), true);
    assert.strictEqual(isCommandName(commandRegistry, 'unknown'), false);
  });

  test('rejects duplicate command paths', () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {},
      handle() {
        return 'accounts';
      }
    });

    assert.throws(
      () => defineCommandRegistry([
        command,
        command
      ] as const),
      /Unexpected duplicate command 'users get-accounts'/
    );
  });

  test('resolves the most specific matching command from positionals', () => {
    const specificCommand = defineCommand({
      path: ['users', 'get-accounts'],
      options: {},
      allowExtraPositionals: true,
      handle() {
        return 'accounts';
      }
    });
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {},
        allowExtraPositionals: true,
        handle() {
          return 'users';
        }
      }),
      specificCommand
    ] as const);

    const resolved = resolveCommand(commandRegistry, [
      'users',
      'get-accounts',
      'extra'
    ]);

    assert.strictEqual(resolved.name, 'users get-accounts');
    assert.strictEqual(resolved.command, specificCommand);
    assert.deepStrictEqual(resolved.path, ['users', 'get-accounts']);
    assert.deepStrictEqual(resolved.positionals, ['extra']);
  });

  test('resolves commands from raw args using command option schemas', () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {
        verbose: {
          type: 'boolean'
        }
      },
      allowExtraPositionals: true,
      handle() {
        return 'accounts';
      }
    });
    const commandRegistry = defineCommandRegistry([
      command
    ] as const);

    const resolved = resolveCommandFromArgs(commandRegistry, [
      '--verbose',
      'users',
      'get-accounts',
      'extra'
    ]);

    assert.strictEqual(resolved.name, 'users get-accounts');
    assert.strictEqual(resolved.command, command);
    assert.deepStrictEqual(resolved.positionals, ['extra']);
  });

  test('runs resolved command from registry', async () => {
    const commandRegistry = defineCommandRegistry([
      defineCommand({
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
          context: { accountId: string };
        }) {
          return [
            context.accountId,
            options.format,
            String(options.verbose),
            positionals.join(',')
          ].join(':');
        }
      })
    ] as const);

    assert.strictEqual(
      await runCommandFromRegistry(commandRegistry, [
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
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {},
        handle() {
          return 'users';
        }
      })
    ] as const);

    assert.throws(
      () => resolveCommand(commandRegistry, ['unknown']),
      /Unknown command: unknown/
    );

    await assert.rejects(
      () => runCommandFromRegistry(commandRegistry, ['unknown'], {
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

  test('runs handler with short option aliases', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {
        name: {
          type: 'string',
          alias: 'n'
        },
        count: {
          type: 'number',
          alias: 'c'
        },
        verbose: {
          type: 'boolean',
          alias: 'v'
        }
      },
      handle({ options }) {
        return [
          options.name,
          String(options.count),
          String(options.verbose)
        ].join(':');
      }
    });

    assert.strictEqual(
      await runCommand(
        command,
        [
          'users',
          'get-accounts',
          '-n',
          'User',
          '-c',
          '10',
          '-v'
        ],
        undefined
      ),
      'User:10:true'
    );
  });

  test('rejects duplicate options provided by short and long names', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {
        verbose: {
          type: 'boolean',
          alias: 'v'
        }
      },
      handle() {
        return 'ok';
      }
    });

    await assert.rejects(
      () => runCommand(
        command,
        [
          'users',
          'get-accounts',
          '-v',
          '--verbose'
        ],
        undefined
      ),
      /Unexpected duplicate argument '--verbose'/
    );
  });

  test('runs handler with negated boolean options', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {
        cache: {
          type: 'boolean',
          default: true
        }
      },
      handle({ options, provided }) {
        return `${String(options.cache)}:${String(provided.cache)}`;
      }
    });

    assert.strictEqual(
      await runCommand(
        command,
        ['users', 'get-accounts', '--no-cache'],
        undefined
      ),
      'false:true'
    );
  });

  test('rejects negated non-boolean and unknown options', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {
        name: {
          type: 'string'
        },
        cache: {
          type: 'boolean'
        }
      },
      handle() {
        return 'ok';
      }
    });

    await assert.rejects(
      () => runCommand(command, ['users', 'get-accounts', '--no-name'], undefined),
      /Unexpected argument '--no-name'/
    );

    await assert.rejects(
      () => runCommand(command, ['users', 'get-accounts', '--no-unknown'], undefined),
      /Unexpected argument '--no-unknown'/
    );
  });

  test('rejects explicit values for negated boolean options', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {
        cache: {
          type: 'boolean'
        }
      },
      handle() {
        return 'ok';
      }
    });

    for (const value of [
      'true',
      'false'
    ]) {
      await assert.rejects(
        () => runCommand(
          command,
          ['users', 'get-accounts', `--no-cache=${value}`],
          undefined
        ),
        /Unexpected argument '--no-cache'/
      );
    }
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
