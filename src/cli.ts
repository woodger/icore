export type RawOptionValue = string | boolean;

export type ParsedArgv = {
  positionals: string[];
  options: Record<string, RawOptionValue>;
};

type OptionBase<TType extends string, TValue> = {
  type: TType;
  required?: boolean;
  default?: TValue;
};

export type StringOption<TChoices extends readonly string[] = readonly string[]> =
  OptionBase<'string', TChoices[number] | string> & {
    choices?: TChoices;
  };

export type BooleanOption = OptionBase<'boolean', boolean>;

export type NumberOption<TChoices extends readonly number[] = readonly number[]> =
  OptionBase<'number', TChoices[number] | number> & {
    choices?: TChoices;
    integer?: boolean;
    min?: number;
    max?: number;
  };

export type OptionDefinition =
  | StringOption
  | BooleanOption
  | NumberOption;

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

export type InferOptions<TSchema extends OptionsSchema> = {
  [TName in keyof TSchema]: OptionIsAlwaysPresent<TSchema[TName]> extends true
    ? OptionValue<TSchema[TName]>
    : OptionValue<TSchema[TName]> | undefined;
};

export type CommandInput<
  TSchema extends OptionsSchema,
  TContext
> = {
  options: InferOptions<TSchema>;
  positionals: string[];
  context: TContext;
};

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

export function defineCommand<
  const TSchema extends OptionsSchema,
  TContext = undefined,
  TResult = unknown
>(
  command: CommandDefinition<TSchema, TContext, TResult>
): CommandDefinition<TSchema, TContext, TResult> {
  return command;
}

export function parseArgv(args: readonly string[]): ParsedArgv {
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

export function parseOptions<const TSchema extends OptionsSchema>(
  schema: TSchema,
  values: Record<string, RawOptionValue>
): InferOptions<TSchema> {
  const parsed: Partial<Record<keyof TSchema, unknown>> = {};

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

  return parsed as InferOptions<TSchema>;
}

export async function runCommand<
  const TSchema extends OptionsSchema,
  TContext,
  TResult
>(
  command: CommandDefinition<TSchema, TContext, TResult>,
  args: readonly string[],
  context: TContext
): Promise<TResult> {
  const argv = parseArgv(args);
  const extraPositionals = resolveCommandPositionals(command.path, argv.positionals);

  if (extraPositionals.length > 0 && command.allowExtraPositionals !== true) {
    throw new Error(
      `Unexpected positional argument for '${command.path.join(' ')}': ${extraPositionals[0] ?? ''}`
    );
  }

  return command.handle({
    options: parseOptions(command.options, argv.options),
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
