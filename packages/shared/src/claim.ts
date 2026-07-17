import type { ClaimId, Confidence, EntityId, EvidenceId, IsoDateTime, VerificationStatus } from './common';

export type ClaimStatus = 'observed' | 'reported' | 'inferred' | 'hypothesized' | 'confirmed' | 'rejected';

export interface Claim {
  readonly id: ClaimId;
  readonly statement: string;
  readonly status: ClaimStatus;
  readonly subjectEntityId?: EntityId;
  readonly objectEntityId?: EntityId;
  readonly confidence: Confidence;
  readonly verificationStatus: VerificationStatus;
  readonly evidenceIds: readonly EvidenceId[];
  readonly contradictsClaimIds: readonly ClaimId[];
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}
