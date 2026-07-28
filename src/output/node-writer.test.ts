import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  createStderrWriter,
  createStdoutWriter
} from './node-writer';

describe('createStdoutWriter', () => {
  test('adapts stdout-compatible sinks', async () => {
    const chunks: string[] = [];
    const writer = createStdoutWriter({
      write(chunk) {
        chunks.push(chunk);

        return true;
      }
    });

    await writer.write('stdout');

    assert.deepStrictEqual(chunks, ['stdout']);
  });
});

describe('createStderrWriter', () => {
  test('adapts stderr-compatible sinks', async () => {
    const chunks: string[] = [];
    const writer = createStderrWriter({
      write(chunk) {
        chunks.push(chunk);

        return true;
      }
    });

    await writer.write('stderr');

    assert.deepStrictEqual(chunks, ['stderr']);
  });
});
