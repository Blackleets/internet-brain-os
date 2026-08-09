import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  InMemoryMemoryQuarantineRecommendationRepository,
  InMemoryMemoryRecoveryReviewRepository,
  MemoryFailurePreventionInputError,
  MemoryQuarantineEvaluationInputError,
  MemoryQuarantineRecommendationConflictError,
  MemoryRecoveryReviewConflictError,
  assessMemoryQuarantineRecommendationFreshness,
  assessMemoryRecoveryReviewFreshness,
  evaluateMemoryQuarantineSignals,
  evaluateRepeatedMemoryFailures,
  verifyMemoryQuarantineRecommendationIntegrity,
  verifyMemoryRecoveryReviewIntegrity,
} from './index';
import {
  buildReplayLabMemorySafetyView,
  ReplayLabMemorySafetyQueryService,
} from '../replay-lab';

const now = '2026-08-09T16:00:00.000Z' as IsoDateTime;

function quarantineRecommendation() {
  const result = evaluateMemoryQuarantineSignals({
    memoryId: 'memory:freeze',
    lifecycleRevision: 2,
    state: 'admitted',
    evaluatorVersion: 'quarantine-v1',
    evaluatedAt: now,
    references: { invalidEvidenceIds: ['evidence:1'] },
  });
  if (!result.recommendation) throw new Error('Expected quarantine recommendation fixture.');
  return result.recommendation;
}

function recoveryRequest() {
  return {
    terminalMemoryId: 'memory:terminal',
    terminalState: 'revoked' as const,
    terminalRevision: 4,
    requestId: 'recovery:freeze',
    requestedBy: { id: 'recovery:operator', type: 'recovery' as const },
    reviewer: { id: 'founder:1', type: 'founder' as const },
    policyVersion: 'memory-policy-v1',
    requiresFounderApproval: true,
    outcome: 'approved_new_candidate' as const,
    replacementCandidateMemoryId: 'memory:new-candidate',
    reason: 'New verified evidence.',
    occurredAt: now,
  };
}

describe('Memory Safety v1 adversarial contract freeze', () => {
  it('E1 fails closed with its typed boundary error for malformed runtime payloads', () => {
    for (const payload of [
      null,
      [],
      { memoryId: 42, lifecycleRevision: 1, state: 'admitted', evaluatorVersion: 'v1', evaluatedAt: now, references: {} },
      { memoryId: 'm', lifecycleRevision: 1, state: 'invented', evaluatorVersion: 'v1', evaluatedAt: now, references: {} },
      { memoryId: 'm', lifecycleRevision: 1, state: 'admitted', evaluatorVersion: 'v1', evaluatedAt: now, references: null },
      { memoryId: 'm', lifecycleRevision: 1, state: 'admitted', evaluatorVersion: 'v1', evaluatedAt: now, references: { invalidEvidenceIds: [123] } },
    ]) {
      expect(() => evaluateMemoryQuarantineSignals(payload as never))
        .toThrowError(MemoryQuarantineEvaluationInputError);
    }
  });

  it('E2 rejects malformed recommendation shapes with its typed boundary error', () => {
    const repository = new InMemoryMemoryQuarantineRecommendationRepository();
    const valid = quarantineRecommendation();
    for (const payload of [
      null,
      [],
      { ...valid, recommendationId: 123 },
      { ...valid, signals: null },
      { ...valid, signals: [null] },
      { ...valid, signals: [{ ...valid.signals[0], referenceIds: null }] },
      { ...valid, signals: [{ ...valid.signals[0], referenceIds: [123] }] },
    ]) {
      expect(() => repository.append(payload as never))
        .toThrowError(MemoryQuarantineRecommendationConflictError);
    }
  });

  it('E2 integrity verification never throws for untrusted durable data', () => {
    expect(() => verifyMemoryQuarantineRecommendationIntegrity(null as never)).not.toThrow();
    expect(verifyMemoryQuarantineRecommendationIntegrity(null as never)).toBe(false);
    expect(() => verifyMemoryQuarantineRecommendationIntegrity({} as never)).not.toThrow();
    expect(verifyMemoryQuarantineRecommendationIntegrity({} as never)).toBe(false);
  });

  it('E2 freshness fails closed on malformed current context', () => {
    const stored = new InMemoryMemoryQuarantineRecommendationRepository()
      .append(quarantineRecommendation()).recommendation;
    expect(() => assessMemoryQuarantineRecommendationFreshness(stored, null as never))
      .toThrowError(MemoryQuarantineRecommendationConflictError);
    expect(() => assessMemoryQuarantineRecommendationFreshness(stored, {
      currentLifecycleRevision: 2,
      currentEvaluatorVersion: 'quarantine-v1',
      currentSignals: null,
    } as never)).toThrowError(MemoryQuarantineRecommendationConflictError);
  });

  it('E3 rejects malformed review shapes and never grants automated recovery authority', () => {
    const repository = new InMemoryMemoryRecoveryReviewRepository();
    const valid = recoveryRequest();
    for (const payload of [
      null,
      [],
      { ...valid, outcome: 'auto_restore' },
      { ...valid, reviewer: null },
      { ...valid, reviewer: { id: 'agent:1', type: 'agent' } },
      { ...valid, replacementCandidateMemoryId: 123 },
      { ...valid, terminalMemoryId: 123 },
    ]) {
      expect(() => repository.append(payload as never))
        .toThrowError(MemoryRecoveryReviewConflictError);
    }
  });

  it('E3 integrity verification never throws for untrusted durable data', () => {
    expect(() => verifyMemoryRecoveryReviewIntegrity(null as never)).not.toThrow();
    expect(verifyMemoryRecoveryReviewIntegrity(null as never)).toBe(false);
    expect(() => verifyMemoryRecoveryReviewIntegrity({} as never)).not.toThrow();
    expect(verifyMemoryRecoveryReviewIntegrity({} as never)).toBe(false);
  });

  it('E3 freshness rejects malformed current context with the typed boundary error', () => {
    const record = new InMemoryMemoryRecoveryReviewRepository().append(recoveryRequest()).review;
    expect(() => assessMemoryRecoveryReviewFreshness(record, null as never))
      .toThrowError(MemoryRecoveryReviewConflictError);
    expect(() => assessMemoryRecoveryReviewFreshness(record, {
      terminalState: 'revoked', terminalRevision: 4, policyVersion: 123,
    } as never)).toThrowError(MemoryRecoveryReviewConflictError);
  });

  it('E4 remains fail-closed for malformed aggregate and nested runtime data', () => {
    for (const payload of [
      null,
      [],
      { evaluatedAt: now, failures: null, policy: { policyVersion: 'v1', threshold: 2, windowMs: 1000 } },
      { evaluatedAt: now, failures: [null], policy: { policyVersion: 'v1', threshold: 2, windowMs: 1000 } },
      { evaluatedAt: now, failures: [{ failureId: 1, memoryId: 'm', category: 'altered_replay', occurredAt: now, referenceIds: ['r'] }], policy: { policyVersion: 'v1', threshold: 2, windowMs: 1000 } },
    ]) {
      expect(() => evaluateRepeatedMemoryFailures(payload as never))
        .toThrowError(MemoryFailurePreventionInputError);
    }
  });

  it('E5 rejects malformed top-level operator input rather than leaking raw TypeError', () => {
    for (const payload of [
      null,
      [],
      { memoryId: 123, quarantine: [], recoveryReviews: [], prevention: [] },
      { memoryId: 'm', quarantine: null, recoveryReviews: [], prevention: [] },
      { memoryId: 'm', quarantine: [], recoveryReviews: null, prevention: [] },
      { memoryId: 'm', quarantine: [], recoveryReviews: [], prevention: null },
    ]) {
      expect(() => buildReplayLabMemorySafetyView(payload as never)).toThrow();
      try {
        buildReplayLabMemorySafetyView(payload as never);
      } catch (error) {
        expect(error).not.toBeInstanceOf(TypeError);
      }
    }
  });

  it('E5 query rejects malformed memory identity without invoking readers', async () => {
    let reads = 0;
    const reader = { list: async () => { reads += 1; return []; } };
    const service = new ReplayLabMemorySafetyQueryService({
      quarantine: reader,
      recoveryReviews: reader,
      prevention: reader,
    });
    await expect(service.getMemorySafety(123 as never)).rejects.toThrow();
    expect(reads).toBe(0);
  });

  it('E5 query implementation has no authority-writer dependency', () => {
    const source = readFileSync(
      new URL('../replay-lab/replay-lab-memory-safety-query-service.ts', import.meta.url),
      'utf8',
    );
    for (const forbidden of [
      'MemoryAuthorityTransitionService',
      'memory-authority-transition-service',
      '.append(',
      'approveRecovery',
      'setCapability',
      'changePolicy',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
