/**
 * The option parser module validates raw option values against declarative
 * primitive option contracts.
 *
 * Allowed here:
 * - applying and validating default values;
 * - producing typed option values and user-provided metadata;
 *
 * This file must not contain argv tokenization, command resolution, or
 * application-specific validation rules.
 */

import {
  IcoreError,
  type IcoreErrorDetails
} from '../errors/icore-error';
import type {
  BooleanOption,
  InferOptions,
  InferProvidedOptions,
  NumberOption,
  OptionDefinition,
  OptionsSchema,
  RawOptionValue,
  StringOption
} from './schema';

type OptionValueSource = 'value' | 'default';

/**
 * Detailed option parsing result with values and user-provided metadata.
 */
export type ParseOptionsResult<TSchema extends OptionsSchema> = {
  options: InferOptions<TSchema>;
  provided: InferProvidedOptions<TSchema>;
};

/**
 * Detailed option subset parsing result with untouched options for later
 * command-layer validation.
 */
export type ParseOptionsSubsetResult<TSchema extends OptionsSchema> =
  ParseOptionsResult<TSchema> & {
    rest: Record<string, RawOptionValue>;
  };

/**
 * Validates raw option values against a declarative option schema.
 */
export function parseOptions<const TSchema extends OptionsSchema>(
  schema: TSchema,
  values: Record<string, RawOptionValue>
): InferOptions<TSchema> {
  return parseOptionsDetailed(schema, values).options;
}

/**
 * Validates raw option values and returns parsed values with user-provided
 * metadata.
 */
export function parseOptionsDetailed<const TSchema extends OptionsSchema>(
  schema: TSchema,
  values: Record<string, RawOptionValue>
): ParseOptionsResult<TSchema> {
  const parsed: Partial<Record<keyof TSchema, unknown>> = {};
  const provided: Partial<Record<keyof TSchema, boolean>> = {};

  for (const name of Object.keys(values)) {
    if (!Object.hasOwn(schema, name)) {
      throw createUnexpectedArgumentError(name);
    }
  }

  for (const name of Object.keys(schema) as (keyof TSchema)[]) {
    const definition = schema[name];
    const value = values[String(name)];

    if (definition === undefined) {
      continue;
    }

    provided[name] = value !== undefined;

    if (value === undefined) {
      if ('default' in definition) {
        parsed[name] = parseDefaultOptionValue(String(name), definition);
        continue;
      }

      if (definition.required === true) {
        throw createExpectedRequiredArgumentError(String(name));
      }

      parsed[name] = undefined;
      continue;
    }

    parsed[name] = parseOptionValue(String(name), definition, value);
  }

  return {
    options: parsed as InferOptions<TSchema>,
    provided: provided as InferProvidedOptions<TSchema>
  };
}

/**
 * Validates only raw option values known by the given schema and leaves the
 * remaining raw options untouched.
 */
export function parseOptionsSubsetDetailed<const TSchema extends OptionsSchema>(
  schema: TSchema,
  values: Record<string, RawOptionValue>
): ParseOptionsSubsetResult<TSchema> {
  const subsetValues: Record<string, RawOptionValue> = {};
  const rest: Record<string, RawOptionValue> = {};

  for (const [name, value] of Object.entries(values)) {
    if (Object.hasOwn(schema, name)) {
      subsetValues[name] = value;
      continue;
    }

    rest[name] = value;
  }

  return {
    ...parseOptionsDetailed(schema, subsetValues),
    rest
  };
}

function parseOptionValue(
  name: string,
  definition: OptionDefinition,
  value: RawOptionValue
): unknown {
  if (definition.type === 'string') {
    return parseStringOption(name, definition, value);
  }

  if (definition.type === 'boolean') {
    return parseBooleanOption(name, definition, value);
  }

  return parseNumberOption(name, definition, value);
}

function parseDefaultOptionValue(
  name: string,
  definition: OptionDefinition
): unknown {
  const value = definition.default;

  if (definition.type === 'string') {
    if (typeof value !== 'string' || value.trim() === '') {
      throw createExpectedDefaultError(name, 'string', value);
    }

    assertChoice(name, definition.choices, value, 'default');

    return value;
  }

  if (definition.type === 'boolean') {
    if (typeof value !== 'boolean') {
      throw createExpectedDefaultError(name, 'boolean', value);
    }

    return value;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw createExpectedDefaultError(name, 'number', value);
  }

  validateNumberConstraints(name, definition, value, 'default');

  return value;
}

function parseStringOption(
  name: string,
  definition: StringOption,
  value: RawOptionValue
): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw createExpectedOptionTypeError(name, 'string', value);
  }

  assertChoice(name, definition.choices, value);

  return value;
}

function parseBooleanOption(
  name: string,
  definition: BooleanOption,
  value: RawOptionValue
): boolean {
  if (definition.syntax === 'flag') {
    if (value === true) {
      return true;
    }

    throw createExpectedOptionTypeError(name, 'boolean flag', value);
  }

  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  throw createExpectedOptionTypeError(name, 'boolean flag', value);
}

function parseNumberOption(
  name: string,
  definition: NumberOption,
  value: RawOptionValue
): number {
  if (typeof value !== 'string' || value.trim() === '') {
    throw createExpectedOptionTypeError(name, 'number', value);
  }

  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw createExpectedOptionTypeError(name, 'number', value);
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw createExpectedOptionTypeError(name, 'number', value);
  }

  validateNumberConstraints(name, definition, parsed);

  return parsed;
}

function validateNumberConstraints(
  name: string,
  definition: NumberOption,
  parsed: number,
  source: OptionValueSource = 'value'
): void {
  if (definition.integer === true && !Number.isInteger(parsed)) {
    if (source === 'default') {
      throw createInvalidOptionDefaultError(
        name,
        `Expected '--${name}' as integer`,
        {
          expected: 'integer',
          value: parsed
        }
      );
    }

    throw createExpectedOptionTypeError(name, 'integer', parsed);
  }

  if (definition.min !== undefined && parsed < definition.min) {
    const message = `Expected '--${name}' to be greater than or equal to ${String(definition.min)}`;

    if (source === 'default') {
      throw createInvalidOptionDefaultError(
        name,
        message,
        {
          expected: 'minimum',
          min: definition.min,
          value: parsed
        }
      );
    }

    throw createInvalidOptionTypeError(
      name,
      message,
      {
        expected: 'minimum',
        min: definition.min,
        value: parsed
      }
    );
  }

  if (definition.max !== undefined && parsed > definition.max) {
    const message = `Expected '--${name}' to be less than or equal to ${String(definition.max)}`;

    if (source === 'default') {
      throw createInvalidOptionDefaultError(
        name,
        message,
        {
          expected: 'maximum',
          max: definition.max,
          value: parsed
        }
      );
    }

    throw createInvalidOptionTypeError(
      name,
      message,
      {
        expected: 'maximum',
        max: definition.max,
        value: parsed
      }
    );
  }

  assertChoice(name, definition.choices, parsed, source);
}

function assertChoice<TValue extends string | number>(
  name: string,
  choices: readonly TValue[] | undefined,
  value: TValue,
  source: OptionValueSource = 'value'
): void {
  if (choices === undefined || choices.includes(value)) {
    return;
  }

  const message = `Expected '--${name}' as one of: ${choices.join(', ')}`;

  if (source === 'default') {
    throw createInvalidOptionDefaultError(
      name,
      message,
      {
        choices: [...choices],
        value
      }
    );
  }

  throw createInvalidOptionChoiceError(name, choices, value, message);
}

function createUnexpectedArgumentError(name: string): IcoreError {
  return new IcoreError(
    'UNEXPECTED_ARGUMENT',
    `Unexpected argument '--${name}'`,
    {
      argument: `--${name}`,
      option: name
    }
  );
}

function createExpectedRequiredArgumentError(name: string): IcoreError {
  return new IcoreError(
    'EXPECTED_REQUIRED_ARGUMENT',
    `Expected required argument '--${name}'`,
    {
      argument: `--${name}`,
      option: name
    }
  );
}

function createExpectedOptionTypeError(
  name: string,
  expected: string,
  value: unknown
): IcoreError {
  return createInvalidOptionTypeError(
    name,
    `Expected '--${name}' as ${expected}`,
    {
      expected,
      value
    }
  );
}

function createExpectedDefaultError(
  name: string,
  expected: string,
  value: unknown
): IcoreError {
  return createInvalidOptionDefaultError(
    name,
    `Expected default for '--${name}' as ${expected}`,
    {
      expected,
      value
    }
  );
}

function createInvalidOptionTypeError(
  name: string,
  message: string,
  details: IcoreErrorDetails
): IcoreError {
  return new IcoreError(
    'INVALID_OPTION_TYPE',
    message,
    {
      argument: `--${name}`,
      option: name,
      ...details
    }
  );
}

function createInvalidOptionChoiceError<TValue extends string | number>(
  name: string,
  choices: readonly TValue[],
  value: TValue,
  message: string
): IcoreError {
  return new IcoreError(
    'INVALID_OPTION_CHOICE',
    message,
    {
      argument: `--${name}`,
      option: name,
      choices: [...choices],
      value
    }
  );
}

function createInvalidOptionDefaultError(
  name: string,
  message: string,
  details: IcoreErrorDetails
): IcoreError {
  return new IcoreError(
    'INVALID_OPTION_DEFAULT',
    message,
    {
      argument: `--${name}`,
      option: name,
      ...details
    }
  );
}
