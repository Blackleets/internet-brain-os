import type { CaseId, EvidenceId } from '@internet-brain-os/shared';
import type { EvidenceRecord, EvidenceRepository } from '../evidence';
import { AtomicJsonCollection } from './atomic-json-file';
import { AlreadyExistsError, NotFoundError } from './storage-errors';

export interface JsonEvidenceRepositoryOptions {
  readonly dataRoot: string;
}

export class JsonEvidenceRepository implements EvidenceRepository {
  private readonly collection: AtomicJsonCollection<EvidenceRecord>;

  constructor(options: JsonEvidenceRepositoryOptions) {
    this.collection = new AtomicJsonCollection({
      dataRoot: options.dataRoot,
      fileName: 'evidence.json',
      clone: cloneEvidenceRecord,
    });
  }

  async create(record: EvidenceRecord): Promise<void> {
    await this.collection.mutate((records) => {
      if (records.some((existing) => existing.evidence.id === record.evidence.id)) {
        throw new AlreadyExistsError('Evidence', record.evidence.id);
      }
      records.push(cloneEvidenceRecord(record));
    });
  }

  async getById(id: EvidenceId): Promise<EvidenceRecord | null> {
    return (await this.collection.read()).find((record) => record.evidence.id === id) ?? null;
  }

  async list(caseId?: CaseId): Promise<readonly EvidenceRecord[]> {
    const records = await this.collection.read();
    return caseId === undefined
      ? records
      : records.filter((record) => record.evidence.caseId === caseId);
  }

  async update(record: EvidenceRecord): Promise<void> {
    await this.collection.mutate((records) => {
      const index = records.findIndex((existing) => existing.evidence.id === record.evidence.id);
      if (index < 0) throw new NotFoundError('Evidence', record.evidence.id);
      records[index] = cloneEvidenceRecord(record);
    });
  }
}

function cloneEvidenceRecord(record: EvidenceRecord): EvidenceRecord {
  return {
    updatedAt: record.updatedAt,
    evidence: {
      ...record.evidence,
      tags: [...record.evidence.tags],
      entityIds: [...record.evidence.entityIds],
      relationshipIds: [...record.evidence.relationshipIds],
    },
  };
}
