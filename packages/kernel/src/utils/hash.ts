import { createHash } from 'node:crypto';

/**
 * Deterministic JSON stringification.
 * - Sorts object keys lexicographically.
 * - Sorts array elements recursively (if they are objects).
 * - Omits undefined values (does not serialize them).
 * - Does not serialize functions, symbols, etc. (JSON.stringify will drop or throw).
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Computes a deterministic SHA-256 hash of a value using stableStringify.
 */
export function stableHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}