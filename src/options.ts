type OptionBase<TType extends string, TValue> = {
  type: TType;
  required?: boolean;
  default?: TValue;
};

/**
 * Raw option value produced by `parseArgv` before schema validation.
 *
 * Long options with a value are stored as strings, and flag-only options are
 * stored as `true`.
 */
export type RawOptionValue = string | boolean;

/**
 * Declarative string option contract.
 *
 * `choices` narrows the parsed value to a string literal union when the schema
 * is declared with `as const`.
 */
export type StringOption<TChoices extends readonly string[] = readonly string[]> =
  OptionBase<'string', TChoices[number] | string> & {
    choices?: TChoices;
  };

/**
 * Declarative boolean flag contract.
 *
 * Boolean options accept flag form only, for example `--insecure`.
 */
export type BooleanOption = OptionBase<'boolean', boolean>;

/**
 * Declarative number option contract.
 *
 * Number options can require integer values and enforce inclusive `min` / `max`
 * bounds.
 */
export type NumberOption<TChoices extends readonly number[] = readonly number[]> =
  OptionBase<'number', TChoices[number] | number> & {
    choices?: TChoices;
    integer?: boolean;
    min?: number;
    max?: number;
  };

/**
 * Any supported option definition.
 */
export type OptionDefinition =
  | StringOption
  | BooleanOption
  | NumberOption;

/**
 * Command option schema keyed by exact public CLI option names.
 */
export type OptionsSchema = Record<string, OptionDefinition>;

type Simplify<TValue> = {
  [TName in keyof TValue]: TValue[TName];
} & {};

type MergeOptionsSchemaPair<
  TLeft extends OptionsSchema,
  TRight extends OptionsSchema
> = Simplify<Omit<TLeft, keyof TRight> & TRight>;

type MergeOptionsSchemasWithResult<
  TSchemas extends readonly OptionsSchema[],
  TResult extends OptionsSchema
> = TSchemas extends readonly [
  infer THead extends OptionsSchema,
  ...infer TRest extends readonly OptionsSchema[]
]
  ? MergeOptionsSchemasWithResult<
    TRest,
    MergeOptionsSchemaPair<TResult, THead>
  >
  : TResult;

/**
 * Infers the schema produced by `mergeOptionsSchema`.
 */
export type MergeOptionsSchemas<TSchemas extends readonly OptionsSchema[]> =
  MergeOptionsSchemasWithResult<TSchemas, Record<never, never>>;

type StringOptionValue<TOption> = TOption extends { choices: readonly (infer TChoice extends string)[] }
  ? TChoice
  : string;

type NumberOptionValue<TOption> = TOption extends { choices: readonly (infer TChoice extends number)[] }
  ? TChoice
  : number;

type OptionValue<TOption> =
  TOption extends { type: 'string' }
    ? StringOptionValue<TOption>
    : TOption extends { type: 'boolean' }
      ? boolean
      : TOption extends { type: 'number' }
        ? NumberOptionValue<TOption>
        : never;

type OptionIsAlwaysPresent<TOption> = TOption extends { required: true }
  ? true
  : TOption extends { default: unknown }
    ? true
    : false;

/**
 * Infers parsed option values from an option schema.
 *
 * Required options and options with defaults are always present. Optional
 * options without defaults are returned as `T | undefined`.
 */
export type InferOptions<TSchema extends OptionsSchema> = {
  [TName in keyof TSchema]: OptionIsAlwaysPresent<TSchema[TName]> extends true
    ? OptionValue<TSchema[TName]>
    : OptionValue<TSchema[TName]> | undefined;
};

/**
 * Infers an option presence map from an option schema.
 *
 * `true` means the user provided the option explicitly. Defaults do not make an
 * option provided.
 */
export type InferProvidedOptions<TSchema extends OptionsSchema> = {
  [TName in keyof TSchema]: boolean;
};

/**
 * Detailed option parsing result with values and user-provided metadata.
 */
export type ParseOptionsResult<TSchema extends OptionsSchema> = {
  options: InferOptions<TSchema>;
  provided: InferProvidedOptions<TSchema>;
};

/**
 * Merges option schemas while preserving literal option definition types.
 *
 * Later schemas override earlier schemas with the same option name.
 */
export function mergeOptionsSchema<
  const TSchema extends OptionsSchema,
  const TSchemas extends readonly OptionsSchema[]
>(
  schema: TSchema,
  ...schemas: TSchemas
): MergeOptionsSchemas<readonly [TSchema, ...TSchemas]> {
  return Object.assign(
    {},
    schema,
    ...schemas
  ) as MergeOptionsSchemas<readonly [TSchema, ...TSchemas]>;
}

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
      throw new Error(`Unexpected argument '--${name}'`);
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
        throw new Error(`Expected required argument '--${String(name)}'`);
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

function parseOptionValue(
  name: string,
  definition: OptionDefinition,
  value: RawOptionValue
): unknown {
  if (definition.type === 'string') {
    return parseStringOption(name, definition, value);
  }

  if (definition.type === 'boolean') {
    return parseBooleanOption(name, value);
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
      throw new Error(`Expected default for '--${name}' as string`);
    }

    assertChoice(name, definition.choices, value);

    return value;
  }

  if (definition.type === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new Error(`Expected default for '--${name}' as boolean`);
    }

    return value;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Expected default for '--${name}' as number`);
  }

  validateNumberConstraints(name, definition, value);

  return value;
}

function parseStringOption(
  name: string,
  definition: StringOption,
  value: RawOptionValue
): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Expected '--${name}' as string`);
  }

  assertChoice(name, definition.choices, value);

  return value;
}

function parseBooleanOption(name: string, value: RawOptionValue): boolean {
  if (value !== true) {
    throw new Error(`Expected '--${name}' as boolean flag`);
  }

  return true;
}

function parseNumberOption(
  name: string,
  definition: NumberOption,
  value: RawOptionValue
): number {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Expected '--${name}' as number`);
  }

  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new Error(`Expected '--${name}' as number`);
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected '--${name}' as number`);
  }

  validateNumberConstraints(name, definition, parsed);

  return parsed;
}

function validateNumberConstraints(
  name: string,
  definition: NumberOption,
  parsed: number
): void {
  if (definition.integer === true && !Number.isInteger(parsed)) {
    throw new Error(`Expected '--${name}' as integer`);
  }

  if (definition.min !== undefined && parsed < definition.min) {
    throw new Error(`Expected '--${name}' to be greater than or equal to ${String(definition.min)}`);
  }

  if (definition.max !== undefined && parsed > definition.max) {
    throw new Error(`Expected '--${name}' to be less than or equal to ${String(definition.max)}`);
  }

  assertChoice(name, definition.choices, parsed);
}

function assertChoice<TValue extends string | number>(
  name: string,
  choices: readonly TValue[] | undefined,
  value: TValue
): void {
  if (choices === undefined || choices.includes(value)) {
    return;
  }

  throw new Error(`Expected '--${name}' as one of: ${choices.join(', ')}`);
}
