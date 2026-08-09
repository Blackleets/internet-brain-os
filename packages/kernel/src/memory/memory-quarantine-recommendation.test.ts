import { describe, expect, it } from 'vitest';
import { validateMemoryAuthorityTransition } from './memory-authority-lifecycle';
import {
  MemoryQuarantineRecommendationError,
  evaluateMemoryQuarantineRecommendation,
  isMemoryQuarantineRecommendationStale,
  verifyMemoryQuarantineRecommendationIntegrity,
  type PersistedMemoryQuarantineSignal,
} from './memory-quarantine-recommendation';

function signal(
  overrides: Partial<PersistedMemoryQuarantineSignal> = {},
): PersistedMemoryQuarantineSignal {
  return {
    signalId: 'signal-1',
    memoryId: 'memory-1',
    lifecycleRevision: 2,
    type: 'unresolved_contradiction',
    severity: 'high',
    referenceIds: ['contradiction-2', 'contradiction-1'],
    evaluatorVersion: 'quarantine-evaluator-v1',
    observedAt: '2026-08-09T10:00:00.000Z',
    ...overrides,
  };
}

function recommended(signals: readonly PersistedMemoryQuarantineSignal[] = [signal()]) {
  const result = evaluateMemoryQuarantineRecommendation({
    memoryId: 'memory-1',
    lifecycleRevision: 2,
    state: 'admitted',
    signals,
    evaluatorVersion: 'quarantine-evaluator-v1',
  });
  if (result.kind !== 'recommended') throw new Error('Expected a quarantine recommendation.');
  return result.recommendation;
}

describe('evaluateMemoryQuarantineRecommendation', () => {
  it('does not recommend quarantine without persisted deterministic signals', () => {
    expect(evaluateMemoryQuarantineRecommendation({
      memoryId: 'memory-1',
      lifecycleRevision: 2,
      state: 'admitted',
      signals: [],
      evaluatorVersion: 'quarantine-evaluator-v1',
    })).toEqual({ kind: 'not_recommended', reason: 'NO_PERSISTED_SIGNALS' });
  });

  it.each(['quarantined', 'rejected', 'superseded', 'revoked'] as const)(
    'does not create a recommendation for lifecycle state %s',
    (state) => {
      expect(evaluateMemoryQuarantineRecommendation({
        memoryId: 'memory-1',
        lifecycleRevision: 2,
        state,
        signals: [signal()],
        evaluatorVersion: 'quarantine-evaluator-v1',
      })).toEqual({ kind: 'not_recommended', reason: 'STATE_NOT_ELIGIBLE' });
    },
  );

  it('creates the same recommendation identity regardless of signal and reference ordering', () => {
    const first = recommended([
      signal({ signalId: 'signal-b', observedAt: '2026-08-09T11:00:00Z' }),
      signal({
        signalId: 'signal-a',
        type: 'evidence_invalidation',
        referenceIds: ['evidence-2', 'evidence-1', 'evidence-1'],
        observedAt: '2026-08-09T09:00:00Z',
      }),
    ]);
    const replay = recommended([
      signal({
        signalId: ' signal-a ',
        type: 'evidence_invalidation',
        referenceIds: ['evidence-1', ' evidence-2 '],
        observedAt: '2026-08-09T09:00:00.000Z',
      }),
      signal({ signalId: ' signal-b ', observedAt: '2026-08-09T11:00:00.000Z' }),
    ]);

    expect(replay).toEqual(first);
    expect(first.signals.map((entry) => entry.signalId)).toEqual(['signal-a', 'signal-b']);
    expect(first.signals[0].referenceIds).toEqual(['evidence-1', 'evidence-2']);
    expect(first.recommendedAt).toBe('2026-08-09T11:00:00.000Z');
    expect(verifyMemoryQuarantineRecommendationIntegrity(first)).toBe(true);
  });

  it('deduplicates an exact persisted signal replay but rejects altered content under the same signal id', () => {
    const exact = recommended([signal(), signal({ referenceIds: ['contradiction-1', 'contradiction-2'] })]);
    expect(exact.signals).toHaveLength(1);

    expect(() => recommended([
      signal(),
      signal({ severity: 'critical' }),
    ])).toThrowError(expect.objectContaining({ code: 'ALTERED_SIGNAL_REPLAY' }));
  });

  it('rejects signals for another memory or lifecycle revision and requires persisted references', () => {
    expect(() => recommended([signal({ memoryId: 'memory-2' })]))
      .toThrowError(expect.objectContaining({ code: 'SIGNAL_MEMORY_MISMATCH' }));
    expect(() => recommended([signal({ lifecycleRevision: 3 })]))
      .toThrowError(expect.objectContaining({ code: 'SIGNAL_REVISION_MISMATCH' }));
    expect(() => recommended([signal({ referenceIds: [] })]))
      .toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(() => recommended([signal({ observedAt: 'not-a-date' })]))
      .toThrowError(MemoryQuarantineRecommendationError);
  });

  it('detects tampering and staleness without changing lifecycle authority', () => {
    const recommendation = recommended();
    expect(verifyMemoryQuarantineRecommendationIntegrity({
      ...recommendation,
      evaluatorVersion: 'tampered',
    })).toBe(false);

    expect(isMemoryQuarantineRecommendationStale(recommendation, {
      lifecycleRevision: 2,
      state: 'admitted',
    })).toBe(false);
    expect(isMemoryQuarantineRecommendationStale(recommendation, {
      lifecycleRevision: 3,
      state: 'admitted',
    })).toBe(true);
    expect(isMemoryQuarantineRecommendationStale(recommendation, {
      lifecycleRevision: 2,
      state: 'quarantined',
    })).toBe(true);
  });

  it('does not let a recommendation substitute for the persisted quarantine signal gate', () => {
    const recommendation = recommended();
    expect(recommendation.status).toBe('pending');

    expect(validateMemoryAuthorityTransition({
      from: 'admitted',
      to: 'quarantined',
      executor: { id: 'kernel-1', type: 'kernel' },
      policyVersion: 'memory-policy-v1',
      hasPersistedQuarantineSignal: false,
    })).toEqual(expect.objectContaining({
      ok: false,
      failureCode: 'MISSING_QUARANTINE_SIGNAL',
    }));

    expect(validateMemoryAuthorityTransition({
      from: 'admitted',
      to: 'quarantined',
      executor: { id: 'kernel-1', type: 'kernel' },
      policyVersion: 'memory-policy-v1',
      hasPersistedQuarantineSignal: true,
    })).toEqual({ ok: true });
  });
});
