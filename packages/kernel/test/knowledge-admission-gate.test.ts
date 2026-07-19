import { describe, expect, test } from 'vitest';
import type { EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import {
  InvalidKnowledgeAdmissionInputError,
  KnowledgeAdmissionGate,
} from '../src';
import type {
  ClaimProposalId,
  ContradictionAssessmentResult,
  ValidatedClaimCandidate,
} from '../src';

const now = '2026-07-19T21:00:00.000Z' as IsoDateTime;
const evidenceId = 'evidence-1' as EvidenceId;

function candidate(id = 'candidate-1'): ValidatedClaimCandidate {
  return {
    id,
    proposalId: 'proposal-1' as ClaimProposalId,
    statement: 'Supplier A lists a unit price.',
    confidence: 0.9,
    evidenceIds: [evidenceId],
    contradictsClaimIds: [],
    status: 'candidate',
    createdAt: now,
  };
}

function contradiction(
  action: 'admit' | 'review' | 'block',
  source = candidate(),
): ContradictionAssessmentResult {
  return {
    candidate: source,
    action,
    reasons: [
      {
        code: action === 'admit' ? 'no_conflict' : 'material_conflict',
        message: action === 'admit' ? 'No conflict.' : 'Conflict requires control.',
      },
    ],
    contradictsClaimIds: action === 'admit' ? [] : ['claim-old'],
    evaluatedAt: now,
  };
}

describe('KnowledgeAdmissionGate', () => {
  test('creates a durable verified claim only for admitted candidates', () => {
    const source = candidate();
    const result = new KnowledgeAdmissionGate().admit({
      candidate: source,
      contradiction: contradiction('admit', source),
      admittedAt: now,
    });

    expect(result.decision).toBe('admitted');
    expect(result.claim).toMatchObject({
      id: 'claim:candidate-1',
      sourceCandidateId: 'candidate-1',
      status: 'active',
      verificationStatus: 'verified',
      evidenceIds: [evidenceId],
    });
  });

  test.each([
    ['review', 'review'],
    ['block', 'blocked'],
  ] as const)('does not create knowledge for %s assessments', (action, decision) => {
    const source = candidate();
    const result = new KnowledgeAdmissionGate().admit({
      candidate: source,
      contradiction: contradiction(action, source),
      admittedAt: now,
    });

    expect(result.decision).toBe(decision);
    expect(result.claim).toBeUndefined();
  });

  test('rejects contradiction assessments belonging to another candidate', () => {
    expect(() =>
      new KnowledgeAdmissionGate().admit({
        candidate: candidate('candidate-1'),
        contradiction: contradiction('admit', candidate('candidate-2')),
        admittedAt: now,
      }),
    ).toThrow(InvalidKnowledgeAdmissionInputError);
  });

  test('does not expose mutable input arrays', () => {
    const source = candidate();
    const assessment = contradiction('admit', source);
    const result = new KnowledgeAdmissionGate().admit({
      candidate: source,
      contradiction: assessment,
      admittedAt: now,
    });

    (source.evidenceIds as EvidenceId[]).push('later' as EvidenceId);
    expect(result.claim?.evidenceIds).toEqual([evidenceId]);
  });
});
