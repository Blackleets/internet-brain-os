// validation.test.ts
import { describe, expect, test } from 'vitest';
import { createConfidence, createIsoDateTime, isConfidence, isIsoDateTime } from './validation';

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
    const date = new Date('2023-01-01T12:00:00Z');
    expect(() => createIsoDateTime(date)).not.toThrow();
  });

  test('accepts canonical UTC ISO string', () => {
    expect(() => createIsoDateTime('2023-01-01T12:00:00Z')).not.toThrow();
  });

  test('rejects impossible date', () => {
    expect(() => createIsoDateTime('2023-02-30T00:00:00Z')).toThrow();
  });

  test('rejects noncanonical timezone input', () => {
    // Non-UTC timezone offset
    expect(() => createIsoDateTime('2023-01-01T12:00:00+05:00')).toThrow();
    // Not ending with Z
    expect(() => createIsoDateTime('2023-01-01T12:00:00')).toThrow();
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
    ['2023-01-01T12:00:00Z', true],
    ['2023-12-31T23:59:59.999Z', true],
    ['2020-02-29T00:00:00Z', true], // leap year
    ['2023-02-30T00:00:00Z', false], // invalid day
    ['2023-01-01T12:00:00', false], // missing Z
    ['2023-01-01T12:00:00+05:00', false], // timezone offset
    ['not-a-date', false],
    ['', false],
  ])('isIsoDateTime(%p) => %p', (value, expected) => {
    expect(isIsoDateTime(value)).toBe(expected);
  });
});