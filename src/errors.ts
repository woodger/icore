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
  | 'UNEXPECTED_POSITIONAL';

/**
 * Structured context for application-level error handling.
 */
export type IcoreErrorDetails = Readonly<Record<string, unknown>>;

/**
 * Error thrown by `icore` for CLI parsing, option validation, and command
 * resolution failures.
 */
export class IcoreError extends Error {
  readonly code: IcoreErrorCode;
  readonly details: IcoreErrorDetails;

  constructor(
    code: IcoreErrorCode,
    message: string,
    details: IcoreErrorDetails = {}
  ) {
    super(message);

    this.name = 'IcoreError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
