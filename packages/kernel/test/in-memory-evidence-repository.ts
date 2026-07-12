import type {
  CaseId,
  Evidence,
  EvidenceId,
} from '@internet-brain-os/shared';
import type {
  EvidenceRecord,
  EvidenceRepository,
} from '../src';

export class InMemoryEvidenceRepository implements EvidenceRepository {
  private readonly records = new Map<EvidenceId, EvidenceRecord>();

  async create(record: EvidenceRecord): Promise<void> {
    this.records.set(record.evidence.id, cloneRecord(record));
  }

  async getById(id: EvidenceId): Promise<EvidenceRecord | null> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : null;
  }

  async list(caseId?: CaseId): Promise<readonly EvidenceRecord[]> {
    return [...this.records.values()]
      .filter((record) => caseId === undefined || record.evidence.caseId === caseId)
      .map(cloneRecord);
  }

  async update(record: EvidenceRecord): Promise<void> {
    this.records.set(record.evidence.id, cloneRecord(record));
  }
}

function cloneRecord(record: EvidenceRecord): EvidenceRecord {
  return {
    updatedAt: record.updatedAt,
    evidence: cloneEvidence(record.evidence),
  };
}

function cloneEvidence(evidence: Evidence): Evidence {
  return {
    ...evidence,
    tags: [...evidence.tags],
    entityIds: [...evidence.entityIds],
    relationshipIds: [...evidence.relationshipIds],
  };
}
