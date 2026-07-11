// entity.ts
import type { EntityId, EvidenceId, VerificationStatus, Confidence, IsoDateTime } from './common';

export interface Entity {
  readonly id: EntityId;
  readonly type: string;
  readonly name: string;
  readonly description?: string;
  readonly aliases?: readonly string[];
  readonly properties: Readonly<Record<string, unknown>>;
  readonly verificationStatus: VerificationStatus;
  readonly confidence: Confidence;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly evidenceIds: readonly EvidenceId[];
}