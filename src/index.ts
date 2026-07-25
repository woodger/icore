/**
 * The package entrypoint exposes the supported command mechanics API.
 *
 * Allowed here:
 * - re-exporting public argv parser contracts;
 * - re-exporting public option schema contracts;
 * - re-exporting public command registry contracts;
 * - re-exporting public presentation and semantic output contracts;
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
  type BoundCommand,
  type Command,
  type CommandAcceptedPath,
  type CommandContext,
  type CommandDefinition,
  type CommandInput,
  type CommandName,
  type CommandPath,
  type CommandPayload,
  type CommandRegistry,
  type CommandResolutionOptions,
  type CommandResult,
  type CommandTypeBindings,
  type Commands,
  type PreparedCommand,
  type PreparedCommandInput,
  type ResolvedCommand
} from './command/mechanics';
export {
  CliUsageError,
  isUsageError
} from './errors/cli-usage-error';
export {
  IcoreError,
  isIcoreError,
  type AnyIcoreError,
  type IcoreErrorCategory,
  type IcoreErrorCode,
  type IcoreErrorDetails,
  type IcoreErrorDetailsMap
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

/**
 * Legacy interactive terminal output compatibility surface.
 *
 * @deprecated Keep interactive line output in the consuming application. These
 * exports remain available during `2.x` and will be removed in the next major.
 */
export {
  createTerminalOutput,
  type TerminalCapabilities,
  type TerminalLineOutput,
  type TerminalOutput,
  type TerminalOutputOptions,
  type TerminalTextSink
} from './output/terminal-output';
export {
  createTerminalApp,
  isTerminalCommandOutput,
  type TerminalApp,
  type TerminalAppOptions,
  type TerminalCommandOutput,
  type TerminalErrorContext,
  type TerminalErrorPhase,
  type TerminalErrorPolicy
} from './terminal/app';

/**
 * Legacy terminal progress compatibility surface.
 *
 * @deprecated Keep progress state, rendering, and lifecycle in the consuming
 * application. These exports remain available during `2.x` and will be
 * removed in the next major.
 */
export {
  createTerminalProgress,
  formatTerminalCount,
  formatTerminalDuration,
  renderTerminalProgress,
  type TerminalProgress,
  type TerminalProgressOptions,
  type TerminalProgressRenderer,
  type TerminalProgressSnapshot,
  type TerminalProgressState
} from './terminal/progress';
