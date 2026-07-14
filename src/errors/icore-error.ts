/**
 * The error module defines machine-readable errors emitted by CLI mechanics.
 *
 * Allowed here:
 * - defining stable error codes;
 * - correlating error codes with structured details;
 * - preserving human-readable messages on Error instances;
 * - carrying structured details for application-level handling;
 * - narrowing unknown errors by their stable codes;
 *
 * This file must not contain parser, validator, or command resolution logic.
 */

type OptionIdentityDetails = {
  argument: string;
  option: string;
};

type UnknownCommandDetails =
  | {
    reason: 'unresolved';
    command: string;
    positionals: readonly string[];
  }
  | {
    reason: 'path-mismatch';
    command: string;
    path: readonly string[];
    positionals: readonly string[];
  };

type UnexpectedArgumentDetails =
  | {
    reason: 'malformed-option';
    argument: string;
  }
  | {
    reason: 'unknown-option';
    argument: string;
    option: string;
  }
  | {
    reason: 'option-before-command';
    argument: string;
  };

type ExpectedRequiredArgumentDetails =
  | {
    reason: 'option';
    argument: string;
    option: string;
  }
  | {
    reason: 'positional';
    argument: string;
    positional: string;
  };

type InvalidOptionTypeDetails = OptionIdentityDetails & (
  | {
    expected: 'string' | 'boolean flag' | 'number';
    value: unknown;
  }
  | {
    expected: 'integer';
    value: number;
  }
  | {
    expected: 'minimum';
    min: number;
    value: number;
  }
  | {
    expected: 'maximum';
    max: number;
    value: number;
  }
);

type InvalidOptionDefaultDetails = OptionIdentityDetails & (
  | {
    expected: 'string' | 'boolean' | 'number';
    value: unknown;
  }
  | {
    expected: 'integer';
    value: number;
  }
  | {
    expected: 'minimum';
    min: number;
    value: number;
  }
  | {
    expected: 'maximum';
    max: number;
    value: number;
  }
  | {
    expected: 'choice';
    choices: readonly (string | number)[];
    value: string | number;
  }
);

/** Structured details protocol keyed by every stable `IcoreError` code. */
export type IcoreErrorDetailsMap = {
  UNKNOWN_COMMAND: UnknownCommandDetails;
  UNEXPECTED_ARGUMENT: UnexpectedArgumentDetails;
  DUPLICATE_ARGUMENT: OptionIdentityDetails;
  EXPECTED_REQUIRED_ARGUMENT: ExpectedRequiredArgumentDetails;
  INVALID_OPTION_TYPE: InvalidOptionTypeDetails;
  INVALID_OPTION_CHOICE: OptionIdentityDetails & {
    choices: readonly (string | number)[];
    value: string | number;
  };
  UNEXPECTED_POSITIONAL: {
    command: string;
    positional: string;
    positionals: readonly string[];
  };
  INVALID_OPTION_ALIAS: OptionIdentityDetails & {
    alias: unknown;
  };
  DUPLICATE_ALIAS: {
    argument: string;
    alias: string;
  };
  INVALID_OPTION_DEFAULT: InvalidOptionDefaultDetails;
  DUPLICATE_COMMAND: {
    command: string;
  };
};

/** Stable machine-readable error code for `icore` CLI mechanics errors. */
export type IcoreErrorCode = keyof IcoreErrorDetailsMap;

/** Structured details for one exact `IcoreError` code. */
export type IcoreErrorDetails<TCode extends IcoreErrorCode> =
  Readonly<IcoreErrorDetailsMap[TCode]>;

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

type IcoreErrorCategoryFor<TCode extends IcoreErrorCode> =
  typeof icoreErrorCategoryByCode[TCode];

/**
 * Error thrown by `icore` for CLI parsing, option validation, command
 * resolution, and schema configuration failures.
 */
export class IcoreError<
  TCode extends IcoreErrorCode = IcoreErrorCode
> extends Error {
  /** Stable machine-readable code. */
  readonly code: TCode;
  /** Stable high-level error category. */
  readonly category: IcoreErrorCategoryFor<TCode>;
  /** Structured error context. */
  readonly details: IcoreErrorDetails<TCode>;

  constructor(
    code: TCode,
    message: string,
    details: IcoreErrorDetails<TCode>
  ) {
    super(message);

    this.name = 'IcoreError';
    this.code = code;
    this.category = icoreErrorCategoryByCode[code];
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Distributed union preserving the correlation between code and details. */
export type AnyIcoreError = {
  [TCode in IcoreErrorCode]: IcoreError<TCode>;
}[IcoreErrorCode];

/** Checks whether an unknown value is any supported `IcoreError`. */
export function isIcoreError(error: unknown): error is AnyIcoreError;
/** Checks and narrows an unknown value to one exact `IcoreError` code. */
export function isIcoreError<TCode extends IcoreErrorCode>(
  error: unknown,
  code: TCode
): error is IcoreError<TCode>;
export function isIcoreError(
  error: unknown,
  code?: IcoreErrorCode
): error is AnyIcoreError {
  return error instanceof IcoreError
    && (code === undefined || error.code === code);
}
