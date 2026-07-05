/**
 * The option schema module defines declarative primitive option contracts and
 * their inferred TypeScript result types.
 *
 * Allowed here:
 * - string, boolean, and number option contracts;
 * - schema merge mechanics;
 * - inferred parsed option and provided-option types;
 *
 * This file must not contain argv tokenization, value validation, or command
 * resolution.
 */

type OptionBase<TType extends string, TValue> = {
  /** Primitive option kind. */
  type: TType;
  /** One-letter short alias. */
  alias?: string;
  /** Requires an explicit value. */
  required?: boolean;
  default?: TValue;
};

/**
 * Raw option value produced by `parseArgv` before schema validation.
 *
 * Long options with a value are stored as strings, flag-only options are
 * stored as `true`, and negated boolean options are stored as `false`.
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
    /** Allowed string values. */
    choices?: TChoices;
  };

/**
 * Declarative boolean flag contract.
 *
 * Boolean options accept flag form and schema-known negation unless flag
 * syntax is enforced.
 */
export type BooleanOption = OptionBase<'boolean', boolean> & {
  /** Restricts boolean syntax. */
  syntax?: 'flag';
};

/**
 * Declarative number option contract.
 *
 * Number options can require integer values and enforce inclusive `min` / `max`
 * bounds.
 */
export type NumberOption<TChoices extends readonly number[] = readonly number[]> =
  OptionBase<'number', TChoices[number] | number> & {
    /** Allowed numeric values. */
    choices?: TChoices;
    /** Requires a whole number. */
    integer?: boolean;
    /** Inclusive lower bound. */
    min?: number;
    /** Inclusive upper bound. */
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
