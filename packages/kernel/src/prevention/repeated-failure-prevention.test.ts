import { describe, expect, it } from 'vitest';
import type { ExecutionRecord } from '../execution/execution-contract';
import type { CognitivePipelineRecord } from '../storage/cognitive-pipeline-types';
import {
  failureReferencesFromExecutions,
  failureReferencesFromPipelines,
  RepeatedFailurePreventionEvaluator,
  type PersistedFailureReference,
} from './repeated-failure-prevention';

const evaluator = new RepeatedFailurePreventionEvaluator({
  windowMs: 60_000,
  threshold: 3,
  evaluatorVersion: 'prevention-v1',
});

function failure(referenceId: string, occurredAt: string, overrides: Partial<PersistedFailureReference> = {}): PersistedFailureReference {
  return {
    referenceId,
    kind: 'validation',
    code: 'missing_evidence',
    scope: 'claim-validation',
    occurredAt,
    ...overrides,
  };
}

describe('RepeatedFailurePreventionEvaluator', () => {
  it('emits one deterministic read-only recommendation after the configured threshold', () => {
    const input = [
      failure('pipeline:3:validation:missing_evidence', '2026-08-09T13:00:30.000Z'),
      failure('pipeline:1:validation:missing_evidence', '2026-08-09T13:00:10.000Z'),
      failure('pipeline:2:validation:missing_evidence', '2026-08-09T13:00:20.000Z'),
    ];

    const forward = evaluator.evaluate(input, '2026-08-09T13:01:00.000Z');
    const reversed = evaluator.evaluate([...input].reverse(), '2026-08-09T13:01:00.000Z');

    expect(forward).toEqual(reversed);
    expect(forward).toHaveLength(1);
    expect(forward[0]).toMatchObject({
      kind: 'validation',
      code: 'missing_evidence',
      scope: 'claim-validation',
      occurrenceCount: 3,
      action: 'review_evidence_quality',
      referenceIds: [
        'pipeline:1:validation:missing_evidence',
        'pipeline:2:validation:missing_evidence',
        'pipeline:3:validation:missing_evidence',
      ],
    });
    expect(Object.keys(forward[0] ?? {})).not.toContain('execute');
    expect(Object.keys(forward[0] ?? {})).not.toContain('mutation');
  });

  it('does not recommend below threshold or from failures outside the bounded window', () => {
    const input = [
      failure('old', '2026-08-09T12:59:00.000Z'),
      failure('recent-1', '2026-08-09T13:00:30.000Z'),
      failure('recent-2', '2026-08-09T13:00:40.000Z'),
    ];
    expect(evaluator.evaluate(input, '2026-08-09T13:01:00.000Z')).toEqual([]);
  });

  it('deduplicates exact replay and rejects altered replay for the same persisted reference ID', () => {
    const one = failure('same', '2026-08-09T13:00:10.000Z');
    expect(evaluator.evaluate([one, { ...one }, failure('two', '2026-08-09T13:00:20.000Z'), failure('three', '2026-08-09T13:00:30.000Z')], '2026-08-09T13:01:00.000Z')[0]?.occurrenceCount).toBe(3);

    expect(() => evaluator.evaluate([
      one,
      { ...one, code: 'low_confidence' },
      failure('two', '2026-08-09T13:00:20.000Z'),
    ], '2026-08-09T13:01:00.000Z')).toThrow(/altered failure replay/);
  });

  it('marks a recommendation stale when its evaluator or cited failure basis changes', () => {
    const input = [
      failure('one', '2026-08-09T13:00:10.000Z'),
      failure('two', '2026-08-09T13:00:20.000Z'),
      failure('three', '2026-08-09T13:00:30.000Z'),
    ];
    const recommendation = evaluator.evaluate(input, '2026-08-09T13:01:00.000Z')[0]!;
    expect(evaluator.assessFreshness(recommendation, input)).toEqual({ status: 'current', reasons: [] });
    expect(evaluator.assessFreshness(recommendation, input.slice(0, 2))).toEqual({
      status: 'stale',
      reasons: ['failure_basis_changed'],
    });

    const nextEvaluator = new RepeatedFailurePreventionEvaluator({ windowMs: 60_000, threshold: 3, evaluatorVersion: 'prevention-v2' });
    expect(nextEvaluator.assessFreshness(recommendation, input)).toEqual({
      status: 'stale',
      reasons: ['evaluator_version_changed'],
    });
  });

  it('rejects invalid runtime inputs instead of trusting TypeScript types', () => {
    expect(() => new RepeatedFailurePreventionEvaluator({ windowMs: 0, threshold: 3, evaluatorVersion: 'v1' })).toThrow();
    expect(() => evaluator.evaluate([{ ...failure('bad', '2026-08-09T13:00:00.000Z'), kind: 'agent_intent' as never }], '2026-08-09T13:01:00.000Z')).toThrow(/kind/);
    expect(() => evaluator.evaluate([failure('bad-date', 'not-a-date')], '2026-08-09T13:01:00.000Z')).toThrow(/timestamp/);
  });
});

describe('persisted failure projections', () => {
  it('uses only the latest reconciled failed execution record and cites its exact persisted identity', () => {
    const base: ExecutionRecord = {
      executionId: 'execution:abc', sequence: 1, planId: 'plan:1', revisionId: 'rev:1', capabilityId: 'web.read',
      idempotencyKey: 'key', requestHash: 'hash', status: 'reserved', reservedAt: '2026-08-09T13:00:00.000Z', actor: 'kernel',
    };
    const records: ExecutionRecord[] = [
      base,
      { ...base, sequence: 2, status: 'in_doubt' },
      { ...base, sequence: 3, status: 'failed', failedAt: '2026-08-09T13:00:30.000Z', failureCode: 'upstream_timeout' },
    ];
    expect(failureReferencesFromExecutions(records)).toEqual([{
      referenceId: 'execution:abc#3', kind: 'execution', code: 'upstream_timeout', scope: 'web.read', occurredAt: '2026-08-09T13:00:30.000Z',
    }]);
  });

  it('projects explicit validation/admission reason codes without inferring hidden intent', () => {
    const pipeline = {
      id: 'pipeline:1',
      validation: {
        decision: 'rejected',
        reasons: [{ code: 'missing_evidence', message: 'missing' }],
        evaluatedAt: '2026-08-09T13:00:10.000Z',
      },
      admission: {
        decision: 'blocked',
        contradiction: {
          reasons: [{ code: 'verified_material_conflict', message: 'conflict' }],
        },
        admittedAt: '2026-08-09T13:00:20.000Z',
      },
    } as unknown as CognitivePipelineRecord;

    expect(failureReferencesFromPipelines([pipeline])).toEqual([
      { referenceId: 'pipeline:1:validation:missing_evidence', kind: 'validation', code: 'missing_evidence', scope: 'claim-validation', occurredAt: '2026-08-09T13:00:10.000Z' },
      { referenceId: 'pipeline:1:admission:verified_material_conflict', kind: 'admission', code: 'verified_material_conflict', scope: 'knowledge-admission', occurredAt: '2026-08-09T13:00:20.000Z' },
    ]);
  });
});
