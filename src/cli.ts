/**
 * The CLI mechanics module describes declarative command contracts and performs
 * generic user argument parsing.
 *
 * Allowed here:
 * - parsing raw argv into positionals and long options;
 * - validating primitive CLI options against declarative schemas;
 * - applying and validating defaults;
 * - checking command paths and extra positionals;
 * - running command handlers with typed options and caller-provided context.
 *
 * Not allowed here:
 * - application-specific business rules;
 * - SDK/API request building;
 * - external client lifecycle management;
 * - JSON/table/CSV output formatting;
 * - domain-specific command DSLs.
 */

/**
 * Raw option value produced by `parseArgv` before schema validation.
 *
 * Long options with a value are stored as strings, and flag-only options are
 * stored as `true`.
 */
export type RawOptionValue = string | boolean;

/**
 * Parsed CLI arguments split into positional command path segments and raw
 * named options.
 */
export type ParsedArgv = {
  positionals: string[];
  options: Record<string, RawOptionValue>;
};

type OptionBase<TType extends string, TValue> = {
  type: TType;
  required?: boolean;
  default?: TValue;
};

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
 * Input passed to a command handler after command path and option validation.
 */
export type CommandInput<
  TSchema extends OptionsSchema,
  TContext
> = {
  options: InferOptions<TSchema>;
  provided: InferProvidedOptions<TSchema>;
  positionals: string[];
  context: TContext;
};

/**
 * Declarative command contract.
 *
 * `icore` owns command mechanics. The handler remains responsible for
 * application-specific work such as API calls, request building, and output
 * formatting.
 */
export type CommandDefinition<
  TSchema extends OptionsSchema,
  TContext,
  TResult
> = {
  path: readonly [string, ...string[]];
  options: TSchema;
  allowExtraPositionals?: boolean;
  handle(input: CommandInput<TSchema, TContext>): TResult | Promise<TResult>;
};

/**
 * Defines a command while preserving literal option schema types.
 */
export function defineCommand<
  const TSchema extends OptionsSchema,
  TContext = undefined,
  TResult = unknown
>(
  command: CommandDefinition<TSchema, TContext, TResult>
): CommandDefinition<TSchema, TContext, TResult> {
  return command;
}

/**
 * Parses raw CLI arguments into positionals and raw long-option values.
 */
export function parseArgv(
  args: readonly string[],
  schema?: OptionsSchema
): ParsedArgv {
  const positionals: string[] = [];
  const options: Record<string, RawOptionValue> = {};
  let parseOptions = true;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === undefined) {
      continue;
    }

    if (!parseOptions || !arg.startsWith('--') || arg === '--') {
      if (arg === '--') {
        parseOptions = false;
        continue;
      }

      positionals.push(arg);
      continue;
    }

    const option = arg.slice(2);
    const separatorIndex = option.indexOf('=');
    const name = separatorIndex === -1
      ? option
      : option.slice(0, separatorIndex);

    if (name === '') {
      throw new Error(`Unexpected argument '${arg}'`);
    }

    if (Object.hasOwn(options, name)) {
      throw new Error(`Unexpected duplicate argument '--${name}'`);
    }

    if (separatorIndex !== -1) {
      options[name] = option.slice(separatorIndex + 1);
      continue;
    }

    const definition = schema?.[name];

    if (definition?.type === 'boolean') {
      options[name] = true;
      continue;
    }

    const nextArg = args[index + 1];

    if (nextArg !== undefined && !nextArg.startsWith('-')) {
      options[name] = nextArg;
      index += 1;
      continue;
    }

    options[name] = true;
  }

  return {
    positionals,
    options
  };
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

/**
 * Parses arguments, validates command mechanics, and executes a command
 * handler.
 */
export async function runCommand<
  const TSchema extends OptionsSchema,
  TContext,
  TResult
>(
  command: CommandDefinition<TSchema, TContext, TResult>,
  args: readonly string[],
  context: TContext
): Promise<TResult> {
  const argv = parseArgv(args, command.options);
  const extraPositionals = resolveCommandPositionals(command.path, argv.positionals);

  if (extraPositionals.length > 0 && command.allowExtraPositionals !== true) {
    throw new Error(
      `Unexpected positional argument for '${command.path.join(' ')}': ${extraPositionals[0] ?? ''}`
    );
  }

  const parsed = parseOptionsDetailed(command.options, argv.options);

  return command.handle({
    options: parsed.options,
    provided: parsed.provided,
    positionals: extraPositionals,
    context
  });
}

function resolveCommandPositionals(
  path: readonly string[],
  positionals: readonly string[]
): string[] {
  for (let index = 0; index < path.length; index += 1) {
    if (positionals[index] !== path[index]) {
      throw new Error(`Expected command '${path.join(' ')}'`);
    }
  }

  return positionals.slice(path.length);
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
