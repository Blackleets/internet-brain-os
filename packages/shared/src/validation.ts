// validation.ts
import type { Confidence, IsoDateTime } from './common';

/**
 * Create a Confidence value, rejecting invalid values.
 * @param value Raw number (e.g., 0.73)
 * @returns Branded Confidence
 * @throws RangeError if value is not a finite number between 0 and 1 inclusive
 */
export function createConfidence(value: number): Confidence {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError('Confidence must be a finite number between 0 and 1 inclusive');
  }
  return value as Confidence;
}

/**
 * Create an IsoDateTime from a Date object or ISO string.
 * @param date A Date instance or an ISO‑8601 string (must be UTC and end with 'Z')
 * @returns Branded IsoDateTime (canonical UTC ISO-8601 string)
 * @throws Error if the input is not a valid ISO‑8601 UTC timestamp
 */
export function createIsoDateTime(date: Date | string): IsoDateTime {
  if (date instanceof Date) {
    if (isNaN(date.getTime())) {
      throw new Error('Invalid Date: time is NaN');
    }
    return date.toISOString() as IsoDateTime;
  }

  // Validate string format: must be UTC ISO-8601 with exactly three fractional seconds, ending with Z
  const isoStringRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  if (!isoStringRegex.test(date)) {
    throw new Error('Invalid ISO‑8601 timestamp: must be in UTC and format YYYY-MM-DDTHH:mm:ss.sssZ with exactly three fractional digits');
  }

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    throw new Error('Invalid ISO‑8601 timestamp: date is not valid');
  }

  // Ensure the string is canonical (i.e., matches the output of toISOString)
  if (dateObj.toISOString() !== date) {
    throw new Error('Timestamp must use canonical UTC ISO-8601 format');
  }

  return date as IsoDateTime;
}

/**
 * Type guard for Confidence.
 */
export function isConfidence(value: unknown): value is Confidence {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0 && value <= 1;
}

/**
 * Type guard for IsoDateTime.
 */
export function isIsoDateTime(value: unknown): value is IsoDateTime {
  if (typeof value !== 'string') {
    return false;
  }
  // Must match the UTC ISO-8601 pattern with exactly three fractional seconds
  const isoStringRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  if (!isoStringRegex.test(value)) {
    return false;
  }
  const dateObj = new Date(value);
  return !isNaN(dateObj.getTime()) && dateObj.toISOString() === value;
}