/**
 * The presentation format options module defines shared output format
 * contracts for terminal commands.
 *
 * Allowed here:
 * - supported presentation format names;
 * - reusable option schema for `--format`;
 * - format guards for terminal app composition;
 *
 * This file must not contain rendering logic or command execution.
 */

import type { OptionsSchema } from '../options/parser';

export const presentationFormats = ['json', 'table', 'csv'] as const;

export const presentationFormatOptions = {
  format: {
    type: 'string',
    choices: presentationFormats,
    default: 'table'
  }
} as const satisfies OptionsSchema;

export type PresentationFormat = typeof presentationFormats[number];

export function isPresentationFormat(value: unknown): value is PresentationFormat {
  return typeof value === 'string'
    && presentationFormats.includes(value as PresentationFormat);
}
