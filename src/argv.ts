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

import type { OptionsSchema, RawOptionValue } from './options';

/**
 * Parsed CLI arguments split into positional command path segments and raw
 * named options.
 */
export type ParsedArgv = {
  positionals: string[];
  options: Record<string, RawOptionValue>;
};

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

    const definition = schema?.[name];

    if (separatorIndex === -1 && definition === undefined && name.startsWith('no-')) {
      const negatedName = name.slice(3);
      const negatedDefinition = schema?.[negatedName];

      if (negatedDefinition?.type === 'boolean') {
        if (Object.hasOwn(options, negatedName)) {
          throw new Error(`Unexpected duplicate argument '--${negatedName}'`);
        }

        options[negatedName] = false;
        continue;
      }
    }

    if (Object.hasOwn(options, name)) {
      throw new Error(`Unexpected duplicate argument '--${name}'`);
    }

    if (separatorIndex !== -1) {
      options[name] = option.slice(separatorIndex + 1);
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
    options
  };
}
