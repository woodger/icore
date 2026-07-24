/**
 * The CLI usage error module provides a shared marker for application-owned
 * command-line input validation.
 *
 * Allowed here:
 * - marking application semantic validation failures as CLI usage errors;
 * - recognizing both application and `icore` usage errors.
 *
 * This file must not contain validation rules, error rendering, help text, or
 * process exit-code policy.
 */

import {
  isIcoreError,
  type AnyIcoreError
} from './icore-error';

type IcoreUsageError = Extract<
  AnyIcoreError,
  { readonly category: 'usage' }
>;

/**
 * Marks an application-owned semantic validation failure as invalid CLI usage.
 */
export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'CliUsageError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Recognizes application and `icore` CLI usage errors. */
export function isUsageError(
  error: unknown
): error is CliUsageError | IcoreUsageError {
  return error instanceof CliUsageError
    || (isIcoreError(error) && error.category === 'usage');
}
