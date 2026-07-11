// validation.ts
import type { Confidence, IsoDateTime } from './common';

/**
 * Create a Confidence value, rejecting invalid values.
 * @param value Raw number (e.g., 0.73)
 * @returns Branded Confidence
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

  // Validate string format: YYYY-MM-DDTHH:mm:ss.sssZ (with optional fractional seconds)
  const isoStringRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/;
  const match = date.match(isoStringRegex);
  if (!match) {
    throw new Error('Invalid ISO‑8601 timestamp: must be in UTC and format YYYY-MM-DDTHH:mm:ss.sssZ');
  }

  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr, millisStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12
  const day = parseInt(dayStr, 10);   // 1-31
  const hour = parseInt(hourStr, 10); // 0-23
  const minute = parseInt(minuteStr, 10); // 0-59
  const second = parseInt(secondStr, 10); // 0-59
  const milliseconds = millisStr ? parseInt(millisStr, 10) : 0; // 0-999

  // Validate ranges
  if (month < 1 || month > 12) {
    throw new Error('Invalid month');
  }
  if (day < 1 || day > 31) {
    throw new Error('Invalid day');
  }
  if (hour < 0 || hour > 23) {
    throw new Error('Invalid hour');
  }
  if (minute < 0 || minute > 59) {
    throw new Error('Invalid minute');
  }
  if (second < 0 || second > 59) {
    throw new Error('Invalid second');
  }
  if (milliseconds < 0 || milliseconds > 999) {
    throw new Error('Invalid millisecond');
  }

  // Check day validity for the month and year
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let maxDay = daysInMonth[month - 1];
  // Adjust for leap year
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (isLeap) {
      maxDay = 29;
    }
  }
  if (day > maxDay) {
    throw new Error('Invalid day for month and year');
  }

  // If we passed all checks, the string represents a valid UTC date.
  // We return the canonical ISO string (with exactly three fractional digits) by converting via Date.
  // Note: This ensures consistency, but we could also return the original string if we wanted to preserve fractional seconds.
  // However, the IsoDateTime type is branded, and the canonical form is acceptable.
  return new Date(date).toISOString() as IsoDateTime;
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
  // Must match the UTC ISO-8601 pattern with optional fractional seconds
  const isoStringRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  if (!isoStringRegex.test(value)) {
    return false;
  }

  // Now, we break down the string and validate the date and time components.
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/);
  if (!match) {
    return false; // should not happen because of the regex above
  }

  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr, millisStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12
  const day = parseInt(dayStr, 10);   // 1-31
  const hour = parseInt(hourStr, 10); // 0-23
  const minute = parseInt(minuteStr, 10); // 0-59
  const second = parseInt(secondStr, 10); // 0-59
  const milliseconds = millisStr ? parseInt(millisStr, 10) : 0; // 0-999

  // Validate ranges
  if (month < 1 || month > 12) {
    return false;
  }
  if (day < 1 || day > 31) {
    return false;
  }
  if (hour < 0 || hour > 23) {
    return false;
  }
  if (minute < 0 || minute > 59) {
    return false;
  }
  if (second < 0 || second > 59) {
    return false;
  }
  if (milliseconds < 0 || milliseconds > 999) {
    return false;
  }

  // Check day validity for the month and year
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let maxDay = daysInMonth[month - 1];
  // Adjust for leap year
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (isLeap) {
      maxDay = 29;
    }
  }
  if (day > maxDay) {
    return false;
  }

  return true;
}