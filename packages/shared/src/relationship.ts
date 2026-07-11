// relationship.ts
import type { RelationshipId, EntityId, EvidenceId, VerificationStatus, Confidence, IsoDateTime } from './common';

export interface Relationship {
  readonly id: RelationshipId;
  readonly type: string;
  readonly sourceEntityId: EntityId;
  readonly targetEntityId: EntityId;
  readonly description?: string;
  readonly verificationStatus: VerificationStatus;
  readonly confidence: Confidence;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly evidenceIds: readonly EvidenceId[];
}