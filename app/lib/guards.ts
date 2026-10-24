/**
 * Runtime type guards for narrowing `unknown` values: parsed JSON, metafield
 * contents and Storefront API payloads.
 */

/** A plain object or class instance: not `null`, not an array. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
