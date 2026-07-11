// public-api.test.ts
import { describe, expect, test } from 'vitest';
import { createConfidence, createIsoDateTime, isConfidence, isIsoDateTime } from '../src/index';
import type { Case, Evidence, Report, SkillDefinition, LLMRequest } from '../src/index';

describe('Public API smoke test', () => {
  test('exported functions are functions', () => {
    expect(typeof createConfidence).toBe('function');
    expect(typeof createIsoDateTime).toBe('function');
    expect(typeof isConfidence).toBe('function');
    expect(typeof isIsoDateTime).toBe('function');
  });
});