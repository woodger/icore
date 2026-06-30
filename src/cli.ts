/**
 * The CLI public barrel module exposes the supported command mechanics API.
 *
 * Allowed here:
 * - re-exporting public argv parser contracts;
 * - re-exporting public option schema contracts;
 * - re-exporting public command registry contracts;
 *
 * This file must not contain parser, validator, or command runtime logic.
 */

export {
  parseArgv,
  type ParsedArgv
} from './argv';
export {
  defineCommand,
  defineCommandRegistry,
  isCommandName,
  resolveCommand,
  resolveCommandFromArgs,
  runCommand,
  runCommandFromRegistry,
  type CommandDefinition,
  type CommandInput,
  type CommandName,
  type CommandRegistry,
  type ResolvedCommand
} from './commands';
export {
  mergeOptionsSchema,
  parseOptions,
  parseOptionsDetailed,
  type BooleanOption,
  type InferOptions,
  type InferProvidedOptions,
  type MergeOptionsSchemas,
  type NumberOption,
  type OptionDefinition,
  type OptionsSchema,
  type ParseOptionsResult,
  type RawOptionValue,
  type StringOption
} from './options';
