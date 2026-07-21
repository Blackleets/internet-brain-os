import type { EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import type { ClaimProposal, ClaimProposalId } from './task-result-types';

export type ClaimValidationDecision = 'accepted' | 'rejected' | 'needs_review';
export type ClaimValidationReasonCode =
  | 'missing_evidence'
  | 'insufficient_evidence'
  | 'unverified_evidence'
  | 'low_confidence'
  | 'material_contradiction';

export interface ClaimEvidenceAssessment {
  readonly evidenceId: EvidenceId;
  readonly exists: boolean;
  readonly verified: boolean;
}

export interface ClaimContradictionAssessment {
  readonly claimId: string;
  readonly confidence: number;
}

export interface ClaimValidationContext {
  readonly evidence: readonly ClaimEvidenceAssessment[];
  readonly contradictions?: readonly ClaimContradictionAssessment[];
  readonly evaluatedAt: IsoDateTime;
}

export interface ClaimValidationPolicy {
  readonly minimumEvidenceCount: number;
  readonly minimumAcceptedConfidence: number;
  readonly minimumReviewConfidence: number;
  readonly materialContradictionConfidence: number;
  readonly requireVerifiedEvidence: boolean;
}

export interface ClaimValidationReason {
  readonly code: ClaimValidationReasonCode;
  readonly message: string;
}

export interface ValidatedClaimCandidate {
  readonly id: string;
  readonly proposalId: ClaimProposalId;
  readonly statement: string;
  readonly confidence: number;
  readonly evidenceIds: readonly EvidenceId[];
  readonly contradictsClaimIds: readonly string[];
  readonly status: 'candidate';
  readonly createdAt: IsoDateTime;
}

export interface ClaimValidationResult {
  readonly proposal: ClaimProposal;
  readonly decision: ClaimValidationDecision;
  readonly reasons: readonly ClaimValidationReason[];
  readonly candidate?: ValidatedClaimCandidate;
  readonly evaluatedAt: IsoDateTime;
}
