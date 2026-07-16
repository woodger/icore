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
 *
 * Throws when the value has no top-level JSON representation.
 */
export function renderJson(value: unknown): string {
  const json = JSON.stringify(value, null, 2);

  if (json === undefined) {
    throw new TypeError('Expected a JSON-serializable value');
  }

  return `${json}\n`;
}
