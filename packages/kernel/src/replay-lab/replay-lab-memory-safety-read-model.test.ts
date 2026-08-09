import { describe, expect, it, vi } from 'vitest';
import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  InMemoryMemoryQuarantineRecommendationRepository,
  InMemoryMemoryRecoveryReviewRepository,
  assessMemoryQuarantineRecommendationFreshness,
  assessMemoryRecoveryReviewFreshness,
  evaluateMemoryQuarantineSignals,
  evaluateRepeatedMemoryFailures,
} from '../memory';
import {
  buildReplayLabMemorySafetyView,
  type ReplayLabMemorySafetyViewInput,
} from './replay-lab-memory-safety-read-model';
import { ReplayLabMemorySafetyQueryService } from './replay-lab-memory-safety-query-service';

const now = '2026-08-09T15:00:00.000Z' as IsoDateTime;

function fixture(): ReplayLabMemorySafetyViewInput {
  const quarantineResult = evaluateMemoryQuarantineSignals({
    memoryId: 'memory:alpha',
    lifecycleRevision: 4,
    state: 'admitted',
    evaluatorVersion: 'quarantine-v1',
    evaluatedAt: now,
    references: { invalidEvidenceIds: ['evidence:1'] },
  });
  if (!quarantineResult.recommendation) throw new Error('Missing quarantine fixture.');
  const quarantineRecord = new InMemoryMemoryQuarantineRecommendationRepository()
    .append(quarantineResult.recommendation).recommendation;

  const recoveryRecord = new InMemoryMemoryRecoveryReviewRepository().append({
    terminalMemoryId: 'memory:alpha',
    terminalState: 'revoked',
    terminalRevision: 6,
    requestId: 'recovery:1',
    requestedBy: { id: 'recovery:operator', type: 'recovery' },
    reviewer: { id: 'founder:1', type: 'founder' },
    policyVersion: 'memory-policy-v1',
    requiresFounderApproval: true,
    outcome: 'approved_new_candidate',
    replacementCandidateMemoryId: 'memory:alpha:new',
    reason: 'New verified evidence.',
    occurredAt: now,
  }).review;

  const prevention = evaluateRepeatedMemoryFailures({
    evaluatedAt: now,
    failures: [
      { failureId: 'f1', memoryId: 'memory:alpha', category: 'altered_replay', occurredAt: '2026-08-09T14:10:00.000Z' as IsoDateTime, referenceIds: ['event:1'] },
      { failureId: 'f2', memoryId: 'memory:alpha', category: 'altered_replay', occurredAt: '2026-08-09T14:20:00.000Z' as IsoDateTime, referenceIds: ['event:2'] },
    ],
    policy: { policyVersion: 'prevention-v1', threshold: 2, windowMs: 60 * 60 * 1000 },
  }).recommendations[0];

  return {
    memoryId: 'memory:alpha',
    quarantine: [{
      record: quarantineRecord,
      freshness: assessMemoryQuarantineRecommendationFreshness(quarantineRecord, {
        currentLifecycleRevision: 4,
        currentEvaluatorVersion: 'quarantine-v1',
        currentSignals: quarantineRecord.signals,
      }),
    }],
    recoveryReviews: [{
      record: recoveryRecord,
      freshness: assessMemoryRecoveryReviewFreshness(recoveryRecord, {
        terminalState: 'superseded',
        terminalRevision: 7,
        policyVersion: 'memory-policy-v2',
      }),
    }],
    prevention: [{ recommendation: prevention, stale: false }],
  };
}

describe('Replay Lab memory safety read model', () => {
  it('separates persisted records, human decisions and deterministic interpretations', () => {
    const view = buildReplayLabMemorySafetyView(fixture());

    expect(view.quarantine[0]).toEqual(expect.objectContaining({
      basis: 'persisted_record',
      authority: 'read_only',
      freshness: 'current',
    }));
    expect(view.quarantine[0].references).toEqual([
      { id: 'evidence:1', kind: 'signal_reference' },
    ]);

    expect(view.recoveryReviews[0]).toEqual(expect.objectContaining({
      basis: 'human_decision',
      authority: 'read_only',
      freshness: 'stale',
      replacementCandidateMemoryId: 'memory:alpha:new',
    }));
    expect(view.recoveryReviews[0].staleReasons).toEqual([
      'terminal_state_changed',
      'terminal_revision_changed',
      'policy_version_changed',
    ]);

    expect(view.prevention[0]).toEqual(expect.objectContaining({
      basis: 'deterministic_projection',
      authority: 'read_only',
      freshness: 'current',
      category: 'altered_replay',
    }));
    expect(view.prevention[0].references).toEqual([
      { id: 'f1', kind: 'failure' },
      { id: 'f2', kind: 'failure' },
      { id: 'event:1', kind: 'persisted_reference' },
      { id: 'event:2', kind: 'persisted_reference' },
    ]);
    expect(view.authorityBoundary.status).toBe('read_only');
    expect(view.warnings).toEqual([
      '1 memory-safety record(s) are historical/stale and must not be treated as current authorization.',
    ]);
  });

  it('filters records that belong to another memory identity', () => {
    const input = fixture();
    const view = buildReplayLabMemorySafetyView({ ...input, memoryId: 'memory:other' });
    expect(view.quarantine).toEqual([]);
    expect(view.recoveryReviews).toEqual([]);
    expect(view.prevention).toEqual([]);
  });

  it('exposes no mutation command in the serialized operator view', () => {
    const json = JSON.stringify(buildReplayLabMemorySafetyView(fixture()));
    expect(json).not.toContain('transitionMemory');
    expect(json).not.toContain('approveRecovery');
    expect(json).not.toContain('changePolicy');
    expect(json).not.toContain('setCapability');
  });

  it('query service uses read-only list dependencies and projects one memory view', async () => {
    const input = fixture();
    const quarantine = { list: vi.fn(async () => input.quarantine) };
    const recoveryReviews = { list: vi.fn(async () => input.recoveryReviews) };
    const prevention = { list: vi.fn(async () => input.prevention) };
    const service = new ReplayLabMemorySafetyQueryService({ quarantine, recoveryReviews, prevention });

    const view = await service.getMemorySafety(' memory:alpha ');
    expect(view.memoryId).toBe('memory:alpha');
    expect(quarantine.list).toHaveBeenCalledWith('memory:alpha');
    expect(recoveryReviews.list).toHaveBeenCalledWith('memory:alpha');
    expect(prevention.list).toHaveBeenCalledWith('memory:alpha');
  });
});
