import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  mergeOptionsSchema,
  parseOptions,
  type InferOptions
} from '../index';

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
