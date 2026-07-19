import type { IsoDateTime } from '@internet-brain-os/shared';
import { AtomicJsonCollection } from './atomic-json-file';
import type { CognitivePipelineRecord, CognitivePipelineRecordId } from './cognitive-pipeline-types';

export type HermesIngestionReceiptStatus = 'pending' | 'completed' | 'failed';

export interface HermesIngestionReceipt {
  idempotencyKey: string;
  fingerprint: string;
  recordId: CognitivePipelineRecordId;
  status: HermesIngestionReceiptStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  record?: CognitivePipelineRecord;
  failure?: string;
}

export type BeginHermesIngestionResult =
  | { readonly kind: 'acquired'; readonly receipt: HermesIngestionReceipt }
  | { readonly kind: 'replay'; readonly receipt: HermesIngestionReceipt };

export class HermesIngestionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HermesIngestionConflictError';
  }
}

export class HermesIngestionInProgressError extends Error {
  constructor(key: string) {
    super(`Hermes ingestion is already in progress: ${key}`);
    this.name = 'HermesIngestionInProgressError';
  }
}

export class JsonHermesIngestionReceiptRepository {
  private readonly collection: AtomicJsonCollection<HermesIngestionReceipt>;

  constructor(dataRoot: string) {
    this.collection = new AtomicJsonCollection<HermesIngestionReceipt>({
      dataRoot,
      fileName: 'hermes-ingestion-receipts.json',
      clone: (receipt) => structuredClone(receipt),
    });
  }

  async begin(input: {
    idempotencyKey: string;
    fingerprint: string;
    recordId: CognitivePipelineRecordId;
    at: IsoDateTime;
  }): Promise<BeginHermesIngestionResult> {
    let result: BeginHermesIngestionResult | undefined;
    await this.collection.mutate((receipts) => {
      const existing = receipts.find((receipt) => receipt.idempotencyKey === input.idempotencyKey);
      if (existing) {
        if (existing.fingerprint !== input.fingerprint || existing.recordId !== input.recordId) {
          throw new HermesIngestionConflictError(
            `Idempotency key was reused with different Hermes input: ${input.idempotencyKey}`,
          );
        }
        if (existing.status === 'pending') {
          throw new HermesIngestionInProgressError(input.idempotencyKey);
        }
        if (existing.status === 'completed' && existing.record) {
          result = { kind: 'replay', receipt: structuredClone(existing) };
          return;
        }
        existing.status = 'pending';
        existing.updatedAt = input.at;
        delete existing.failure;
        result = { kind: 'acquired', receipt: structuredClone(existing) };
        return;
      }

      const receipt: HermesIngestionReceipt = {
        idempotencyKey: input.idempotencyKey,
        fingerprint: input.fingerprint,
        recordId: input.recordId,
        status: 'pending',
        createdAt: input.at,
        updatedAt: input.at,
      };
      receipts.push(receipt);
      result = { kind: 'acquired', receipt: structuredClone(receipt) };
    });
    return result!;
  }

  async get(key: string): Promise<HermesIngestionReceipt | undefined> {
    const receipt = (await this.collection.read()).find((candidate) => candidate.idempotencyKey === key);
    return receipt ? structuredClone(receipt) : undefined;
  }

  async listPending(): Promise<readonly HermesIngestionReceipt[]> {
    return (await this.collection.read())
      .filter((receipt) => receipt.status === 'pending')
      .map((receipt) => structuredClone(receipt));
  }

  async complete(key: string, record: CognitivePipelineRecord, at: IsoDateTime): Promise<void> {
    await this.collection.mutate((receipts) => {
      const receipt = receipts.find((candidate) => candidate.idempotencyKey === key);
      if (!receipt || receipt.status !== 'pending') {
        throw new HermesIngestionConflictError(`Cannot complete unreserved Hermes ingestion: ${key}`);
      }
      if (receipt.recordId !== record.id) {
        throw new HermesIngestionConflictError(`Recovered record does not match receipt: ${key}`);
      }
      receipt.status = 'completed';
      receipt.record = structuredClone(record);
      receipt.updatedAt = at;
      delete receipt.failure;
    });
  }

  async fail(key: string, error: unknown, at: IsoDateTime): Promise<void> {
    await this.collection.mutate((receipts) => {
      const receipt = receipts.find((candidate) => candidate.idempotencyKey === key);
      if (!receipt || receipt.status !== 'pending') return;
      receipt.status = 'failed';
      receipt.failure = error instanceof Error ? error.message : String(error);
      receipt.updatedAt = at;
    });
  }
}
