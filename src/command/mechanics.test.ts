import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  createCommand,
  createCommands,
  defineCommand,
  defineCommandRegistry,
  IcoreError,
  isCommandName,
  isPreparedCommandName,
  prepareCommandFromArgs,
  resolveCommand,
  resolveCommandFromArgs,
  runCommand,
  runPreparedCommand,
  runCommandFromRegistry,
  type CommandName,
  type CommandContext,
  type CommandPayload,
  type CommandResult,
  type PreparedCommand,
  type PreparedCommandInput
} from '../index';

describe('createCommand', () => {
  test('creates a semantic command mechanics facade', async () => {
    const command = createCommand();
    const getAccounts = command.define({
      path: ['users', 'get-accounts'],
      options: {
        format: {
          type: 'string',
          choices: ['json', 'table'],
          default: 'table'
        }
      } as const,
      handle({ options, context }: {
        options: {
          format: 'json' | 'table';
        };
        context: {
          accountId: string;
        };
      }) {
        return `${context.accountId}:${options.format}`;
      }
    });
    const commands = command.registry([
      getAccounts
    ] as const);
    const prepared = await commands.prepare([
      'users',
      'get-accounts',
      '--format=json'
    ]);

    assert.deepStrictEqual(commands.names, ['users get-accounts']);
    assert.strictEqual(prepared.name, 'users get-accounts');
    assert.strictEqual(
      await commands.run(prepared, {
        accountId: 'account-id'
      }),
      'account-id:json'
    );
    assert.strictEqual(
      await command.run(getAccounts, [
        'users',
        'get-accounts'
      ], {
        accountId: 'fallback-id'
      }),
      'fallback-id:table'
    );
  });
});

describe('createCommands', () => {
  test('creates a command mechanics facade', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {
        format: {
          type: 'string',
          choices: ['json', 'table'],
          default: 'table'
        }
      } as const,
      handle({ options, context }: {
        options: {
          format: 'json' | 'table';
        };
        context: {
          accountId: string;
        };
      }) {
        return `${context.accountId}:${options.format}`;
      }
    });
    const commands = createCommands([
      command
    ] as const);
    const prepared = await commands.prepare([
      'users',
      'get-accounts',
      '--format=json'
    ]);

    assert.deepStrictEqual(commands.names, ['users get-accounts']);
    assert.strictEqual(commands.resolve(['users', 'get-accounts']).command, command);
    assert.strictEqual(commands.resolveFromArgs(['users', 'get-accounts']).command, command);
    assert.strictEqual(prepared.name, 'users get-accounts');
    assert.strictEqual(
      await commands.run(prepared, {
        accountId: 'account-id'
      }),
      'account-id:json'
    );
    assert.strictEqual(
      await commands.runFromArgs([
        'users',
        'get-accounts'
      ], {
        accountId: 'fallback-id'
      }),
      'fallback-id:table'
    );
  });
});

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

  test('throws machine-readable duplicate command errors', () => {
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
      (error) => {
        assert.ok(error instanceof IcoreError);
        assert.strictEqual(error.code, 'DUPLICATE_COMMAND');
        assert.strictEqual(error.message, "Unexpected duplicate command 'users get-accounts'");
        assert.deepStrictEqual(error.details, {
          command: 'users get-accounts'
        });

        return true;
      }
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

  test('throws machine-readable unknown command errors', async () => {
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {},
        handle() {
          return 'users';
        }
      })
    ] as const);
    const assertUnknownCommandError = (error: unknown): boolean => {
      assert.ok(error instanceof IcoreError);
      assert.strictEqual(error.code, 'UNKNOWN_COMMAND');
      assert.strictEqual(error.message, 'Unknown command: unknown');
      assert.deepStrictEqual(error.details, {
        reason: 'unresolved',
        command: 'unknown',
        positionals: ['unknown']
      });

      return true;
    };

    assert.throws(
      () => resolveCommand(commandRegistry, ['unknown']),
      assertUnknownCommandError
    );

    await assert.rejects(
      () => prepareCommandFromArgs(commandRegistry, ['unknown']),
      assertUnknownCommandError
    );
  });
});

describe('two-phase command execution', () => {
  test('rejects unknown commands during prepare without calling handlers', async () => {
    let handled = false;
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {},
        handle() {
          handled = true;
          return 'ok';
        }
      })
    ] as const);

    await assert.rejects(
      () => prepareCommandFromArgs(commandRegistry, ['unknown']),
      /Unknown command: unknown/
    );
    assert.strictEqual(handled, false);
  });

  test('rejects unknown options after command path during prepare', async () => {
    let handled = false;
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {},
        handle() {
          handled = true;
          return 'ok';
        }
      })
    ] as const);

    await assert.rejects(
      () => prepareCommandFromArgs(commandRegistry, ['users', '--unknown']),
      /Unexpected argument '--unknown'/
    );
    assert.strictEqual(handled, false);
  });

  test('keeps legacy before-command option resolution by default', async () => {
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {},
        handle() {
          return 'ok';
        }
      })
    ] as const);

    await assert.rejects(
      () => prepareCommandFromArgs(commandRegistry, ['--unknown', 'users']),
      /Unknown command: <empty>/
    );
  });

  test('rejects long options before command path in strict mode', async () => {
    let handled = false;
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {
          verbose: {
            type: 'boolean'
          }
        },
        handle() {
          handled = true;
          return 'ok';
        }
      })
    ] as const);

    for (const args of [
      ['--unknown', 'users'],
      ['--verbose', 'users']
    ]) {
      await assert.rejects(
        () => prepareCommandFromArgs(commandRegistry, args, {
          strict: true
        }),
        (error) => {
          assert.ok(error instanceof IcoreError);
          assert.strictEqual(error.code, 'UNEXPECTED_ARGUMENT');
          assert.strictEqual(error.message, `Unexpected argument '${args[0] ?? ''}'`);
          assert.deepStrictEqual(error.details, {
            reason: 'option-before-command',
            argument: args[0]
          });

          return true;
        }
      );
    }

    assert.strictEqual(handled, false);
  });

  test('rejects short options before command path in strict mode', async () => {
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {},
        handle() {
          return 'ok';
        }
      })
    ] as const);

    await assert.rejects(
      () => prepareCommandFromArgs(commandRegistry, ['-x', 'users'], {
        strict: true
      }),
      (error) => {
        assert.ok(error instanceof IcoreError);
        assert.strictEqual(error.code, 'UNEXPECTED_ARGUMENT');
        assert.strictEqual(error.message, "Unexpected argument '-x'");
        assert.deepStrictEqual(error.details, {
          reason: 'option-before-command',
          argument: '-x'
        });

        return true;
      }
    );
  });

  test('accepts options after command path in strict mode', async () => {
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {
          verbose: {
            type: 'boolean'
          }
        },
        handle() {
          return 'ok';
        }
      })
    ] as const);

    const prepared = await prepareCommandFromArgs(commandRegistry, [
      'users',
      '--verbose'
    ], {
      strict: true
    });

    assert.deepStrictEqual(prepared.options, {
      verbose: true
    });
  });

  test('rejects missing required options during prepare', async () => {
    let handled = false;
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {
          token: {
            type: 'string',
            required: true
          }
        },
        handle() {
          handled = true;
          return 'ok';
        }
      })
    ] as const);

    await assert.rejects(
      () => prepareCommandFromArgs(commandRegistry, ['users']),
      /Expected required argument '--token'/
    );
    assert.strictEqual(handled, false);
  });

  test('rejects invalid choices during prepare', async () => {
    let handled = false;
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {
          format: {
            type: 'string',
            choices: ['json']
          }
        },
        handle() {
          handled = true;
          return 'ok';
        }
      })
    ] as const);

    await assert.rejects(
      () => prepareCommandFromArgs(commandRegistry, ['users', '--format', 'xml']),
      /Expected '--format' as one of: json/
    );
    assert.strictEqual(handled, false);
  });

  test('rejects invalid numbers during prepare', async () => {
    let handled = false;
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {
          count: {
            type: 'number',
            integer: true
          }
        },
        handle() {
          handled = true;
          return 'ok';
        }
      })
    ] as const);

    await assert.rejects(
      () => prepareCommandFromArgs(commandRegistry, ['users', '--count', 'many']),
      /Expected '--count' as number/
    );
    assert.strictEqual(handled, false);
  });

  test('rejects unexpected positionals during prepare', async () => {
    let handled = false;
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {},
        handle() {
          handled = true;
          return 'ok';
        }
      })
    ] as const);

    await assert.rejects(
      () => prepareCommandFromArgs(commandRegistry, ['users', 'extra']),
      /Unexpected positional argument for 'users': extra/
    );
    assert.strictEqual(handled, false);
  });

  test('rejects prepare hook errors before calling handlers', async () => {
    let handled = false;
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {},
        prepare() {
          throw new Error('prepare failed');
        },
        handle() {
          handled = true;
          return 'ok';
        }
      })
    ] as const);

    await assert.rejects(
      () => prepareCommandFromArgs(commandRegistry, ['users']),
      /prepare failed/
    );
    assert.strictEqual(handled, false);
  });

  test('returns command metadata before runtime context is created', async () => {
    const command = defineCommand({
      path: ['users'],
      metadata: {
        resource: 'database'
      } as const,
      options: {},
      handle() {
        return 'ok';
      }
    });
    const commandRegistry = defineCommandRegistry([
      command
    ] as const);

    const prepared: PreparedCommand<typeof command> = await prepareCommandFromArgs(
      commandRegistry,
      ['users']
    );

    assert.strictEqual(prepared.command.metadata?.resource, 'database');
  });

  test('returns typed prepare payload before runtime context is created', async () => {
    const options = {
      name: {
        type: 'string',
        required: true
      }
    } as const;
    const command = defineCommand({
      path: ['users'],
      options,
      prepare({ options: parsedOptions }) {
        return {
          normalizedName: parsedOptions.name.trim().toLowerCase()
        };
      },
      handle({ payload, context }: {
        payload: { normalizedName: string };
        context: { prefix: string };
      }) {
        return `${context.prefix}:${payload.normalizedName}`;
      }
    });
    const commandRegistry = defineCommandRegistry([
      command
    ] as const);

    const prepared: PreparedCommand<typeof command> = await prepareCommandFromArgs(
      commandRegistry,
      [
        'users',
        '--name',
        ' Alice '
      ]
    );
    const normalizedName: string = prepared.payload.normalizedName;

    assert.strictEqual(normalizedName, 'alice');
    assert.strictEqual(
      await runPreparedCommand(prepared, {
        prefix: 'user'
      }),
      'user:alice'
    );
  });

  test('narrows prepared payload by command name in registry unions', async () => {
    const accountCommand = defineCommand({
      path: ['accounts'],
      options: {},
      prepare() {
        return {
          accountId: 'account-id'
        };
      },
      handle({ payload, context }: {
        payload: { accountId: string };
        context: { prefix: string };
      }) {
        return `${context.prefix}:${payload.accountId}`;
      }
    });
    const projectCommand = defineCommand({
      path: ['projects'],
      options: {},
      prepare() {
        return {
          projectId: 'project-id'
        };
      },
      handle({ payload }: {
        payload: { projectId: string };
      }) {
        return payload.projectId;
      }
    });
    const commandRegistry = defineCommandRegistry([
      accountCommand,
      projectCommand
    ] as const);

    const prepared = await prepareCommandFromArgs(commandRegistry, ['accounts']);

    if (isPreparedCommandName(prepared, 'accounts')) {
      const payload: CommandPayload<typeof accountCommand> = prepared.payload;
      const context: CommandContext<typeof accountCommand> = {
        prefix: 'account'
      };
      const result: CommandResult<typeof accountCommand> = await runPreparedCommand(
        prepared,
        context
      );

      assert.strictEqual(payload.accountId, 'account-id');
      assert.strictEqual(result, 'account:account-id');
    } else if (isPreparedCommandName(prepared, 'projects')) {
      const payload: CommandPayload<typeof projectCommand> = prepared.payload;

      assert.strictEqual(payload.projectId, 'project-id');
    } else {
      assert.fail('Expected a known command');
    }
  });

  test('runs prepared commands with parsed input and runtime context', async () => {
    const options = {
      name: {
        type: 'string',
        required: true
      }
    } as const;
    let handled = false;
    const command = defineCommand({
      path: ['users'],
      options,
      allowExtraPositionals: true,
      prepare(input: PreparedCommandInput<typeof options>) {
        assert.strictEqual(input.options.name, 'Alice');
        assert.strictEqual(input.provided.name, true);
        assert.deepStrictEqual(input.positionals, ['extra']);
      },
      handle({ options: parsedOptions, provided, positionals, context }: {
        options: { name: string };
        provided: { name: boolean };
        positionals: string[];
        context: { accountId: string };
      }) {
        handled = true;

        return [
          context.accountId,
          parsedOptions.name,
          String(provided.name),
          positionals.join(',')
        ].join(':');
      }
    });
    const commandRegistry = defineCommandRegistry([
      command
    ] as const);

    const prepared = await prepareCommandFromArgs(commandRegistry, [
      'users',
      '--name',
      'Alice',
      'extra'
    ]);

    assert.strictEqual(handled, false);
    assert.strictEqual(
      await runPreparedCommand(prepared, {
        accountId: 'account-id'
      }),
      'account-id:Alice:true:extra'
    );
    assert.strictEqual(handled, true);
  });

  test('keeps unknown short options as positionals when extra positionals are allowed', async () => {
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {},
        allowExtraPositionals: true,
        handle({ positionals }) {
          return positionals.join(',');
        }
      })
    ] as const);

    const prepared = await prepareCommandFromArgs(commandRegistry, [
      'users',
      '-x'
    ]);

    assert.deepStrictEqual(prepared.positionals, ['-x']);
    assert.strictEqual(await runPreparedCommand(prepared, undefined), '-x');
  });

  test('runs prepared commands from registries with mixed context types', async () => {
    const accountCommand = defineCommand({
      path: ['accounts'],
      options: {},
      handle({ context }: {
        context: { accountId: string };
      }) {
        return `account:${context.accountId}`;
      }
    });
    const projectCommand = defineCommand({
      path: ['projects'],
      options: {},
      handle({ context }: {
        context: { projectId: string };
      }) {
        return `project:${context.projectId}`;
      }
    });
    const commandRegistry = defineCommandRegistry([
      accountCommand,
      projectCommand
    ] as const);

    const prepared = await prepareCommandFromArgs(commandRegistry, ['accounts']);

    assert.strictEqual(prepared.command, accountCommand);

    if (prepared.name === 'accounts') {
      assert.strictEqual(
        await runPreparedCommand(prepared, {
          accountId: 'account-id'
        }),
        'account:account-id'
      );
    } else {
      assert.fail('Expected accounts command');
    }
  });

  test('runCommand calls prepare hooks before handlers', async () => {
    const calls: string[] = [];
    const command = defineCommand({
      path: ['users'],
      options: {},
      prepare() {
        calls.push('prepare');
      },
      handle({ context }: {
        context: { accountId: string };
      }) {
        calls.push('handle');

        return context.accountId;
      }
    });

    assert.strictEqual(
      await runCommand(command, ['users'], {
        accountId: 'account-id'
      }),
      'account-id'
    );
    assert.deepStrictEqual(calls, [
      'prepare',
      'handle'
    ]);
  });

  test('runCommand and runCommandFromRegistry pass prepare payload to handlers', async () => {
    const command = defineCommand({
      path: ['users'],
      options: {},
      prepare() {
        return {
          value: 'prepared'
        };
      },
      handle({ payload }) {
        return payload.value;
      }
    });
    const commandRegistry = defineCommandRegistry([
      command
    ] as const);

    assert.strictEqual(
      await runCommand(command, ['users'], undefined),
      'prepared'
    );
    assert.strictEqual(
      await runCommandFromRegistry(commandRegistry, ['users'], undefined),
      'prepared'
    );
  });

  test('runCommandFromRegistry calls prepare hooks before handlers', async () => {
    const calls: string[] = [];
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {},
        prepare() {
          calls.push('prepare');
        },
        handle({ context }: {
          context: { accountId: string };
        }) {
          calls.push('handle');

          return context.accountId;
        }
      })
    ] as const);

    assert.strictEqual(
      await runCommandFromRegistry(commandRegistry, ['users'], {
        accountId: 'account-id'
      }),
      'account-id'
    );
    assert.deepStrictEqual(calls, [
      'prepare',
      'handle'
    ]);
  });

  test('runCommandFromRegistry passes strict mode to prepare', async () => {
    let handled = false;
    const commandRegistry = defineCommandRegistry([
      defineCommand({
        path: ['users'],
        options: {},
        handle() {
          handled = true;
          return 'ok';
        }
      })
    ] as const);

    await assert.rejects(
      () => runCommandFromRegistry(commandRegistry, ['--unknown', 'users'], undefined, {
        strict: true
      }),
      /Unexpected argument '--unknown'/
    );
    assert.strictEqual(handled, false);
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

  test('keeps legacy before-command option handling by default', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {},
      handle() {
        return 'ok';
      }
    });

    await assert.rejects(
      () => runCommand(command, ['--unknown', 'users', 'get-accounts'], undefined),
      /Expected command 'users get-accounts'/
    );
  });

  test('throws machine-readable command path mismatch errors', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {},
      handle() {
        return 'ok';
      }
    });

    await assert.rejects(
      () => runCommand(command, ['users', 'unknown'], undefined),
      (error) => {
        assert.ok(error instanceof IcoreError);
        assert.strictEqual(error.code, 'UNKNOWN_COMMAND');
        assert.strictEqual(error.message, "Expected command 'users get-accounts'");
        assert.deepStrictEqual(error.details, {
          reason: 'path-mismatch',
          command: 'users get-accounts',
          path: ['users', 'get-accounts'],
          positionals: ['users', 'unknown']
        });

        return true;
      }
    );
  });

  test('rejects options before command path in strict mode', async () => {
    let handled = false;
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {
        verbose: {
          type: 'boolean'
        }
      },
      handle() {
        handled = true;
        return 'ok';
      }
    });

    for (const args of [
      ['--unknown', 'users', 'get-accounts'],
      ['--verbose', 'users', 'get-accounts'],
      ['-x', 'users', 'get-accounts']
    ]) {
      await assert.rejects(
        () => runCommand(command, args, undefined, {
          strict: true
        }),
        (error) => {
          assert.ok(error instanceof IcoreError);
          assert.strictEqual(error.code, 'UNEXPECTED_ARGUMENT');
          assert.strictEqual(error.message, `Unexpected argument '${args[0] ?? ''}'`);
          assert.deepStrictEqual(error.details, {
            reason: 'option-before-command',
            argument: args[0]
          });

          return true;
        }
      );
    }

    assert.strictEqual(handled, false);
  });

  test('accepts options after command path in strict mode', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {
        format: {
          type: 'string',
          choices: ['json', 'table'],
          default: 'table'
        }
      },
      handle({ options }) {
        return options.format;
      }
    });

    assert.strictEqual(
      await runCommand(
        command,
        ['users', 'get-accounts', '--format', 'json'],
        undefined,
        {
          strict: true
        }
      ),
      'json'
    );
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

  test('rejects explicit and negated values for flag-only boolean options', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {
        cache: {
          type: 'boolean',
          default: false,
          syntax: 'flag'
        }
      },
      handle({ options }) {
        return String(options.cache);
      }
    });

    assert.strictEqual(
      await runCommand(command, ['users', 'get-accounts', '--cache'], undefined),
      'true'
    );

    for (const arg of [
      '--cache=true',
      '--cache=false',
      '--no-cache'
    ]) {
      await assert.rejects(
        () => runCommand(command, ['users', 'get-accounts', arg], undefined),
        /Expected '--cache' as boolean flag/
      );
    }
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

  test('throws machine-readable unexpected positional errors', async () => {
    const command = defineCommand({
      path: ['users', 'get-accounts'],
      options: {},
      handle() {
        return 'ok';
      }
    });

    await assert.rejects(
      () => runCommand(command, ['users', 'get-accounts', 'extra'], undefined),
      (error) => {
        assert.ok(error instanceof IcoreError);
        assert.strictEqual(error.code, 'UNEXPECTED_POSITIONAL');
        assert.strictEqual(
          error.message,
          "Unexpected positional argument for 'users get-accounts': extra"
        );
        assert.deepStrictEqual(error.details, {
          command: 'users get-accounts',
          positional: 'extra',
          positionals: ['extra']
        });

        return true;
      }
    );
  });
});
