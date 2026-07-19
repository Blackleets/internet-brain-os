import type { Case, CaseId } from '@internet-brain-os/shared';
import type { CaseRepository } from '../case';
import { AtomicJsonCollection } from './atomic-json-file';
import { AlreadyExistsError, NotFoundError } from './storage-errors';

export interface JsonCaseRepositoryOptions {
  readonly dataRoot: string;
}

export class JsonCaseRepository implements CaseRepository {
  private readonly collection: AtomicJsonCollection<Case>;

  constructor(options: JsonCaseRepositoryOptions) {
    this.collection = new AtomicJsonCollection({
      dataRoot: options.dataRoot,
      fileName: 'cases.json',
      clone: cloneCase,
    });
  }

  async create(caseRecord: Case): Promise<void> {
    await this.collection.mutate((records) => {
      if (records.some((record) => record.id === caseRecord.id)) {
        throw new AlreadyExistsError('Case', caseRecord.id);
      }
      records.push(cloneCase(caseRecord));
    });
  }

  async getById(id: CaseId): Promise<Case | null> {
    return (await this.collection.read()).find((record) => record.id === id) ?? null;
  }

  async list(): Promise<readonly Case[]> {
    return this.collection.read();
  }

  async update(caseRecord: Case): Promise<void> {
    await this.collection.mutate((records) => {
      const index = records.findIndex((record) => record.id === caseRecord.id);
      if (index < 0) throw new NotFoundError('Case', caseRecord.id);
      records[index] = cloneCase(caseRecord);
    });
  }
}

function cloneCase(record: Case): Case {
  return { ...record, tags: [...record.tags] };
}
