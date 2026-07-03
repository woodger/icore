/**
 * The CLI public barrel module exposes the supported command mechanics API.
 *
 * Allowed here:
 * - re-exporting public argv parser contracts;
 * - re-exporting public option schema contracts;
 * - re-exporting public command registry contracts;
 * - re-exporting public presentation and output contracts;
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
  isPreparedCommandName,
  prepareCommandFromArgs,
  resolveCommand,
  resolveCommandFromArgs,
  runCommand,
  runPreparedCommand,
  runCommandFromRegistry,
  type CommandDefinition,
  type CommandContext,
  type CommandInput,
  type CommandName,
  type CommandPayload,
  type CommandRegistry,
  type CommandResolutionOptions,
  type CommandResult,
  type PreparedCommand,
  type PreparedCommandInput,
  type ResolvedCommand
} from './commands';
export {
  IcoreError,
  type IcoreErrorCode,
  type IcoreErrorDetails
} from './errors';
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
export {
  presentationFormatOptions,
  presentationFormats,
  renderCsv,
  renderCsvRow,
  renderJson,
  renderTextTable,
  type CsvCell,
  type CsvRow,
  type PresentationFormat,
  type TextTableRow
} from './presentation';
export {
  createBackpressureTextWriter,
  createStderrWriter,
  createStdoutWriter,
  type BackpressureTextSink,
  type TextWriter
} from './output';
