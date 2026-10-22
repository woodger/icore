/**
 * The CLI usage error module provides a shared marker for application-owned
 * command-line input validation.
 *
 * Allowed here:
 * - marking application semantic validation failures as CLI usage errors;
 * - recognizing both application and `icore` usage errors;
 * - recognizing compatible errors from another physical package copy.
 *
 * This file must not contain validation rules, error rendering, help text, or
 * process exit-code policy.
 */

import { isIcoreError, type AnyIcoreError } from './icore-error';

type IcoreUsageError = Extract<
  AnyIcoreError,
  { readonly category: 'usage' }
>;

const cliUsageErrorBrand = Symbol.for('icore.error.CliUsageError.v1');

/**
 * Marks an application-owned semantic validation failure as invalid CLI usage.
 */
export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'CliUsageError';
    Object.defineProperty(this, cliUsageErrorBrand, {
      value: true
    });
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Recognizes application validation failures and usage-category icore errors. */
  static isUsageError(
    error: unknown
  ): error is CliUsageError | IcoreUsageError {
    return CliUsageError.isCliUsageError(error)
      || (isIcoreError(error) && error.category === 'usage');
  }

  private static isCliUsageError(error: unknown): error is CliUsageError {
    try {
      if (!(error instanceof Error)) {
        return false;
      }

      if (error instanceof CliUsageError) {
        return true;
      }

      if (
        CliUsageError.ownsProperty(error, cliUsageErrorBrand)
        && Reflect.get(error, cliUsageErrorBrand) === true
      ) {
        return true;
      }

      return false;
    }
    catch {
      return false;
    }
  }

  private static ownsProperty(value: object, key: PropertyKey): boolean {
    return Object.hasOwn(value, key);
  }
}

/**
 * Recognizes compatible application and `icore` CLI usage errors, including
 * errors created by another physical copy in the same JavaScript realm.
 */
export function isUsageError(
  error: unknown
): error is CliUsageError | IcoreUsageError {
  return CliUsageError.isUsageError(error);
}
