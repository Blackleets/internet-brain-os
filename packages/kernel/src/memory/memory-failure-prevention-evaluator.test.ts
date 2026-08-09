import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  MemoryFailurePreventionInputError,
  evaluateRepeatedMemoryFailures,
  isMemoryFailurePreventionRecommendationStale,
  type PersistedMemoryFailureRecord,
} from './memory-failure-prevention-evaluator';

const evaluatedAt = '2026-08-09T15:00:00.000Z' as IsoDateTime;

function failure(
  id: string,
  occurredAt: string,
  overrides: Partial<PersistedMemoryFailureRecord> = {},
): PersistedMemoryFailureRecord {
  return {
    failureId: id,
    memoryId: 'memory:alpha',
    category: 'altered_replay',
    occurredAt: occurredAt as IsoDateTime,
    referenceIds: [`event:${id}`],
    ...overrides,
  };
}

function evaluate(failures: readonly PersistedMemoryFailureRecord[]) {
  return evaluateRepeatedMemoryFailures({
    evaluatedAt,
    failures,
    policy: { policyVersion: 'prevention-v1', threshold: 3, windowMs: 60 * 60 * 1000 },
  });
}

describe('evaluateRepeatedMemoryFailures', () => {
  it('emits no recommendation below threshold', () => {
    expect(evaluate([
      failure('f1', '2026-08-09T14:10:00.000Z'),
      failure('f2', '2026-08-09T14:20:00.000Z'),
    ])).toEqual({ recommendations: [] });
  });

  it('emits a deterministic read-only recommendation at threshold', () => {
    const first = evaluate([
      failure('f3', '2026-08-09T14:30:00.000Z', { referenceIds: ['event:3', 'event:shared'] }),
      failure('f1', '2026-08-09T14:10:00.000Z', { referenceIds: ['event:1'] }),
      failure('f2', '2026-08-09T14:20:00.000Z', { referenceIds: ['event:2', 'event:shared'] }),
    ]).recommendations[0];
    const replay = evaluate([
      failure('f2', '2026-08-09T14:20:00.000Z', { referenceIds: ['event:shared', 'event:2'] }),
      failure('f3', '2026-08-09T14:30:00.000Z', { referenceIds: ['event:shared', 'event:3'] }),
      failure('f1', '2026-08-09T14:10:00.000Z', { referenceIds: ['event:1'] }),
      failure('f1', '2026-08-09T14:10:00.000Z', { referenceIds: ['event:1'] }),
    ]).recommendations[0];

    expect(first.recommendationId).toBe(replay.recommendationId);
    expect(first.authority).toBe('read_only');
    expect(first.recommendation).toBe('review_repeated_failure_pattern');
    expect(first.failureIds).toEqual(['f1', 'f2', 'f3']);
    expect(first.referenceIds).toEqual(['event:1', 'event:2', 'event:3', 'event:shared']);
  });

  it('excludes failures outside the bounded window and future records', () => {
    const result = evaluate([
      failure('old', '2026-08-09T13:59:59.999Z'),
      failure('f1', '2026-08-09T14:10:00.000Z'),
      failure('f2', '2026-08-09T14:20:00.000Z'),
      failure('future', '2026-08-09T15:00:00.001Z'),
    ]);
    expect(result.recommendations).toEqual([]);
  });

  it('separates categories and memory identities rather than blending unrelated failures', () => {
    const result = evaluate([
      failure('a1', '2026-08-09T14:10:00.000Z'),
      failure('a2', '2026-08-09T14:20:00.000Z'),
      failure('b1', '2026-08-09T14:30:00.000Z', { category: 'policy_denied' }),
      failure('b2', '2026-08-09T14:31:00.000Z', { category: 'policy_denied' }),
      failure('c1', '2026-08-09T14:40:00.000Z', { memoryId: 'memory:beta' }),
    ]);
    expect(result.recommendations).toEqual([]);
  });

  it('fails closed when one persisted failure id carries conflicting data', () => {
    expect(() => evaluate([
      failure('f1', '2026-08-09T14:10:00.000Z'),
      failure('f1', '2026-08-09T14:10:00.000Z', { category: 'policy_denied' }),
      failure('f2', '2026-08-09T14:20:00.000Z'),
      failure('f3', '2026-08-09T14:30:00.000Z'),
    ])).toThrowError(MemoryFailurePreventionInputError);
  });

  it('fails closed on malformed policy, timestamps, categories and references', () => {
    expect(() => evaluateRepeatedMemoryFailures({
      evaluatedAt,
      failures: [],
      policy: { policyVersion: 'v1', threshold: 1, windowMs: 1 },
    })).toThrowError(MemoryFailurePreventionInputError);
    expect(() => evaluate([failure('f1', 'bad-date')])).toThrowError(MemoryFailurePreventionInputError);
    expect(() => evaluate([failure('f1', '2026-08-09T14:10:00.000Z', { category: 'agent_was_bad' as never })]))
      .toThrowError(MemoryFailurePreventionInputError);
    expect(() => evaluate([failure('f1', '2026-08-09T14:10:00.000Z', { referenceIds: [''] })]))
      .toThrowError(MemoryFailurePreventionInputError);
  });

  it('rejects missing or non-string runtime identifiers instead of coercing them', () => {
    const malformedFailure = failure('f1', '2026-08-09T14:10:00.000Z') as unknown as Record<string, unknown>;
    malformedFailure.failureId = undefined;
    expect(() => evaluate([malformedFailure as unknown as PersistedMemoryFailureRecord]))
      .toThrowError(MemoryFailurePreventionInputError);

    const malformedMemory = failure('f2', '2026-08-09T14:20:00.000Z') as unknown as Record<string, unknown>;
    malformedMemory.memoryId = 42;
    expect(() => evaluate([malformedMemory as unknown as PersistedMemoryFailureRecord]))
      .toThrowError(MemoryFailurePreventionInputError);

    expect(() => evaluateRepeatedMemoryFailures({
      evaluatedAt,
      failures: [null as unknown as PersistedMemoryFailureRecord],
      policy: { policyVersion: 'prevention-v1', threshold: 3, windowMs: 60 * 60 * 1000 },
    })).toThrowError(MemoryFailurePreventionInputError);

    expect(() => evaluateRepeatedMemoryFailures({
      evaluatedAt,
      failures: [failure('f3', '2026-08-09T14:30:00.000Z', { referenceIds: undefined as never })],
      policy: { policyVersion: 'prevention-v1', threshold: 3, windowMs: 60 * 60 * 1000 },
    })).toThrowError(MemoryFailurePreventionInputError);
  });

  it('fails closed on malformed top-level runtime payloads', () => {
    expect(() => evaluateRepeatedMemoryFailures(null as unknown as Parameters<typeof evaluateRepeatedMemoryFailures>[0]))
      .toThrowError(MemoryFailurePreventionInputError);
    expect(() => evaluateRepeatedMemoryFailures({
      evaluatedAt,
      failures: [] as never,
      policy: null as never,
    })).toThrowError(MemoryFailurePreventionInputError);
    expect(() => evaluateRepeatedMemoryFailures({
      evaluatedAt,
      failures: null as never,
      policy: { policyVersion: 'prevention-v1', threshold: 3, windowMs: 60 * 60 * 1000 },
    })).toThrowError(MemoryFailurePreventionInputError);
  });

  it('marks recommendations stale when policy or active failure basis changes', () => {
    const recommendation = evaluate([
      failure('f1', '2026-08-09T14:10:00.000Z'),
      failure('f2', '2026-08-09T14:20:00.000Z'),
      failure('f3', '2026-08-09T14:30:00.000Z'),
    ]).recommendations[0];

    expect(isMemoryFailurePreventionRecommendationStale(recommendation, {
      policyVersion: 'prevention-v1', threshold: 3, windowMs: 60 * 60 * 1000,
      activeFailureIds: ['f3', 'f2', 'f1'],
    })).toBe(false);
    expect(isMemoryFailurePreventionRecommendationStale(recommendation, {
      policyVersion: 'prevention-v2', threshold: 3, windowMs: 60 * 60 * 1000,
      activeFailureIds: ['f1', 'f2', 'f3'],
    })).toBe(true);
    expect(isMemoryFailurePreventionRecommendationStale(recommendation, {
      policyVersion: 'prevention-v1', threshold: 3, windowMs: 60 * 60 * 1000,
      activeFailureIds: ['f1', 'f2'],
    })).toBe(true);
    expect(isMemoryFailurePreventionRecommendationStale(recommendation, {
      policyVersion: undefined as never, threshold: 3, windowMs: 60 * 60 * 1000,
      activeFailureIds: ['f1', 'f2', 'f3'],
    })).toBe(true);
    expect(isMemoryFailurePreventionRecommendationStale(recommendation, {
      policyVersion: 'prevention-v1', threshold: 3, windowMs: 60 * 60 * 1000,
      activeFailureIds: [undefined as never],
    })).toBe(true);
  });
});
