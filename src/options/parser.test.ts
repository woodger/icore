import assert from 'node:assert';
import { describe, test } from 'node:test';
import { IcoreError } from '../errors/icore-error';
import {
  parseOptions,
  parseOptionsDetailed,
  parseOptionsSubsetDetailed,
  type ParseOptionsSubsetResult
} from './parser';
import type {
  InferOptions,
  InferProvidedOptions
} from './schema';

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

  test('throws machine-readable errors for unknown options', () => {
    assert.throws(
      () => parseOptions({}, {
        unknown: 'value'
      }),
      (error) => {
        assert.ok(error instanceof IcoreError);
        assert.strictEqual(error.code, 'UNEXPECTED_ARGUMENT');
        assert.strictEqual(error.message, "Unexpected argument '--unknown'");
        assert.deepStrictEqual(error.details, {
          reason: 'unknown-option',
          argument: '--unknown',
          option: 'unknown'
        });

        return true;
      }
    );
  });

  test('throws machine-readable errors for missing required options', () => {
    assert.throws(
      () => parseOptions({
        token: {
          type: 'string',
          required: true
        }
      }, {}),
      (error) => {
        assert.ok(error instanceof IcoreError);
        assert.strictEqual(error.code, 'EXPECTED_REQUIRED_ARGUMENT');
        assert.strictEqual(error.message, "Expected required argument '--token'");
        assert.deepStrictEqual(error.details, {
          reason: 'option',
          argument: '--token',
          option: 'token'
        });

        return true;
      }
    );
  });

  test('throws machine-readable errors for invalid option types', () => {
    assert.throws(
      () => parseOptions({
        limit: {
          type: 'number'
        }
      }, {
        limit: 'many'
      }),
      (error) => {
        assert.ok(error instanceof IcoreError);
        assert.strictEqual(error.code, 'INVALID_OPTION_TYPE');
        assert.strictEqual(error.message, "Expected '--limit' as number");
        assert.deepStrictEqual(error.details, {
          argument: '--limit',
          option: 'limit',
          expected: 'number',
          value: 'many'
        });

        return true;
      }
    );
  });

  test('throws machine-readable errors for invalid option choices', () => {
    assert.throws(
      () => parseOptions({
        format: {
          type: 'string',
          choices: ['json']
        }
      } as const, {
        format: 'xml'
      }),
      (error) => {
        assert.ok(error instanceof IcoreError);
        assert.strictEqual(error.code, 'INVALID_OPTION_CHOICE');
        assert.strictEqual(error.message, "Expected '--format' as one of: json");
        assert.deepStrictEqual(error.details, {
          argument: '--format',
          option: 'format',
          choices: ['json'],
          value: 'xml'
        });

        return true;
      }
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
      'off'
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
          expected: 'choice',
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

  test('preserves option names that match object prototype keys', () => {
    const schema = {
      ['__proto__']: {
        type: 'string'
      }
    } as const;
    const result = parseOptionsDetailed(schema, {
      ['__proto__']: 'value'
    });

    assert.deepStrictEqual(result, {
      options: {
        ['__proto__']: 'value'
      },
      provided: {
        ['__proto__']: true
      }
    });
    assert.strictEqual(Object.getPrototypeOf(result.options), Object.prototype);
    assert.strictEqual(Object.getPrototypeOf(result.provided), Object.prototype);
    assert.deepStrictEqual(parseOptionsDetailed(schema, {}), {
      options: {
        ['__proto__']: undefined
      },
      provided: {
        ['__proto__']: false
      }
    });
  });
});

describe('parseOptionsSubsetDetailed', () => {
  test('validates known options and returns untouched rest options', () => {
    const schema = {
      help: {
        type: 'boolean'
      },
      version: {
        type: 'boolean',
        default: false
      }
    } as const;

    const result: ParseOptionsSubsetResult<typeof schema> = parseOptionsSubsetDetailed(schema, {
      help: true,
      format: 'json',
      limit: '10'
    });
    const help: boolean | undefined = result.options.help;
    const version: boolean = result.options.version;

    assert.strictEqual(help, true);
    assert.strictEqual(version, false);
    assert.deepStrictEqual(result, {
      options: {
        help: true,
        version: false
      },
      provided: {
        help: true,
        version: false
      },
      rest: {
        format: 'json',
        limit: '10'
      }
    });
  });

  test('does not reject unknown options outside the subset schema', () => {
    assert.deepStrictEqual(
      parseOptionsSubsetDetailed({}, {
        format: 'json',
        verbose: true
      }),
      {
        options: {},
        provided: {},
        rest: {
          format: 'json',
          verbose: true
        }
      }
    );
  });

  test('preserves unknown option names that match object prototype keys', () => {
    const result = parseOptionsSubsetDetailed({}, {
      ['__proto__']: 'value'
    });

    assert.deepStrictEqual(result.rest, {
      ['__proto__']: 'value'
    });
    assert.strictEqual(Object.getPrototypeOf(result.rest), Object.prototype);
  });

  test('rejects invalid known subset options', () => {
    assert.throws(
      () => parseOptionsSubsetDetailed({
        help: {
          type: 'boolean'
        }
      }, {
        help: 'yes',
        format: 'json'
      }),
      /Expected '--help' as boolean flag/
    );
  });
});
