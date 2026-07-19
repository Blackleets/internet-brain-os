import { AtomicJsonCollection } from './atomic-json-file';
import { AlreadyExistsError, NotFoundError } from './storage-errors';
import { InvalidCognitivePipelineRecordError } from './cognitive-pipeline-errors';
import type {
  CognitivePipelineRecord,
  CognitivePipelineRecordId,
} from './cognitive-pipeline-types';

export class JsonCognitivePipelineRepository {
  private readonly collection: AtomicJsonCollection<CognitivePipelineRecord>;

  constructor(dataRoot: string) {
    this.collection = new AtomicJsonCollection<CognitivePipelineRecord>({
      dataRoot,
      fileName: 'cognitive-pipeline.json',
      clone: cloneRecord,
    });
  }

  async append(record: CognitivePipelineRecord): Promise<void> {
    validateRecord(record);
    const safeRecord = cloneRecord(record);

    await this.collection.mutate((records) => {
      if (records.some((existing) => existing.id === safeRecord.id)) {
        throw new AlreadyExistsError('Cognitive pipeline record', safeRecord.id);
      }
      records.push(safeRecord);
    });
  }

  async get(id: CognitivePipelineRecordId): Promise<CognitivePipelineRecord> {
    const record = (await this.collection.read()).find((candidate) => candidate.id === id);
    if (!record) throw new NotFoundError('Cognitive pipeline record', id);
    validateRecord(record);
    return cloneRecord(record);
  }

  async list(): Promise<readonly CognitivePipelineRecord[]> {
    const records = await this.collection.read();
    records.forEach(validateRecord);
    return records.map(cloneRecord);
  }
}

function validateRecord(record: CognitivePipelineRecord): void {
  if (!record.id || !record.recordedAt) {
    throw new InvalidCognitivePipelineRecordError('id and recordedAt are required');
  }

  if (record.execution.missionId !== record.taskResult.missionId) {
    throw new InvalidCognitivePipelineRecordError('execution and task result mission IDs differ');
  }

  if (!record.taskResult.claimProposals.some((proposal) => proposal.id === record.validation.proposal.id)) {
    throw new InvalidCognitivePipelineRecordError(
      'validation proposal does not belong to the task result',
    );
  }

  const candidate = record.validation.candidate;
  if (record.contradiction) {
    if (!candidate) {
      throw new InvalidCognitivePipelineRecordError(
        'contradiction assessment requires an accepted validation candidate',
      );
    }
    if (record.contradiction.candidate.id !== candidate.id) {
      throw new InvalidCognitivePipelineRecordError('contradiction candidate does not match validation');
    }
  }

  if (record.admission) {
    if (!record.contradiction) {
      throw new InvalidCognitivePipelineRecordError(
        'knowledge admission requires a contradiction assessment',
      );
    }
    if (record.admission.candidate.id !== record.contradiction.candidate.id) {
      throw new InvalidCognitivePipelineRecordError('admission candidate does not match contradiction');
    }
    if (record.admission.contradiction.action !== record.contradiction.action) {
      throw new InvalidCognitivePipelineRecordError(
        'admission embeds a different contradiction assessment',
      );
    }
    if (record.admission.decision === 'admitted' && !record.admission.claim) {
      throw new InvalidCognitivePipelineRecordError('admitted result must contain a durable claim');
    }
    if (record.admission.decision !== 'admitted' && record.admission.claim) {
      throw new InvalidCognitivePipelineRecordError(
        'reviewed or blocked result cannot contain a durable claim',
      );
    }
  }
}

function cloneRecord(record: CognitivePipelineRecord): CognitivePipelineRecord {
  return structuredClone(record);
}
