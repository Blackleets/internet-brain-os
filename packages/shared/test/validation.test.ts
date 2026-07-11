import { describe, expect, test } from 'vitest';
import {
  createConfidence,
  createIsoDateTime,
  isConfidence,
  isIsoDateTime,
} from '../src/validation';

describe('createConfidence', () => {
  test('accepts 0', () => {
    expect(() => createConfidence(0)).not.toThrow();
  });

  test('accepts 1', () => {
    expect(() => createConfidence(1)).not.toThrow();
  });

  test('accepts 0.5', () => {
    expect(() => createConfidence(0.5)).not.toThrow();
  });

  test('rejects negative', () => {
    expect(() => createConfidence(-0.1)).toThrow(RangeError);
  });

  test('rejects above 1', () => {
    expect(() => createConfidence(1.1)).toThrow(RangeError);
  });

  test('rejects NaN', () => {
    expect(() => createConfidence(NaN)).toThrow(RangeError);
  });

  test('rejects Infinity', () => {
    expect(() => createConfidence(Infinity)).toThrow(RangeError);
  });

  test('rejects -Infinity', () => {
    expect(() => createConfidence(-Infinity)).toThrow(RangeError);
  });
});

describe('createIsoDateTime', () => {
  test('accepts valid Date', () => {
    const date = new Date('2023-01-01T12:00:00.000Z');
    expect(() => createIsoDateTime(date)).not.toThrow();
  });

  test('accepts canonical UTC ISO string', () => {
    expect(() => createIsoDateTime('2023-01-01T12:00:00.000Z')).not.toThrow();
  });

  test('rejects impossible date', () => {
    expect(() => createIsoDateTime('2023-02-30T00:00:00.000Z')).toThrow();
  });

  test('rejects noncanonical timezone input', () => {
    // Non-UTC timezone offset
    expect(() => createIsoDateTime('2023-01-01T12:00:00+05:00')).toThrow();
    // Not ending with Z and without fractional seconds
    expect(() => createIsoDateTime('2023-01-01T12:00:00Z')).toThrow();
  });

  test('rejects non-canonical string (missing milliseconds)', () => {
    expect(() => createIsoDateTime('2023-01-01T12:00:00Z')).toThrow();
  });
});

describe('isConfidence', () => {
  test.each([
    [0, true],
    [1, true],
    [0.5, true],
    [-0.1, false],
    [1.1, false],
    [NaN, false],
    [Infinity, false],
    [-Infinity, false],
  ])('isConfidence(%p) => %p', (value, expected) => {
    expect(isConfidence(value)).toBe(expected);
  });
});

describe('isIsoDateTime', () => {
  test.each([
    ['2023-01-01T12:00:00.000Z', true],
    ['2023-12-31T23:59:59.999Z', true],
    ['2020-02-29T00:00:00.000Z', true], // leap year
    ['2023-02-30T00:00:00.000Z', false], // invalid day
    ['2023-01-01T12:00:00Z', false], // missing milliseconds
    ['2023-01-01T12:00:00+05:00', false], // timezone offset
    ['not-a-date', false],
    ['', false],
  ])('isIsoDateTime(%p) => %p', (value, expected) => {
    expect(isIsoDateTime(value)).toBe(expected);
  });
});