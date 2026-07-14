/**
 * The package entrypoint exposes the supported command mechanics API.
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
} from './argv/parser';
export {
  createCommand,
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
  type Command,
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
} from './command/mechanics';
export {
  IcoreError,
  type IcoreErrorCategory,
  type IcoreErrorCode,
  type IcoreErrorDetails
} from './errors/icore-error';
export {
  parseOptions,
  parseOptionsDetailed,
  parseOptionsSubsetDetailed,
  type ParseOptionsResult,
  type ParseOptionsSubsetResult
} from './options/parser';
export {
  mergeOptionsSchema,
  type BooleanOption,
  type InferOptions,
  type InferProvidedOptions,
  type MergeOptionsSchemas,
  type NumberOption,
  type OptionDefinition,
  type OptionsSchema,
  type RawOptionValue,
  type StringOption
} from './options/schema';
export {
  createPresentation,
  type Presentation,
  type PresentationRenderers
} from './presentation/facade';
export {
  isPresentationFormat,
  presentationFormatOptions,
  presentationFormats,
  type PresentationFormat
} from './presentation/format-options';
export {
  renderCsv,
  renderCsvRow
} from './presentation/renderers/csv';
export {
  renderJson
} from './presentation/renderers/json';
export {
  renderTextTable
} from './presentation/renderers/table';
export {
  isPresentationResult,
  renderPresentationResult
} from './presentation/result-renderer';
export {
  type CsvCell,
  type CsvRow,
  type CsvPresentationView,
  type EmptyPresentationView,
  type PresentationRecord,
  type PresentationResult,
  type PresentationView,
  type PresentationViewFactory,
  type RecordPresentationView,
  type RecordsPresentationView,
  type TablePresentationView,
  type TextPresentationView,
  type TextTableRow
} from './presentation/view';
export {
  createOutput,
  type Output,
  type OutputOptions
} from './output/facade';
export {
  createStderrWriter,
  createStdoutWriter
} from './output/node-writer';
export {
  createBackpressureTextWriter,
  type BackpressureTextSink,
  type TextWriter
} from './output/text-writer';
export {
  createTerminalApp,
  type TerminalApp,
  type TerminalAppOptions,
  type TerminalCommandOutput,
  type TerminalErrorContext,
  type TerminalErrorPhase,
  type TerminalErrorPolicy
} from './terminal/app';
