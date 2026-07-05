import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  createCommands,
  createOutput,
  createPresentation,
  createTerminalApp,
  defineCommand,
  presentationFormatOptions
} from '../cli';

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
