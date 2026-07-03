import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  IcoreError,
  mergeOptionsSchema,
  parseOptions,
  parseOptionsDetailed,
  type InferOptions,
  type InferProvidedOptions
} from './cli';

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

describe('parseOptions', () => {
  test('parses string choices, boolean flags and number ranges', () => {
    const schema = {
      format: {
        type: 'string',
        choices: ['json', 'table'],
        default: 'table'
      },
      insecure: {
        type: 'boolean'
      },
      limit: {
        type: 'number',
        integer: true,
        min: 1,
        max: 1000,
        required: true
      }
    } as const;

    type Options = InferOptions<typeof schema>;

    const options: Options = parseOptions(schema, {
      insecure: true,
      limit: '100'
    });

    assert.deepStrictEqual(options, {
      format: 'table',
      insecure: true,
      limit: 100
    });
  });

  test('rejects unknown options', () => {
    assert.throws(
      () => parseOptions({}, { unknown: 'value' }),
      /Unexpected argument '--unknown'/
    );
  });

  test('throws machine-readable option validation errors', () => {
    const scenarios = [
      {
        run: () => parseOptions({}, {
          unknown: 'value'
        }),
        code: 'UNEXPECTED_ARGUMENT',
        message: "Unexpected argument '--unknown'",
        details: {
          argument: '--unknown',
          option: 'unknown'
        }
      },
      {
        run: () => parseOptions({
          token: {
            type: 'string',
            required: true
          }
        }, {}),
        code: 'EXPECTED_REQUIRED_ARGUMENT',
        message: "Expected required argument '--token'",
        details: {
          argument: '--token',
          option: 'token'
        }
      },
      {
        run: () => parseOptions({
          limit: {
            type: 'number'
          }
        }, {
          limit: 'many'
        }),
        code: 'INVALID_OPTION_TYPE',
        message: "Expected '--limit' as number",
        details: {
          argument: '--limit',
          option: 'limit',
          expected: 'number',
          value: 'many'
        }
      },
      {
        run: () => parseOptions({
          format: {
            type: 'string',
            choices: ['json']
          }
        } as const, {
          format: 'xml'
        }),
        code: 'INVALID_OPTION_CHOICE',
        message: "Expected '--format' as one of: json",
        details: {
          argument: '--format',
          option: 'format',
          choices: ['json'],
          value: 'xml'
        }
      }
    ];

    for (const scenario of scenarios) {
      assert.throws(
        scenario.run,
        (error) => {
          assert.ok(error instanceof IcoreError);
          assert.strictEqual(error.code, scenario.code);
          assert.strictEqual(error.message, scenario.message);
          assert.deepStrictEqual(error.details, scenario.details);

          return true;
        }
      );
    }
  });

  test('rejects missing required options', () => {
    assert.throws(
      () => parseOptions({
        token: {
          type: 'string',
          required: true
        }
      }, {}),
      /Expected required argument '--token'/
    );
  });

  test('supports flag-only boolean options', () => {
    const schema = {
      uppercase: {
        type: 'boolean',
        default: false,
        syntax: 'flag'
      }
    } as const;

    assert.deepStrictEqual(parseOptions(schema, {}), {
      uppercase: false
    });

    assert.deepStrictEqual(parseOptions(schema, {
      uppercase: true
    }), {
      uppercase: true
    });

    for (const value of [
      'true',
      'false',
      false
    ]) {
      assert.throws(
        () => parseOptions(schema, {
          uppercase: value
        }),
        /Expected '--uppercase' as boolean flag/
      );
    }
  });

  test('rejects invalid explicit boolean values', () => {
    for (const value of [
      'true',
      'false',
      '1',
      '0',
      'yes',
      'no',
      'on',
      'off',
      ''
    ]) {
      assert.throws(
        () => parseOptions({
          insecure: {
            type: 'boolean'
          }
        }, {
          insecure: value
        }),
        /Expected '--insecure' as boolean flag/
      );
    }
  });

  test('rejects non-integer and out-of-range numbers', () => {
    const schema = {
      depth: {
        type: 'number',
        integer: true,
        min: 1
      }
    } as const;

    assert.throws(
      () => parseOptions(schema, { depth: '1.5' }),
      /Expected '--depth' as integer/
    );

    assert.throws(
      () => parseOptions(schema, { depth: '0' }),
      /Expected '--depth' to be greater than or equal to 1/
    );
  });

  test('validates default values with the same option constraints', () => {
    assert.throws(
      () => parseOptions({
        format: {
          type: 'string',
          choices: ['json', 'table'],
          default: 'xml'
        }
      } as const, {}),
      /Expected '--format' as one of: json, table/
    );

    assert.throws(
      () => parseOptions({
        limit: {
          type: 'number',
          integer: true,
          min: 1,
          default: 0
        }
      } as const, {}),
      /Expected '--limit' to be greater than or equal to 1/
    );
  });

  test('throws machine-readable invalid default errors', () => {
    const scenarios = [
      {
        run: () => parseOptions({
          name: {
            type: 'string',
            default: ''
          }
        }, {}),
        message: "Expected default for '--name' as string",
        details: {
          argument: '--name',
          option: 'name',
          expected: 'string',
          value: ''
        }
      },
      {
        run: () => parseOptions({
          format: {
            type: 'string',
            choices: ['json', 'table'],
            default: 'xml'
          }
        } as const, {}),
        message: "Expected '--format' as one of: json, table",
        details: {
          argument: '--format',
          option: 'format',
          choices: ['json', 'table'],
          value: 'xml'
        }
      },
      {
        run: () => parseOptions({
          limit: {
            type: 'number',
            integer: true,
            min: 1,
            default: 0
          }
        } as const, {}),
        message: "Expected '--limit' to be greater than or equal to 1",
        details: {
          argument: '--limit',
          option: 'limit',
          expected: 'minimum',
          min: 1,
          value: 0
        }
      }
    ];

    for (const scenario of scenarios) {
      assert.throws(
        scenario.run,
        (error) => {
          assert.ok(error instanceof IcoreError);
          assert.strictEqual(error.code, 'INVALID_OPTION_DEFAULT');
          assert.strictEqual(error.message, scenario.message);
          assert.deepStrictEqual(error.details, scenario.details);

          return true;
        }
      );
    }
  });

  test('rejects empty explicit option values', () => {
    assert.throws(
      () => parseOptions({
        name: {
          type: 'string'
        }
      }, {
        name: ''
      }),
      /Expected '--name' as string/
    );

    assert.throws(
      () => parseOptions({
        limit: {
          type: 'number'
        }
      }, {
        limit: ''
      }),
      /Expected '--limit' as number/
    );

    assert.throws(
      () => parseOptions({
        insecure: {
          type: 'boolean'
        }
      }, {
        insecure: ''
      }),
      /Expected '--insecure' as boolean flag/
    );
  });
});

describe('parseOptionsDetailed', () => {
  test('returns parsed options and user-provided metadata', () => {
    const schema = {
      token: {
        type: 'string',
        required: true
      },
      format: {
        type: 'string',
        choices: ['json', 'table'],
        default: 'table'
      },
      insecure: {
        type: 'boolean'
      }
    } as const;

    type Options = InferOptions<typeof schema>;
    type Provided = InferProvidedOptions<typeof schema>;

    const result = parseOptionsDetailed(schema, {
      token: 'secret',
      insecure: true
    });
    const options: Options = result.options;
    const provided: Provided = result.provided;

    assert.deepStrictEqual(options, {
      token: 'secret',
      format: 'table',
      insecure: true
    });
    assert.deepStrictEqual(provided, {
      token: true,
      format: false,
      insecure: true
    });
  });
});
