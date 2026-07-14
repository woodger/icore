/**
 * The error module defines machine-readable errors emitted by CLI mechanics.
 *
 * Allowed here:
 * - defining stable error codes;
 * - preserving human-readable messages on Error instances;
 * - carrying structured details for application-level handling;
 *
 * This file must not contain parser, validator, or command resolution logic.
 */

/**
 * Stable machine-readable error code for `icore` CLI mechanics errors.
 */
export type IcoreErrorCode =
  | 'UNKNOWN_COMMAND'
  | 'UNEXPECTED_ARGUMENT'
  | 'DUPLICATE_ARGUMENT'
  | 'EXPECTED_REQUIRED_ARGUMENT'
  | 'INVALID_OPTION_TYPE'
  | 'INVALID_OPTION_CHOICE'
  | 'UNEXPECTED_POSITIONAL'
  | 'INVALID_OPTION_ALIAS'
  | 'DUPLICATE_ALIAS'
  | 'INVALID_OPTION_DEFAULT'
  | 'DUPLICATE_COMMAND';

/**
 * Stable category for distinguishing user input failures from invalid command
 * or option definitions.
 */
export type IcoreErrorCategory = 'usage' | 'definition';

const icoreErrorCategoryByCode = {
  UNKNOWN_COMMAND: 'usage',
  UNEXPECTED_ARGUMENT: 'usage',
  DUPLICATE_ARGUMENT: 'usage',
  EXPECTED_REQUIRED_ARGUMENT: 'usage',
  INVALID_OPTION_TYPE: 'usage',
  INVALID_OPTION_CHOICE: 'usage',
  UNEXPECTED_POSITIONAL: 'usage',
  INVALID_OPTION_ALIAS: 'definition',
  DUPLICATE_ALIAS: 'definition',
  INVALID_OPTION_DEFAULT: 'definition',
  DUPLICATE_COMMAND: 'definition'
} as const satisfies Record<IcoreErrorCode, IcoreErrorCategory>;

/**
 * Structured context for application-level error handling.
 */
export type IcoreErrorDetails = Readonly<Record<string, unknown>>;

/**
 * Error thrown by `icore` for CLI parsing, option validation, command
 * resolution, and schema configuration failures.
 */
export class IcoreError extends Error {
  /** Stable machine-readable code. */
  readonly code: IcoreErrorCode;
  /** Stable high-level error category. */
  readonly category: IcoreErrorCategory;
  /** Structured error context. */
  readonly details: IcoreErrorDetails;

  constructor(
    code: IcoreErrorCode,
    message: string,
    details: IcoreErrorDetails = {}
  ) {
    super(message);

    this.name = 'IcoreError';
    this.code = code;
    this.category = icoreErrorCategoryByCode[code];
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
