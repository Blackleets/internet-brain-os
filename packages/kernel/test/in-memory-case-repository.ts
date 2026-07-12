import type { Case, CaseId } from '@internet-brain-os/shared';
import type { CaseRepository } from '../src';

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

function cloneCase(caseRecord: Case): Case {
  return { ...caseRecord, tags: [...caseRecord.tags] };
}
