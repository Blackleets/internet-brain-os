import type {
  Case,
  CaseId,
  Evidence,
  EvidenceId,
  IsoDateTime,
} from '@internet-brain-os/shared';

export interface EvidenceRecord {
  readonly evidence: Evidence;
  readonly updatedAt: IsoDateTime;
}

export interface EvidenceRepository {
  create(record: EvidenceRecord): Promise<void>;
  getById(id: EvidenceId): Promise<EvidenceRecord | null>;
  list(caseId?: CaseId): Promise<readonly EvidenceRecord[]>;
  update(record: EvidenceRecord): Promise<void>;
}

export interface EvidenceCaseReader {
  getById(id: CaseId): Promise<Case | null>;
}
