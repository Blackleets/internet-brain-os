import type { EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import type { ContradictionAssessmentResult } from './contradiction-types';
import type { ValidatedClaimCandidate } from './claim-validation-types';

export type KnowledgeAdmissionDecision = 'admitted' | 'review' | 'blocked';

export interface DurableClaim {
  readonly id: string;
  readonly sourceCandidateId: string;
  readonly proposalId: string;
  readonly statement: string;
  readonly confidence: number;
  readonly evidenceIds: readonly EvidenceId[];
  readonly contradictsClaimIds: readonly string[];
  readonly status: 'active';
  readonly verificationStatus: 'verified';
  readonly admittedAt: IsoDateTime;
}

export interface KnowledgeAdmissionInput {
  readonly candidate: ValidatedClaimCandidate;
  readonly contradiction: ContradictionAssessmentResult;
  readonly admittedAt: IsoDateTime;
}

export interface KnowledgeAdmissionResult {
  readonly decision: KnowledgeAdmissionDecision;
  readonly candidate: ValidatedClaimCandidate;
  readonly contradiction: ContradictionAssessmentResult;
  readonly claim?: DurableClaim;
  readonly admittedAt: IsoDateTime;
}
