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

import {
  isIcoreError,
  type AnyIcoreError
} from './icore-error';

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
}

/**
 * Recognizes compatible application and `icore` CLI usage errors, including
 * errors created by another physical copy in the same JavaScript realm.
 */
export function isUsageError(
  error: unknown
): error is CliUsageError | IcoreUsageError {
  return isCliUsageError(error)
    || (isIcoreError(error) && error.category === 'usage');
}

function isCliUsageError(error: unknown): error is CliUsageError {
  try {
    if (!(error instanceof Error)) {
      return false;
    }

    if (error instanceof CliUsageError) {
      return true;
    }

    if (
      ownsProperty(error, cliUsageErrorBrand)
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

function ownsProperty(value: object, key: PropertyKey): boolean {
  // biome-ignore lint/suspicious/noPrototypeBuiltins: This safely supports objects with arbitrary prototypes.
  return Object.prototype.hasOwnProperty.call(value, key);
}
