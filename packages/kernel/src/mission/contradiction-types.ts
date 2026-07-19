import type { IsoDateTime } from '@internet-brain-os/shared';
import type { ValidatedClaimCandidate } from './claim-validation-types';

export type ContradictionKind = 'none' | 'possible' | 'material';
export type ContradictionAction = 'admit' | 'review' | 'block';

export interface ExistingClaimSnapshot {
  readonly id: string;
  readonly statement: string;
  readonly confidence: number;
  readonly verificationStatus: 'unverified' | 'verified' | 'disputed' | 'rejected';
  readonly updatedAt: IsoDateTime;
}

export interface ContradictionComparison {
  readonly existingClaimId: string;
  readonly kind: ContradictionKind;
  readonly confidence: number;
  readonly rationale?: string;
}

export interface ContradictionPolicy {
  readonly possibleThreshold: number;
  readonly materialThreshold: number;
  readonly blockVerifiedMaterialConflicts: boolean;
}

export interface ContradictionReason {
  readonly code:
    | 'no_conflict'
    | 'possible_conflict'
    | 'material_conflict'
    | 'verified_material_conflict';
  readonly message: string;
  readonly claimId?: string;
}

export interface ContradictionAssessmentResult {
  readonly candidate: ValidatedClaimCandidate;
  readonly action: ContradictionAction;
  readonly reasons: readonly ContradictionReason[];
  readonly contradictsClaimIds: readonly string[];
  readonly evaluatedAt: IsoDateTime;
}

export interface ContradictionEvaluationInput {
  readonly candidate: ValidatedClaimCandidate;
  readonly existingClaims: readonly ExistingClaimSnapshot[];
  readonly comparisons: readonly ContradictionComparison[];
  readonly evaluatedAt: IsoDateTime;
}
