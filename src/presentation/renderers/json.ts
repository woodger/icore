/**
 * The JSON renderer module converts terminal presentation values to formatted
 * JSON text.
 *
 * Allowed here:
 * - generic JSON stringification for already prepared values;
 *
 * This file must not contain domain-specific scalar formatting.
 */

export function renderJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
