/**
 * The JSON renderer module converts terminal presentation values to formatted
 * JSON text.
 *
 * Allowed here:
 * - generic JSON stringification for already prepared values;
 *
 * This file must not contain domain-specific scalar formatting.
 */

/**
 * Renders an already prepared value as pretty JSON with a trailing newline.
 */
export function renderJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
