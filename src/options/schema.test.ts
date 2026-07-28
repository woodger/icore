import assert from 'node:assert';
import { describe, test } from 'node:test';
import { parseOptions } from './parser';
import {
  mergeOptionsSchema,
  type InferOptions
} from './schema';

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

  test('preserves option names that match object prototype keys', () => {
    const schema = mergeOptionsSchema({}, {
      ['__proto__']: {
        type: 'string',
        required: true
      }
    } as const);

    assert.deepStrictEqual(parseOptions(schema, {
      ['__proto__']: 'value'
    }), {
      ['__proto__']: 'value'
    });
    assert.strictEqual(Object.getPrototypeOf(schema), Object.prototype);
  });
});
