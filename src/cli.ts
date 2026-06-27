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
