import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  MemoryQuarantineEvaluationInputError,
  evaluateMemoryQuarantineSignals,
  type MemoryQuarantineEvaluationInput,
} from './memory-quarantine-signal-evaluator';

const evaluatedAt = '2026-08-09T13:00:00.000Z' as IsoDateTime;

function makeInput(
  overrides: Partial<MemoryQuarantineEvaluationInput> = {},
): MemoryQuarantineEvaluationInput {
  return {
    memoryId: 'memory:alpha',
    lifecycleRevision: 3,
    state: 'admitted',
    evaluatorVersion: 'quarantine-v1',
    evaluatedAt,
    references: {},
    ...overrides,
  };
}

describe('evaluateMemoryQuarantineSignals', () => {
  it('returns no action when persisted risk references are absent', () => {
    expect(evaluateMemoryQuarantineSignals(makeInput())).toEqual({ decision: 'no_action', signals: [] });
  });

  it('produces deterministic sorted signals and recommendation identity', () => {
    const first = evaluateMemoryQuarantineSignals(makeInput({
      references: {
        invalidEvidenceIds: ['evidence:2', 'evidence:1', 'evidence:2'],
        unresolvedContradictionDecisionIds: ['contradiction:2', 'contradiction:1'],
        policyViolationRecordIds: ['policy:1'],
      },
    }));
    const second = evaluateMemoryQuarantineSignals(makeInput({
      references: {
        policyViolationRecordIds: ['policy:1'],
        unresolvedContradictionDecisionIds: ['contradiction:1', 'contradiction:2'],
        invalidEvidenceIds: ['evidence:1', 'evidence:2'],
      },
    }));

    expect(first.decision).toBe('recommend_quarantine');
    expect(first.recommendation?.recommendationId).toBe(second.recommendation?.recommendationId);
    expect(first.signals).toEqual([
      { type: 'unresolved_contradiction', severity: 'high', referenceIds: ['contradiction:1', 'contradiction:2'] },
      { type: 'evidence_invalidation', severity: 'critical', referenceIds: ['evidence:1', 'evidence:2'] },
      { type: 'policy_violation', severity: 'critical', referenceIds: ['policy:1'] },
    ]);
  });

  it('keeps an already quarantined memory isolated without creating transition authority', () => {
    const result = evaluateMemoryQuarantineSignals(makeInput({
      state: 'quarantined',
      references: { missingProvenanceReferenceIds: ['evidence:missing'] },
    }));

    expect(result.decision).toBe('retain_quarantine');
    expect(result.recommendation).toEqual(expect.objectContaining({
      status: 'pending',
      decision: 'retain_quarantine',
      memoryId: 'memory:alpha',
      lifecycleRevision: 3,
    }));
  });

  it.each(['rejected', 'superseded', 'revoked'] as const)(
    'never recommends a normal quarantine transition for terminal state %s',
    (state) => {
      const result = evaluateMemoryQuarantineSignals(makeInput({
        state,
        references: { admissionInconsistencyRecordIds: ['admission:bad'] },
      }));
      expect(result.decision).toBe('terminal_no_action');
      expect(result.recommendation).toBeUndefined();
      expect(result.signals).toHaveLength(1);
    },
  );

  it('covers each designed persisted signal class without accepting free-form model judgment', () => {
    const result = evaluateMemoryQuarantineSignals(makeInput({
      references: {
        unresolvedContradictionDecisionIds: ['contradiction:1'],
        invalidEvidenceIds: ['evidence:1'],
        missingProvenanceReferenceIds: ['provenance:1'],
        sourceIntegrityRiskRecordIds: ['source-risk:1'],
        admissionInconsistencyRecordIds: ['admission:1'],
        policyViolationRecordIds: ['policy:1'],
        supersessionConflictRecordIds: ['supersession:1'],
      },
    }));

    expect(result.signals.map((signal) => signal.type)).toEqual([
      'unresolved_contradiction',
      'evidence_invalidation',
      'provenance_gap',
      'source_integrity_risk',
      'admission_inconsistency',
      'policy_violation',
      'supersession_conflict',
    ]);
  });

  it('fails closed on malformed persisted reference ids', () => {
    expect(() => evaluateMemoryQuarantineSignals(makeInput({
      references: { invalidEvidenceIds: ['evidence:1', '   '] },
    }))).toThrowError(MemoryQuarantineEvaluationInputError);

    try {
      evaluateMemoryQuarantineSignals(makeInput({ references: { invalidEvidenceIds: [''] } }));
    } catch (error) {
      expect(error).toBeInstanceOf(MemoryQuarantineEvaluationInputError);
      expect((error as MemoryQuarantineEvaluationInputError).code).toBe('INVALID_REFERENCE_ID');
    }
  });

  it('rejects invalid identity, revision, evaluator and evaluation time metadata', () => {
    expect(() => evaluateMemoryQuarantineSignals(makeInput({ memoryId: '  ' })))
      .toThrowError(MemoryQuarantineEvaluationInputError);
    expect(() => evaluateMemoryQuarantineSignals(makeInput({ lifecycleRevision: -1 })))
      .toThrowError(MemoryQuarantineEvaluationInputError);
    expect(() => evaluateMemoryQuarantineSignals(makeInput({ evaluatorVersion: '' })))
      .toThrowError(MemoryQuarantineEvaluationInputError);

    try {
      evaluateMemoryQuarantineSignals(makeInput({ evaluatedAt: 'not-a-date' as IsoDateTime }));
    } catch (error) {
      expect(error).toBeInstanceOf(MemoryQuarantineEvaluationInputError);
      expect((error as MemoryQuarantineEvaluationInputError).code).toBe('INVALID_EVALUATED_AT');
    }
  });
});
