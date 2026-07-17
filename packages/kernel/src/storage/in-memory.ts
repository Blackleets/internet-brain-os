import type { Case, CaseId, Evidence, EvidenceId } from '@internet-brain-os/shared';
import type { CaseRepository } from '../case';
import type { EvidenceCaseReader, EvidenceRecord, EvidenceRepository } from '../evidence';

/**
 * Deterministic in-memory persistence for local kernel execution and tests.
 * The repository interfaces remain storage-agnostic so SQLite can replace this
 * adapter without changing CaseManager or EvidenceManager.
 */
export class InMemoryCaseRepository implements CaseRepository {
  private readonly records = new Map<CaseId, Case>();

  async create(caseRecord: Case): Promise<void> {
    this.records.set(caseRecord.id, cloneCase(caseRecord));
  }

  async getById(id: CaseId): Promise<Case | null> {
    const record = this.records.get(id);
    return record ? cloneCase(record) : null;
  }

  async list(): Promise<readonly Case[]> {
    return [...this.records.values()].map(cloneCase);
  }

  async update(caseRecord: Case): Promise<void> {
    this.records.set(caseRecord.id, cloneCase(caseRecord));
  }
}

export class InMemoryEvidenceRepository implements EvidenceRepository {
  private readonly records = new Map<EvidenceId, EvidenceRecord>();

  async create(record: EvidenceRecord): Promise<void> {
    this.records.set(record.evidence.id, cloneEvidenceRecord(record));
  }

  async getById(id: EvidenceId): Promise<EvidenceRecord | null> {
    const record = this.records.get(id);
    return record ? cloneEvidenceRecord(record) : null;
  }

  async list(caseId?: CaseId): Promise<readonly EvidenceRecord[]> {
    return [...this.records.values()]
      .filter((record) => caseId === undefined || record.evidence.caseId === caseId)
      .map(cloneEvidenceRecord);
  }

  async update(record: EvidenceRecord): Promise<void> {
    this.records.set(record.evidence.id, cloneEvidenceRecord(record));
  }
}

function cloneCase(record: Case): Case {
  return { ...record, tags: [...record.tags] };
}

function cloneEvidenceRecord(record: EvidenceRecord): EvidenceRecord {
  const evidence: Evidence = record.evidence;
  return {
    updatedAt: record.updatedAt,
    evidence: {
      ...evidence,
      tags: [...evidence.tags],
      entityIds: [...evidence.entityIds],
      relationshipIds: [...evidence.relationshipIds],
    },
  };
}
