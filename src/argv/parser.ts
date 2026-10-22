/**
 * The argv parser module transforms raw CLI tokens into positional segments
 * and unvalidated long-option values.
 *
 * Allowed here:
 * - splitting argv into positionals and named options;
 * - applying option-schema hints only when token ownership is ambiguous;
 * - rejecting duplicate raw option names before schema validation;
 *
 * This file must not contain typed option validation or command resolution.
 */

import type { OptionDefinition, OptionsSchema, RawOptionValue } from '../options/schema';
import { IcoreError } from '../errors/icore-error';

/**
 * Parsed CLI arguments split into positional command path segments and raw
 * named options.
 */
export type ParsedArgv = {
  /** Non-option tokens. */
  positionals: string[];
  /** Unvalidated option values. */
  options: Record<string, RawOptionValue>;
};

type ShortAliasDefinition = {
  name: string;
  definition: OptionDefinition;
};

const shortOptionPrefix = '-';
const longOptionPrefix = '--';
const negatedOptionPrefix = 'no-';
const optionValueSeparator = '=';

/**
 * Parses raw CLI arguments into positionals and raw long-option values.
 */
export function parseArgv(
  args: readonly string[],
  schema?: OptionsSchema
): ParsedArgv {
  const positionals: string[] = [];
  const options = Object.create(null) as Record<string, RawOptionValue>;
  const aliases = buildShortAliasMap(schema);
  let parseOptions = true;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === undefined) {
      continue;
    }

    if (!parseOptions) {
      positionals.push(arg);
      continue;
    }

    if (arg === longOptionPrefix) {
      parseOptions = false;
      continue;
    }

    if (isShortOptionToken(arg)) {
      const alias = aliases.get(arg.slice(shortOptionPrefix.length));

      if (alias === undefined) {
        positionals.push(arg);
        continue;
      }

      if (Object.hasOwn(options, alias.name)) {
        throw createDuplicateArgumentError(alias.name);
      }

      if (alias.definition.type === 'boolean') {
        options[alias.name] = true;
        continue;
      }

      const nextArg = args[index + 1];

      if (nextArg !== undefined && nextArg !== longOptionPrefix) {
        options[alias.name] = nextArg;
        index += 1;
        continue;
      }

      options[alias.name] = true;
      continue;
    }

    if (!arg.startsWith(longOptionPrefix)) {
      positionals.push(arg);
      continue;
    }

    const option = arg.slice(longOptionPrefix.length);
    const separatorIndex = option.indexOf(optionValueSeparator);
    const name = separatorIndex === -1
      ? option
      : option.slice(0, separatorIndex);

    if (name === '') {
      throw createUnexpectedArgumentError(arg);
    }

    const definition = getOwnOptionDefinition(schema, name);

    if (
      separatorIndex === -1
      && definition === undefined
      && name.startsWith(negatedOptionPrefix)
    ) {
      const negatedName = name.slice(negatedOptionPrefix.length);
      const negatedDefinition = getOwnOptionDefinition(schema, negatedName);

      if (negatedDefinition?.type === 'boolean') {
        if (Object.hasOwn(options, negatedName)) {
          throw createDuplicateArgumentError(negatedName);
        }

        options[negatedName] = false;
        continue;
      }
    }

    if (Object.hasOwn(options, name)) {
      throw createDuplicateArgumentError(name);
    }

    if (separatorIndex !== -1) {
      options[name] = option.slice(separatorIndex + optionValueSeparator.length);
      continue;
    }

    if (definition?.type === 'boolean') {
      options[name] = true;
      continue;
    }

    const nextArg = args[index + 1];

    if (definition !== undefined && nextArg !== undefined && nextArg !== '--') {
      options[name] = nextArg;
      index += 1;
      continue;
    }

    if (nextArg !== undefined && !nextArg.startsWith('-')) {
      options[name] = nextArg;
      index += 1;
      continue;
    }

    options[name] = true;
  }

  return {
    positionals,
    options: { ...options }
  };
}

function getOwnOptionDefinition(
  schema: OptionsSchema | undefined,
  name: string
): OptionDefinition | undefined {
  if (schema === undefined || !Object.hasOwn(schema, name)) {
    return undefined;
  }

  return schema[name];
}

function buildShortAliasMap(
  schema: OptionsSchema | undefined
): Map<string, ShortAliasDefinition> {
  const aliases = new Map<string, ShortAliasDefinition>();

  if (schema === undefined) {
    return aliases;
  }

  for (const name of Object.keys(schema)) {
    const definition = schema[name];

    if (definition === undefined || definition.alias === undefined) {
      continue;
    }

    assertShortAlias(name, definition.alias);

    if (aliases.has(definition.alias)) {
      throw createDuplicateAliasError(definition.alias);
    }

    aliases.set(definition.alias, {
      name,
      definition
    });
  }

  return aliases;
}

function assertShortAlias(name: string, alias: string): void {
  if (/^[A-Za-z]$/.test(alias)) {
    return;
  }

  throw createInvalidOptionAliasError(name, alias);
}

function isShortOptionToken(arg: string): boolean {
  return arg.length === shortOptionPrefix.length + 1
    && arg.startsWith(shortOptionPrefix)
    && !arg.startsWith(longOptionPrefix);
}

function createDuplicateArgumentError(
  name: string
): IcoreError<'DUPLICATE_ARGUMENT'> {
  return new IcoreError(
    'DUPLICATE_ARGUMENT',
    `Unexpected duplicate argument '--${name}'`,
    {
      argument: `--${name}`,
      option: name
    }
  );
}

function createUnexpectedArgumentError(
  argument: string
): IcoreError<'UNEXPECTED_ARGUMENT'> {
  return new IcoreError(
    'UNEXPECTED_ARGUMENT',
    `Unexpected argument '${argument}'`,
    {
      reason: 'malformed-option',
      argument
    }
  );
}

function createDuplicateAliasError(alias: string): IcoreError<'DUPLICATE_ALIAS'> {
  return new IcoreError(
    'DUPLICATE_ALIAS',
    `Unexpected duplicate alias '-${alias}'`,
    {
      alias,
      argument: `-${alias}`
    }
  );
}

function createInvalidOptionAliasError(
  name: string,
  alias: string
): IcoreError<'INVALID_OPTION_ALIAS'> {
  return new IcoreError(
    'INVALID_OPTION_ALIAS',
    `Expected alias for '--${name}' as single ASCII letter`,
    {
      argument: `--${name}`,
      option: name,
      alias
    }
  );
}
