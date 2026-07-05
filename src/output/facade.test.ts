import assert from 'node:assert';
import { describe, test } from 'node:test';
import { createOutput } from '../cli';

describe('createOutput', () => {
  test('creates semantic output methods and writer channels', async () => {
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

    await output.write('ok\n');
    await output.error('warning\n');
    await output.stdout.write('raw stdout\n');
    await output.stderr.write('raw stderr\n');

    assert.deepStrictEqual(stdout, ['ok\n', 'raw stdout\n']);
    assert.deepStrictEqual(stderr, ['warning\n', 'raw stderr\n']);
  });
});
