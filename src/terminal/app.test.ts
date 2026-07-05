import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  createCommand,
  createCommands,
  createOutput,
  createPresentation,
  createTerminalApp,
  defineCommand,
  presentationFormatOptions
} from '../index';

function createMemoryOutput() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const output = createOutput({
    stdout: {
      write(chunk) {
        stdout.push(chunk);

        return true;
      }
    },
    stderr: {
      write(chunk) {
        stderr.push(chunk);

        return true;
      }
    }
  });

  return {
    output,
    read() {
      return {
        stdout: stdout.join(''),
        stderr: stderr.join('')
      };
    }
  };
}

describe('createTerminalApp', () => {
  test('accepts commands with void and prepared payloads', async () => {
    const memory = createMemoryOutput();
    const presentation = createPresentation();
    const command = createCommand();
    const versionCommand = command.define({
      path: ['version'],
      options: {},
      handle() {
        return 'ok\n';
      }
    });
    const greetCommand = command.define({
      path: ['greet'],
      options: {
        name: {
          type: 'string',
          required: true
        }
      } as const,
      prepare({ options }) {
        return {
          normalizedName: options.name.trim()
        };
      },
      handle({ payload }) {
        return presentation.record({
          name: payload.normalizedName
        });
      }
    });
    const commands = command.registry([
      versionCommand,
      greetCommand
    ] as const);
    const app = createTerminalApp({
      commands,
      presentation,
      output: memory.output
    });

    assert.equal(await app.run(['version'], undefined), 0);
    assert.equal(await app.run([
      'greet',
      '--name',
      ' Alice '
    ], undefined), 0);

    assert.equal(memory.read().stdout, 'ok\nfield  value\nname   Alice\n');
    assert.equal(memory.read().stderr, '');
  });

  test('runs commands and renders presentation results to stdout', async () => {
    const memory = createMemoryOutput();
    const presentation = createPresentation();
    const commands = createCommands([
      defineCommand({
        path: ['users', 'get-accounts'],
        options: presentationFormatOptions,
        handle() {
          return presentation.records([
            {
              id: 'account-1',
              active: true
            }
          ]);
        }
      })
    ] as const);
    const app = createTerminalApp({
      commands,
      presentation,
      output: memory.output
    });

    const exitCode = await app.run([
      'users',
      'get-accounts',
      '--format=json'
    ], undefined);

    assert.equal(exitCode, 0);
    assert.equal(JSON.parse(memory.read().stdout)[0].id, 'account-1');
    assert.equal(memory.read().stderr, '');
  });

  test('runs prepared commands through terminal rendering and output', async () => {
    const memory = createMemoryOutput();
    const presentation = createPresentation();
    const command = createCommand();
    const commands = command.registry([
      command.define({
        path: ['users', 'current'],
        options: presentationFormatOptions,
        handle({ context }: {
          context: {
            currentUser: string;
          };
        }) {
          return presentation.record({
            user: context.currentUser
          });
        }
      })
    ] as const);
    const app = createTerminalApp({
      commands,
      presentation,
      output: memory.output
    });
    const prepared = await app.prepare([
      'users',
      'current',
      '--format',
      'json'
    ], {
      strict: true
    });

    const exitCode = await app.runPrepared(prepared, {
      currentUser: 'Alice'
    });

    assert.equal(exitCode, 0);
    assert.deepEqual(JSON.parse(memory.read().stdout), {
      user: 'Alice'
    });
    assert.equal(memory.read().stderr, '');
  });

  test('writes prepared command errors to stderr and returns a non-zero exit code', async () => {
    const memory = createMemoryOutput();
    const command = createCommand();
    const commands = command.registry([
      command.define({
        path: ['fail'],
        options: {},
        handle() {
          throw new Error('prepared command failed');
        }
      })
    ] as const);
    const app = createTerminalApp({
      commands,
      output: memory.output
    });
    const prepared = await app.prepare(['fail']);

    const exitCode = await app.runPrepared(prepared, undefined);

    assert.equal(exitCode, 1);
    assert.equal(memory.read().stdout, '');
    assert.equal(memory.read().stderr, 'prepared command failed\n');
  });

  test('writes prepared output without running the command handler', async () => {
    const memory = createMemoryOutput();
    const presentation = createPresentation();
    const command = createCommand();
    let handled = false;
    const commands = command.registry([
      command.define({
        path: ['users', 'current'],
        options: presentationFormatOptions,
        handle() {
          handled = true;

          return presentation.record({
            user: 'Handler'
          });
        }
      })
    ] as const);
    const app = createTerminalApp({
      commands,
      presentation,
      output: memory.output
    });
    const prepared = await app.prepare([
      'users',
      'current',
      '--format',
      'json'
    ]);

    await app.writePreparedOutput(prepared, presentation.record({
      user: 'Alice'
    }));

    assert.equal(handled, false);
    assert.deepEqual(JSON.parse(memory.read().stdout), {
      user: 'Alice'
    });
    assert.equal(memory.read().stderr, '');
  });

  test('writes prepared string output exactly as provided', async () => {
    const memory = createMemoryOutput();
    const commands = createCommands([
      defineCommand({
        path: ['status'],
        options: {},
        handle() {
          return 'handler output\n';
        }
      })
    ] as const);
    const app = createTerminalApp({
      commands,
      output: memory.output
    });
    const prepared = await app.prepare(['status']);

    await app.writePreparedOutput(prepared, 'ok');

    assert.equal(memory.read().stdout, 'ok');
    assert.equal(memory.read().stderr, '');
  });

  test('allows custom lifecycle results before writing terminal output', async () => {
    type ShutdownHandle = {
      close(): void;
    };

    function isShutdownHandle(value: unknown): value is ShutdownHandle {
      return (
        typeof value === 'object'
        && value !== null
        && 'close' in value
      );
    }

    const memory = createMemoryOutput();
    const command = createCommand();
    const commands = command.registry([
      command.define({
        path: ['serve'],
        options: {},
        handle(): ShutdownHandle {
          return {
            close() {}
          };
        }
      }),
      command.define({
        path: ['status'],
        options: {},
        handle() {
          return 'ready\n';
        }
      })
    ] as const);
    const app = createTerminalApp({
      commands,
      output: memory.output
    });
    const preparedServer = await app.prepare(['serve']);
    const serverResult = await app.commands.run(preparedServer, undefined);

    assert.equal(isShutdownHandle(serverResult), true);
    assert.equal(memory.read().stdout, '');

    const preparedStatus = await app.prepare(['status']);
    const statusResult = await app.commands.run(preparedStatus, undefined);

    if (isShutdownHandle(statusResult)) {
      assert.fail('status command returned a shutdown handle');
    }

    await app.writePreparedOutput(preparedStatus, statusResult);

    assert.equal(memory.read().stdout, 'ready\n');
    assert.equal(memory.read().stderr, '');
  });

  test('writes string and async iterable command output to stdout', async () => {
    const memory = createMemoryOutput();
    const commands = createCommands([
      defineCommand({
        path: ['status'],
        options: {},
        handle() {
          return 'ok\n';
        }
      }),
      defineCommand({
        path: ['stream'],
        options: {},
        handle() {
          return (async function* streamOutput() {
            yield 'one\n';
            yield 'two\n';
          })();
        }
      })
    ] as const);
    const app = createTerminalApp({
      commands,
      output: memory.output
    });

    assert.equal(await app.run(['status'], undefined), 0);
    assert.equal(await app.run(['stream'], undefined), 0);
    assert.equal(memory.read().stdout, 'ok\none\ntwo\n');
    assert.equal(memory.read().stderr, '');
  });

  test('writes command errors to stderr and returns a non-zero exit code', async () => {
    const memory = createMemoryOutput();
    const commands = createCommands([
      defineCommand({
        path: ['fail'],
        options: {},
        handle() {
          throw new Error('command failed');
        }
      })
    ] as const);
    const app = createTerminalApp({
      commands,
      output: memory.output
    });

    const exitCode = await app.run(['fail'], undefined);

    assert.equal(exitCode, 1);
    assert.equal(memory.read().stdout, '');
    assert.equal(memory.read().stderr, 'command failed\n');
  });
});
