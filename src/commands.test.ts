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

  test('runs handler with explicit boolean values', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {
        verbose: {
          type: 'boolean'
        }
      },
      handle({ options, provided }) {
        return `${String(options.verbose)}:${String(provided.verbose)}`;
      }
    });

    assert.strictEqual(
      await runCommand(
        command,
        ['users', 'get-accounts', '--verbose=true'],
        undefined
      ),
      'true:true'
    );

    assert.strictEqual(
      await runCommand(
        command,
        ['users', 'get-accounts', '--verbose=false'],
        undefined
      ),
      'false:true'
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

  test('rejects empty explicit option values', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {
        name: {
          type: 'string'
        },
        verbose: {
          type: 'boolean'
        }
      },
      handle() {
        return 'ok';
      }
    });

    await assert.rejects(
      () => runCommand(command, ['users', 'get-accounts', '--name='], undefined),
      /Expected '--name' as string/
    );

    await assert.rejects(
      () => runCommand(command, ['users', 'get-accounts', '--verbose='], undefined),
      /Expected '--verbose' as boolean flag/
    );
  });

  test('keeps explicit false after boolean flags as a positional', async () => {
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
        ['users', 'get-accounts', '--verbose', 'false'],
        undefined
      ),
      'true:false'
    );
  });

  test('passes arguments after terminator as positionals', async () => {
    const command = defineCommand({
      path: ['cmd'],
      options: {
        name: {
          type: 'string'
        }
      },
      allowExtraPositionals: true,
      handle({ options, positionals }) {
        return `${String(options.name)}:${positionals.join(',')}`;
      }
    });

    assert.strictEqual(
      await runCommand(
        command,
        ['cmd', '--', '--name', 'value', '-x'],
        undefined
      ),
      'undefined:--name,value,-x'
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
