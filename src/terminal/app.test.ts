import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import {
  createCommand,
  createCommands,
  defineCommand,
  isPreparedCommandName,
  type PreparedCommand
} from '../command/mechanics';
import { createOutput } from '../output/facade';
import { createPresentation } from '../presentation/facade';
import { presentationFormatOptions } from '../presentation/format-options';
import {
  createTerminalApp,
  isTerminalCommandOutput,
  type TerminalCommandOutput,
  type TerminalErrorContext,
  type TerminalOutputAttempt
} from './app';

const successfulExitCode = 0;
const defaultErrorExitCode = 1;
const customErrorExitCode = 70;
const customPreparationErrorExitCode = 2;
const customWriteErrorExitCode = 74;

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

describe('isTerminalCommandOutput', () => {
  test('recognizes every supported terminal output shape', () => {
    const presentation = createPresentation();
    const stream = (async function* createStream() {
      yield 'ok\n';
    })();
    const callableStream = Object.assign(
      () => undefined,
      {
        [Symbol.asyncIterator]: async function* createCallableStream() {
          yield 'ok\n';
        }
      }
    );

    assert.equal(isTerminalCommandOutput(undefined), true);
    assert.equal(isTerminalCommandOutput('ok\n'), true);
    assert.equal(isTerminalCommandOutput(stream), true);
    assert.equal(isTerminalCommandOutput(callableStream), true);
    assert.equal(
      isTerminalCommandOutput(presentation.text('ok\n')),
      true
    );
  });

  test('narrows unknown terminal output', () => {
    const value: unknown = 'ok\n';

    assert.ok(isTerminalCommandOutput(value));

    const output: TerminalCommandOutput = value;

    assert.equal(output, 'ok\n');
  });

  test('rejects unsupported values and malformed async iterables', () => {
    assert.equal(isTerminalCommandOutput(null), false);
    assert.equal(isTerminalCommandOutput({}), false);
    assert.equal(isTerminalCommandOutput(Promise.resolve('ok\n')), false);
    assert.equal(isTerminalCommandOutput({
      [Symbol.asyncIterator]: true
    }), false);
  });
});

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

    assert.equal(await app.run(['version'], undefined), successfulExitCode);
    assert.equal(await app.run([
      'greet',
      '--name',
      ' Alice '
    ], undefined), successfulExitCode);

    assert.equal(memory.read().stdout, 'ok\nfield  value\nname   Alice\n');
    assert.equal(memory.read().stderr, '');
  });

  test('runs commands and renders presentation results to stdout', async () => {
    const memory = createMemoryOutput();
    const presentation = createPresentation();
    const commands = createCommands([
      defineCommand({
        path: ['account', 'list'],
        aliases: [
          ['users', 'get-accounts']
        ],
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

    assert.equal(exitCode, successfulExitCode);
    assert.equal(JSON.parse(memory.read().stdout)[0].id, 'account-1');
    assert.equal(memory.read().stderr, '');
  });

  test('runs prepared commands through terminal rendering and output', async () => {
    const memory = createMemoryOutput();
    const presentation = createPresentation();
    const command = createCommand();
    const commands = command.registry([
      command.define({
        path: ['account', 'current'],
        aliases: [
          ['users', 'current']
        ],
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

    assert.equal(prepared.name, 'account current');
    assert.deepEqual(prepared.path, ['account', 'current']);
    assert.deepEqual(prepared.matchedPath, ['users', 'current']);

    const exitCode = await app.runPrepared(prepared, {
      currentUser: 'Alice'
    });

    assert.equal(exitCode, successfulExitCode);
    assert.deepEqual(JSON.parse(memory.read().stdout), {
      user: 'Alice'
    });
    assert.equal(memory.read().stderr, '');
  });

  test('runs narrowed prepared commands with their own command context', async () => {
    const memory = createMemoryOutput();
    const account = defineCommand({
      path: ['accounts'],
      options: {},
      handle({ context }: { context: { accountId: string } }) {
        return `${context.accountId}\n`;
      }
    });
    const project = defineCommand({
      path: ['projects'],
      options: {},
      handle({ context }: { context: { projectId: string } }) {
        return `${context.projectId}\n`;
      }
    });
    const app = createTerminalApp({
      commands: createCommands([account, project] as const),
      output: memory.output
    });
    const prepared = await app.prepare(['accounts']);

    if (!isPreparedCommandName(prepared, 'accounts')) {
      assert.fail('Expected accounts command');
    }

    assert.equal(
      await app.runPrepared(prepared, { accountId: 'account-id' }),
      successfulExitCode
    );
    assert.equal(memory.read().stdout, 'account-id\n');
    assert.equal(memory.read().stderr, '');

    function assertContextContract(selected: PreparedCommand<typeof account>): void {
      // @ts-expect-error A narrowed account command cannot receive project context.
      void app.runPrepared(selected, { projectId: 'project-id' });
    }

    void assertContextContract;
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

    assert.equal(exitCode, defaultErrorExitCode);
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

  describe('#tryWritePreparedOutput', () => {
    test('writes supported output and returns success without running the handler', async () => {
      const memory = createMemoryOutput();
      const presentation = createPresentation();
      let handled = false;
      const app = createTerminalApp({
        commands: createCommands([
          defineCommand({
            path: ['status'],
            options: presentationFormatOptions,
            handle() {
              handled = true;
            }
          })
        ]),
        presentation,
        output: memory.output
      });
      const prepared = await app.prepare(['status', '--format', 'json']);
      const outputs: TerminalCommandOutput[] = [
        undefined,
        'plain\n',
        presentation.record({ value: 1 }),
        (async function* streamOutput() {
          yield 'stream\n';
        })()
      ];

      for (const output of outputs) {
        const attempt: TerminalOutputAttempt = await app.tryWritePreparedOutput(prepared, output);

        assert.deepEqual(attempt, { ok: true });
      }

      assert.equal(handled, false);
      assert.deepEqual(memory.read(), {
        stdout: 'plain\n{\n  "value": 1\n}\nstream\n',
        stderr: ''
      });
    });

    test(
      'captures format resolution failures and preserves legacy rejection identity',
      async () => {
        const memory = createMemoryOutput();
        const failure = new Error('format failed');

        Object.freeze(failure);

        const app = createTerminalApp({
          commands: createCommands([
            defineCommand({ path: ['status'], options: {}, handle() {} })
          ]),
          output: memory.output,
          resolveFormat() {
            throw failure;
          }
        });
        const prepared = await app.prepare(['status']);
        const attempt = await app.tryWritePreparedOutput(prepared, 'output');

        assert.ok(!attempt.ok);
        assert.equal(attempt.phase, 'render');
        assert.equal(attempt.error, failure);
        await assert.rejects(
          app.writePreparedOutput(prepared, 'output'),
          error => error === failure
        );
        assert.deepEqual(memory.read(), { stdout: '', stderr: '' });
      }
    );

    test('captures original rendering failures without invoking error policy', async () => {
      const failures: readonly unknown[] = [new Error('render failed'), 'render failed', undefined];

      for (const failure of failures) {
        const memory = createMemoryOutput();
        const presentation = createPresentation();
        const app = createTerminalApp({
          commands: createCommands([
            defineCommand({ path: ['status'], options: {}, handle() {} })
          ]),
          presentation: {
            ...presentation,
            render() {
              throw failure;
            }
          },
          output: memory.output,
          errorPolicy: {
            renderError() {
              assert.fail('Unexpected error reporting');
            },
            resolveExitCode() {
              assert.fail('Unexpected exit-code selection');
            }
          }
        });
        const prepared = await app.prepare(['status']);
        const output = presentation.record({ value: 1 });
        const attempt = await app.tryWritePreparedOutput(prepared, output);

        assert.ok(!attempt.ok);
        assert.equal(attempt.phase, 'render');
        assert.equal(attempt.error, failure);
        await assert.rejects(
          app.writePreparedOutput(prepared, output),
          error => error === failure
        );
        assert.deepEqual(memory.read(), { stdout: '', stderr: '' });
      }
    });

    test('captures rejected writes and preserves legacy rejection identity', async () => {
      const memory = createMemoryOutput();
      const failure = new Error('write failed');
      const app = createTerminalApp({
        commands: createCommands([
          defineCommand({ path: ['status'], options: {}, handle() {} })
        ]),
        output: {
          ...memory.output,
          async write() {
            throw failure;
          }
        },
        errorPolicy: {
          renderError() {
            assert.fail('Unexpected error reporting');
          },
          resolveExitCode() {
            assert.fail('Unexpected exit-code selection');
          }
        }
      });
      const prepared = await app.prepare(['status']);
      const attempt = await app.tryWritePreparedOutput(prepared, 'output');

      assert.ok(!attempt.ok);
      assert.equal(attempt.phase, 'write');
      assert.equal(attempt.error, failure);
      await assert.rejects(
        app.writePreparedOutput(prepared, 'output'),
        error => error === failure
      );
      assert.deepEqual(memory.read(), { stdout: '', stderr: '' });
    });

    test('captures stream failures after partial output and closes the producer', async () => {
      const memory = createMemoryOutput();
      const failure = new Error('stream failed');
      let closed = false;
      const app = createTerminalApp({
        commands: createCommands([
          defineCommand({ path: ['stream'], options: {}, handle() {} })
        ]),
        output: memory.output
      });
      const prepared = await app.prepare(['stream']);
      const stream = (async function* streamOutput() {
        try {
          yield 'before\n';
          throw failure;
        }
        finally {
          closed = true;
        }
      })();
      const attempt = await app.tryWritePreparedOutput(prepared, stream);

      assert.ok(!attempt.ok);
      assert.equal(attempt.phase, 'write');
      assert.equal(attempt.error, failure);
      assert.equal(closed, true);
      assert.deepEqual(memory.read(), { stdout: 'before\n', stderr: '' });
    });

    test('captures invalid stream chunks as write failures and closes the producer', async () => {
      const memory = createMemoryOutput();
      let closed = false;
      const app = createTerminalApp({
        commands: createCommands([
          defineCommand({ path: ['stream'], options: {}, handle() {} })
        ]),
        output: memory.output
      });
      const prepared = await app.prepare(['stream']);
      const stream: unknown = (async function* streamOutput() {
        try {
          yield 'before\n';
          yield undefined;
          yield 'after\n';
        }
        finally {
          closed = true;
        }
      })();

      assert.ok(isTerminalCommandOutput(stream));

      const attempt = await app.tryWritePreparedOutput(prepared, stream);

      assert.ok(!attempt.ok);
      assert.equal(attempt.phase, 'write');
      assert.ok(attempt.error instanceof TypeError);
      assert.equal(attempt.error.message, 'Expected terminal output chunk to be a string');
      assert.equal(closed, true);
      assert.deepEqual(memory.read(), { stdout: 'before\n', stderr: '' });
    });

    test('retains the render phase when reporting after failed caller-owned cleanup', async () => {
      const memory = createMemoryOutput();
      const presentation = createPresentation();
      const renderFailure = new Error('render failed');
      const cleanupFailure = new Error('cleanup failed');
      let closed = false;
      const app = createTerminalApp({
        commands: createCommands([
          defineCommand({ path: ['status'], options: {}, handle() {} })
        ]),
        presentation: {
          ...presentation,
          render() {
            throw renderFailure;
          }
        },
        output: memory.output,
        errorPolicy: {
          renderError(error, context) {
            assert.equal(closed, true);
            assert.equal(context.phase, 'render');
            assert.ok(error instanceof AggregateError);
            assert.deepEqual(error.errors, [renderFailure, cleanupFailure]);

            return 'render failed\ncleanup failed\n';
          },
          resolveExitCode(_error, context) {
            assert.equal(context.phase, 'render');

            return customErrorExitCode;
          }
        }
      });
      const prepared = await app.prepare(['status']);
      const scope = {
        async close() {
          closed = true;

          throw cleanupFailure;
        }
      };
      const attempt = await app.tryWritePreparedOutput(prepared, presentation.record({ value: 1 }));

      assert.ok(!attempt.ok);
      assert.equal(attempt.error, renderFailure);
      assert.equal(closed, false);
      assert.equal(memory.read().stderr, '');

      let failure = attempt.error;

      try {
        await scope.close();
      }
      catch (error) {
        failure = new AggregateError([failure, error]);
      }

      const exitCode = await app.reportError(failure, { phase: attempt.phase, prepared });

      assert.equal(exitCode, customErrorExitCode);
      assert.deepEqual(memory.read(), { stdout: '', stderr: 'render failed\ncleanup failed\n' });
    });
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
            close() {
              // The test only needs a recognizable lifecycle handle.
            }
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

    assert.equal(await app.run(['status'], undefined), successfulExitCode);
    assert.equal(await app.run(['stream'], undefined), successfulExitCode);
    assert.equal(memory.read().stdout, 'ok\none\ntwo\n');
    assert.equal(memory.read().stderr, '');
  });

  test('rejects malformed async iterables during rendering', async () => {
    const memory = createMemoryOutput();
    let phase: string | undefined;
    const commands = createCommands([
      defineCommand({
        path: ['invalid'],
        options: {},
        handle() {
          return {
            [Symbol.asyncIterator]: true
          };
        }
      })
    ] as const);
    const app = createTerminalApp({
      commands,
      output: memory.output,
      errorPolicy: {
        renderError(error, context) {
          assert.ok(error instanceof Error);
          phase = context.phase;

          return `${error.message}\n`;
        }
      }
    });

    const exitCode = await app.run(['invalid'], undefined);

    assert.equal(exitCode, defaultErrorExitCode);
    assert.equal(phase, 'render');
    assert.equal(memory.read().stdout, '');
    assert.equal(
      memory.read().stderr,
      'Expected terminal command output\n'
    );
  });

  test('rejects non-string stream chunks during writing and closes the producer', async () => {
    for (const invalidChunk of [123, undefined, null, false, {}]) {
      const memory = createMemoryOutput();
      let closed = false;
      let phase: string | undefined;
      const commands = createCommands([
        defineCommand({
          path: ['stream'],
          options: {},
          handle() {
            return (async function* streamOutput() {
              try {
                yield 'before\n';
                yield invalidChunk;
                yield 'after\n';
              }
              finally {
                closed = true;
              }
            })();
          }
        })
      ] as const);
      const app = createTerminalApp({
        commands,
        output: memory.output,
        errorPolicy: {
          renderError(error, context) {
            assert.ok(error instanceof TypeError);
            phase = context.phase;

            return `${error.message}\n`;
          }
        }
      });

      assert.equal(await app.run(['stream'], undefined), defaultErrorExitCode);
      assert.equal(phase, 'write');
      assert.equal(memory.read().stdout, 'before\n');
      assert.equal(memory.read().stderr, 'Expected terminal output chunk to be a string\n');
      assert.equal(closed, true);
    }
  });

  test('rejects non-string chunks when writing caller-obtained output', async () => {
    const memory = createMemoryOutput();
    const app = createTerminalApp({
      commands: createCommands([
        defineCommand({ path: ['stream'], options: {}, handle() {} })
      ] as const),
      output: memory.output
    });
    const prepared = await app.prepare(['stream']);
    const result: unknown = (async function* streamOutput() {
      yield undefined;
    })();

    assert.ok(isTerminalCommandOutput(result));
    await assert.rejects(
      app.writePreparedOutput(prepared, result),
      /Expected terminal output chunk to be a string/
    );
    assert.deepEqual(memory.read(), { stdout: '', stderr: '' });
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

    assert.equal(exitCode, defaultErrorExitCode);
    assert.equal(memory.read().stdout, '');
    assert.equal(memory.read().stderr, 'command failed\n');
  });

  test('reports bootstrap errors without registered commands', async () => {
    const memory = createMemoryOutput();
    const commands = createCommands([] as const);
    const app = createTerminalApp({
      commands,
      output: memory.output
    });

    assert.equal(await app.reportError(new Error('failed')), defaultErrorExitCode);
    assert.equal(await app.reportError('unknown failure'), defaultErrorExitCode);
    assert.equal(memory.read().stdout, '');
    assert.equal(memory.read().stderr, 'failed\nunknown failure\n');
  });

  test('reports typed command errors without registered commands', async () => {
    const memory = createMemoryOutput();
    const status = defineCommand({
      path: ['status'],
      options: {},
      handle() {}
    });
    const commands = createCommands([status]);
    const prepared = await commands.prepare(['status']);
    const args = ['status'];
    const failure = new Error('failed');
    const contexts: TerminalErrorContext<PreparedCommand<typeof status>>[] = [
      { phase: 'prepare', args },
      { phase: 'execute', prepared, args },
      { phase: 'render', prepared },
      { phase: 'write', prepared },
      { phase: 'external', prepared, args },
      { phase: 'external', args }
    ];
    const renderedContexts: TerminalErrorContext<unknown>[] = [];
    const resolvedContexts: TerminalErrorContext<unknown>[] = [];
    const app = createTerminalApp({
      commands: createCommands([]),
      output: memory.output,
      errorPolicy: {
        renderError(error, context) {
          assert.equal(error, failure);

          if ('prepared' in context) {
            const callerPrepared: typeof context.prepared = prepared;

            assert.equal(context.prepared, callerPrepared);
          }

          renderedContexts.push(context);

          return 'failed\n';
        },
        resolveExitCode(error, context) {
          assert.equal(error, failure);

          if ('prepared' in context) {
            const callerPrepared: typeof context.prepared = prepared;

            assert.equal(context.prepared, callerPrepared);
          }

          resolvedContexts.push(context);

          return customErrorExitCode;
        }
      }
    });

    for (const context of contexts) {
      assert.equal(await app.reportError(failure, context), customErrorExitCode);
    }

    assert.deepEqual(renderedContexts, contexts);
    assert.deepEqual(resolvedContexts, contexts);
    assert.equal(memory.read().stdout, '');
    assert.equal(memory.read().stderr, 'failed\n'.repeat(contexts.length));

    function assertContextContract(context: TerminalErrorContext<unknown>): void {
      void app.reportError(failure, context);

      const registeredApp = createTerminalApp({ commands });

      // @ts-expect-error A registered app requires its own prepared command type.
      void registeredApp.reportError(failure, context);
      // @ts-expect-error An empty registry cannot execute a prepared command.
      void app.runPrepared(prepared, undefined);
      // @ts-expect-error An empty registry cannot write prepared command output.
      void app.writePreparedOutput(prepared, undefined);
      // @ts-expect-error Capturing output failures still requires a registered command.
      void app.tryWritePreparedOutput(prepared, undefined);
      // @ts-expect-error Capturing failures still requires supported terminal output.
      void registeredApp.tryWritePreparedOutput(prepared, { unsupported: true });
      // @ts-expect-error Command error phases still require prepared data.
      void app.reportError(failure, { phase: 'write' });

      const preparation: Promise<never> = app.prepare(args);

      void preparation;
    }

    void assertContextContract;
  });

  test('uses the external phase when report context is omitted', async () => {
    const memory = createMemoryOutput();
    const commands = createCommands([
      defineCommand({
        path: ['status'],
        options: {},
        handle() {
          return undefined;
        }
      })
    ] as const);
    const app = createTerminalApp({
      commands,
      output: memory.output,
      errorPolicy: {
        renderError(error, context) {
          assert.equal(error, 'failed');
          assert.deepEqual(context, {
            phase: 'external'
          });

          return 'external failure';
        },
        resolveExitCode(error, context) {
          assert.equal(error, 'failed');
          assert.equal(context.phase, 'external');

          return customErrorExitCode;
        }
      }
    });

    const exitCode = await app.reportError('failed');

    assert.equal(exitCode, customErrorExitCode);
    assert.equal(memory.read().stderr, 'external failure');
  });

  test('uses error policy for prepare failures', async () => {
    const memory = createMemoryOutput();
    const command = createCommand();
    let handled = false;
    const commands = command.registry([
      command.define({
        path: ['greet'],
        options: {
          name: {
            type: 'string',
            required: true
          }
        } as const,
        handle() {
          handled = true;
        }
      })
    ] as const);
    const phases: string[] = [];
    const app = createTerminalApp({
      commands,
      output: memory.output,
      errorPolicy: {
        renderError(error, context) {
          assert.ok(error instanceof Error);
          assert.equal(context.phase, 'prepare');

          if (context.phase === 'prepare') {
            assert.deepEqual(context.args, ['greet']);
          }

          phases.push(`render:${context.phase}`);

          return 'invalid input\n';
        },
        resolveExitCode(error, context) {
          assert.ok(error instanceof Error);
          phases.push(`exit:${context.phase}`);

          return customPreparationErrorExitCode;
        }
      }
    });

    const exitCode = await app.run(['greet'], undefined);

    assert.equal(exitCode, customPreparationErrorExitCode);
    assert.equal(handled, false);
    assert.deepEqual(phases, [
      'render:prepare',
      'exit:prepare'
    ]);
    assert.equal(memory.read().stderr, 'invalid input\n');
  });

  test('uses error policy for execute failures', async () => {
    const memory = createMemoryOutput();
    const commands = createCommands([
      defineCommand({
        path: ['fail'],
        options: {},
        handle() {
          throw new Error('execution failed');
        }
      })
    ] as const);
    const phases: string[] = [];
    const app = createTerminalApp({
      commands,
      output: memory.output,
      errorPolicy: {
        renderError(error, context) {
          assert.ok(error instanceof Error);
          assert.equal(error.message, 'execution failed');
          assert.equal(context.phase, 'execute');

          if (context.phase === 'execute') {
            assert.equal(context.prepared.name, 'fail');
            assert.deepEqual(context.args, ['fail']);
          }

          phases.push(context.phase);

          return 'execution error\n';
        },
        resolveExitCode(error, context) {
          assert.ok(error instanceof Error);
          phases.push(context.phase);

          return customErrorExitCode;
        }
      }
    });

    const exitCode = await app.run(['fail'], undefined);

    assert.equal(exitCode, customErrorExitCode);
    assert.deepEqual(phases, ['execute', 'execute']);
    assert.equal(memory.read().stderr, 'execution error\n');
  });

  test('uses error policy for render failures', async () => {
    const memory = createMemoryOutput();
    const presentation = createPresentation();
    const commands = createCommands([
      defineCommand({
        path: ['users'],
        options: {},
        handle() {
          return presentation.record({
            id: 'user-1'
          });
        }
      })
    ] as const);
    const phases: string[] = [];
    const app = createTerminalApp({
      commands,
      presentation: {
        ...presentation,
        render() {
          throw new Error('render failed');
        }
      },
      output: memory.output,
      errorPolicy: {
        renderError(error, context) {
          assert.ok(error instanceof Error);
          assert.equal(error.message, 'render failed');
          phases.push(context.phase);

          return 'render error\n';
        },
        resolveExitCode(error, context) {
          assert.ok(error instanceof Error);
          phases.push(context.phase);

          return customErrorExitCode;
        }
      }
    });

    const exitCode = await app.run(['users'], undefined);

    assert.equal(exitCode, customErrorExitCode);
    assert.deepEqual(phases, ['render', 'render']);
    assert.equal(memory.read().stdout, '');
    assert.equal(memory.read().stderr, 'render error\n');
  });

  test('uses error policy for write failures', async () => {
    const stderr: string[] = [];
    const output = createOutput({
      stdout: {
        write() {
          throw new Error('write failed');
        }
      },
      stderr: {
        write(chunk) {
          stderr.push(chunk);

          return true;
        }
      }
    });
    const commands = createCommands([
      defineCommand({
        path: ['status'],
        options: {},
        handle() {
          return 'ok\n';
        }
      })
    ] as const);
    const phases: string[] = [];
    const app = createTerminalApp({
      commands,
      output,
      errorPolicy: {
        renderError(error, context) {
          assert.ok(error instanceof Error);
          assert.equal(error.message, 'write failed');
          phases.push(context.phase);

          return 'output error\n';
        },
        resolveExitCode(error, context) {
          assert.ok(error instanceof Error);
          phases.push(context.phase);

          return customWriteErrorExitCode;
        }
      }
    });

    const exitCode = await app.run(['status'], undefined);

    assert.equal(exitCode, customWriteErrorExitCode);
    assert.deepEqual(phases, ['write', 'write']);
    assert.equal(stderr.join(''), 'output error\n');
  });

  test('uses the write phase for streaming output failures', async () => {
    const memory = createMemoryOutput();
    const commands = createCommands([
      defineCommand({
        path: ['stream'],
        options: {},
        handle() {
          return (async function* streamOutput() {
            yield 'first\n';
            throw new Error('stream failed');
          })();
        }
      })
    ] as const);
    const phases: string[] = [];
    const app = createTerminalApp({
      commands,
      output: memory.output,
      errorPolicy: {
        renderError(error, context) {
          assert.ok(error instanceof Error);
          assert.equal(error.message, 'stream failed');
          phases.push(context.phase);

          return 'stream error\n';
        },
        resolveExitCode(error, context) {
          assert.ok(error instanceof Error);
          phases.push(context.phase);

          return customWriteErrorExitCode;
        }
      }
    });

    const exitCode = await app.run(['stream'], undefined);

    assert.equal(exitCode, customWriteErrorExitCode);
    assert.deepEqual(phases, ['write', 'write']);
    assert.equal(memory.read().stdout, 'first\n');
    assert.equal(memory.read().stderr, 'stream error\n');
  });

  test('reports externally handled output failures with caller context', async () => {
    const events: string[] = [];
    const output = createOutput({
      stdout: {
        write() {
          throw new Error('external write failed');
        }
      },
      stderr: {
        write(chunk) {
          events.push(`write:${chunk}`);

          return true;
        }
      }
    });
    const commands = createCommands([
      defineCommand({
        path: ['status'],
        options: {},
        handle() {
          return undefined;
        }
      })
    ] as const);
    const app = createTerminalApp({
      commands,
      output,
      errorPolicy: {
        renderError(error, context) {
          assert.ok(error instanceof Error);
          assert.equal(error.message, 'external write failed');
          assert.equal(context.phase, 'write');

          if (context.phase === 'write') {
            assert.equal(context.prepared.name, 'status');
            assert.equal(context.args, undefined);
          }

          events.push(`render:${context.phase}`);

          return 'external output error';
        },
        resolveExitCode(error, context) {
          assert.ok(error instanceof Error);
          events.push(`exit:${context.phase}`);

          return customWriteErrorExitCode;
        }
      }
    });
    const prepared = await app.prepare(['status']);
    let exitCode: number | undefined;

    try {
      await app.writePreparedOutput(prepared, 'output');
      assert.fail('expected output writing to fail');
    }
    catch (error) {
      exitCode = await app.reportError(error, {
        phase: 'write',
        prepared
      });
    }

    assert.equal(exitCode, customWriteErrorExitCode);
    assert.deepEqual(events, [
      'render:write',
      'write:external output error',
      'exit:write'
    ]);
  });
});
