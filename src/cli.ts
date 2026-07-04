/**
 * The CLI public barrel module exposes the supported command mechanics API.
 *
 * Allowed here:
 * - re-exporting public argv parser contracts;
 * - re-exporting public option schema contracts;
 * - re-exporting public command registry contracts;
 * - re-exporting public presentation and output contracts;
 * - re-exporting public terminal app composition contracts;
 *
 * This file must not contain parser, validator, or command runtime logic.
 */

export {
  parseArgv,
  type ParsedArgv
} from './argv';
export {
  createCommands,
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
  type Commands,
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
  parseOptionsSubsetDetailed,
  type BooleanOption,
  type InferOptions,
  type InferProvidedOptions,
  type MergeOptionsSchemas,
  type NumberOption,
  type OptionDefinition,
  type OptionsSchema,
  type ParseOptionsResult,
  type ParseOptionsSubsetResult,
  type RawOptionValue,
  type StringOption
} from './options';
export {
  createPresentation,
  isPresentationFormat,
  isPresentationResult,
  presentationFormatOptions,
  presentationFormats,
  renderCsv,
  renderCsvRow,
  renderJson,
  renderPresentationResult,
  renderTextTable,
  type CsvCell,
  type CsvRow,
  type CsvPresentationView,
  type EmptyPresentationView,
  type Presentation,
  type PresentationFormat,
  type PresentationRecord,
  type PresentationRenderers,
  type PresentationResult,
  type PresentationView,
  type PresentationViewFactory,
  type RecordPresentationView,
  type RecordsPresentationView,
  type TablePresentationView,
  type TextPresentationView,
  type TextTableRow
} from './presentation';
export {
  createBackpressureTextWriter,
  createOutput,
  createStderrWriter,
  createStdoutWriter,
  type BackpressureTextSink,
  type Output,
  type OutputOptions,
  type TextWriter
} from './output';
export {
  createTerminalApp,
  type TerminalApp,
  type TerminalAppOptions,
  type TerminalCommandOutput
} from './app';
