import { InvalidKnowledgeAdmissionInputError } from './knowledge-admission-errors';
import type {
  DurableClaim,
  KnowledgeAdmissionInput,
  KnowledgeAdmissionResult,
} from './knowledge-admission-types';

function cloneCandidate<T extends KnowledgeAdmissionInput['candidate']>(candidate: T): T {
  return {
    ...candidate,
    evidenceIds: [...candidate.evidenceIds],
    contradictsClaimIds: [...candidate.contradictsClaimIds],
  };
}

export class KnowledgeAdmissionGate {
  admit(input: KnowledgeAdmissionInput): KnowledgeAdmissionResult {
    const { candidate, contradiction, admittedAt } = input;
    if (contradiction.candidate.id !== candidate.id) {
      throw new InvalidKnowledgeAdmissionInputError(
        'Contradiction assessment does not belong to the supplied candidate.',
      );
    }

    const normalizedCandidate = cloneCandidate(candidate);
    const normalizedContradiction = {
      ...contradiction,
      candidate: cloneCandidate(contradiction.candidate),
      reasons: contradiction.reasons.map((reason) => ({ ...reason })),
      contradictsClaimIds: [...contradiction.contradictsClaimIds],
    };

    if (contradiction.action !== 'admit') {
      return {
        decision: contradiction.action === 'review' ? 'review' : 'blocked',
        candidate: normalizedCandidate,
        contradiction: normalizedContradiction,
        admittedAt,
      };
    }

    const claim: DurableClaim = {
      id: `claim:${candidate.id}`,
      sourceCandidateId: candidate.id,
      proposalId: candidate.proposalId,
      statement: candidate.statement,
      confidence: candidate.confidence,
      evidenceIds: [...candidate.evidenceIds],
      contradictsClaimIds: [...contradiction.contradictsClaimIds],
      status: 'active',
      verificationStatus: 'verified',
      admittedAt,
    };

    return {
      decision: 'admitted',
      candidate: normalizedCandidate,
      contradiction: normalizedContradiction,
      claim,
      admittedAt,
    };
  }
}
