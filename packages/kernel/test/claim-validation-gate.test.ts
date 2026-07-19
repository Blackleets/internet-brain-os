import { describe, expect, test } from 'vitest';
import type { EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import {
  ClaimValidationGate,
  InvalidClaimValidationInputError,
} from '../src';
import type {
  ClaimProposal,
  ClaimProposalId,
  MissionId,
  MissionTaskId,
} from '../src';

const now = '2026-07-19T21:00:00.000Z' as IsoDateTime;
const evidenceId = 'evidence-1' as EvidenceId;

function proposal(confidence = 0.9): ClaimProposal {
  return {
    id: 'proposal-1' as ClaimProposalId,
    missionId: 'mission-1' as MissionId,
    taskId: 'task-1' as MissionTaskId,
    statement: 'Supplier A lists a unit price.',
    confidence,
    evidenceIds: [evidenceId],
    status: 'proposed',
    createdAt: now,
  };
}

describe('ClaimValidationGate', () => {
  test('accepts a supported claim and creates a deterministic candidate', () => {
    const result = new ClaimValidationGate().evaluate(proposal(), {
      evidence: [{ evidenceId, exists: true, verified: true }],
      evaluatedAt: now,
    });

    expect(result.decision).toBe('accepted');
    expect(result.reasons).toEqual([]);
    expect(result.candidate).toMatchObject({
      id: 'claim-candidate:proposal-1',
      proposalId: 'proposal-1',
      status: 'candidate',
      evidenceIds: [evidenceId],
    });
  });

  test('rejects missing evidence', () => {
    const result = new ClaimValidationGate().evaluate(proposal(), {
      evidence: [{ evidenceId, exists: false, verified: false }],
      evaluatedAt: now,
    });

    expect(result.decision).toBe('rejected');
    expect(result.reasons.map((reason) => reason.code)).toContain('missing_evidence');
    expect(result.candidate).toBeUndefined();
  });

  test('routes unverified evidence and material contradictions to review', () => {
    const result = new ClaimValidationGate().evaluate(proposal(), {
      evidence: [{ evidenceId, exists: true, verified: false }],
      contradictions: [{ claimId: 'claim-existing', confidence: 0.8 }],
      evaluatedAt: now,
    });

    expect(result.decision).toBe('needs_review');
    expect(result.reasons.map((reason) => reason.code)).toEqual([
      'unverified_evidence',
      'material_contradiction',
    ]);
  });

  test('rejects confidence below the review floor', () => {
    const result = new ClaimValidationGate().evaluate(proposal(0.3), {
      evidence: [{ evidenceId, exists: true, verified: true }],
      evaluatedAt: now,
    });

    expect(result.decision).toBe('rejected');
    expect(result.reasons[0]?.code).toBe('low_confidence');
  });

  test('routes intermediate confidence to review', () => {
    const result = new ClaimValidationGate().evaluate(proposal(0.6), {
      evidence: [{ evidenceId, exists: true, verified: true }],
      evaluatedAt: now,
    });

    expect(result.decision).toBe('needs_review');
    expect(result.reasons[0]?.code).toBe('low_confidence');
  });

  test('rejects duplicate evidence assessments and invalid policy ordering', () => {
    expect(() =>
      new ClaimValidationGate().evaluate(proposal(), {
        evidence: [
          { evidenceId, exists: true, verified: true },
          { evidenceId, exists: true, verified: true },
        ],
        evaluatedAt: now,
      }),
    ).toThrow(InvalidClaimValidationInputError);

    expect(() =>
      new ClaimValidationGate({
        minimumReviewConfidence: 0.9,
        minimumAcceptedConfidence: 0.8,
      }),
    ).toThrow(InvalidClaimValidationInputError);
  });

  test('does not expose mutable proposal evidence arrays', () => {
    const mutableEvidence = [evidenceId];
    const input = { ...proposal(), evidenceIds: mutableEvidence };
    const result = new ClaimValidationGate().evaluate(input, {
      evidence: [{ evidenceId, exists: true, verified: true }],
      evaluatedAt: now,
    });

    mutableEvidence.push('evidence-2' as EvidenceId);
    expect(result.proposal.evidenceIds).toEqual([evidenceId]);
    expect(result.candidate?.evidenceIds).toEqual([evidenceId]);
  });
});
