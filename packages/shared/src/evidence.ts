// evidence.ts
import type { CaseId, EvidenceId, EntityId, RelationshipId, Confidence, IsoDateTime } from './common';

export type EvidenceContentType =
  | 'webpage'
  | 'text'
  | 'pdf'
  | 'image'
  | 'manual'
  | 'api'
  | 'audio'
  | 'video'
  | 'other';

export interface Evidence {
  readonly id: EvidenceId;
  readonly caseId?: CaseId;
  readonly sourceUrl?: string;
  readonly contentType: EvidenceContentType;
  readonly mimeType?: string;
  readonly contentRef?: string;
  readonly contentHash?: string;
  readonly rawText?: string;
  readonly summary?: string;
  readonly capturedAt: IsoDateTime;
  readonly extractionMethod?: string;
  readonly selector?: string;
  readonly confidence: Confidence;
  readonly tags: readonly string[];
  readonly entityIds: readonly EntityId[];
  readonly relationshipIds: readonly RelationshipId[];
}