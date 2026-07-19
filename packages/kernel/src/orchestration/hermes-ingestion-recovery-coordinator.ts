import type { IsoDateTime } from '@internet-brain-os/shared';
import type { CognitivePipelineRecord, CognitivePipelineRecordId } from '../storage/cognitive-pipeline-types';
import type { HermesIngestionReceipt } from '../storage/json-hermes-ingestion-receipt-repository';

export interface HermesRecoveryReceiptStore {
  listPending(): Promise<readonly HermesIngestionReceipt[]>;
  complete(key: string, record: CognitivePipelineRecord, at: IsoDateTime): Promise<void>;
  fail(key: string, error: unknown, at: IsoDateTime): Promise<void>;
}

export interface CognitivePipelineRecordReader {
  get(id: CognitivePipelineRecordId): Promise<CognitivePipelineRecord>;
}

export interface HermesIngestionRecoveryResult {
  readonly recovered: readonly string[];
  readonly unresolved: readonly string[];
}

/**
 * Repairs the crash window where the cognitive record was durably persisted but
 * the matching Hermes receipt remained pending. It never reruns the cognitive pipeline.
 */
export class HermesIngestionRecoveryCoordinator {
  constructor(
    private readonly receipts: HermesRecoveryReceiptStore,
    private readonly records: CognitivePipelineRecordReader,
    private readonly isMissingRecord: (error: unknown) => boolean,
  ) {}

  async reconcile(at: IsoDateTime): Promise<HermesIngestionRecoveryResult> {
    const recovered: string[] = [];
    const unresolved: string[] = [];

    for (const receipt of await this.receipts.listPending()) {
      try {
        const record = await this.records.get(receipt.recordId);
        await this.receipts.complete(receipt.idempotencyKey, record, at);
        recovered.push(receipt.idempotencyKey);
      } catch (error) {
        if (this.isMissingRecord(error)) {
          unresolved.push(receipt.idempotencyKey);
          continue;
        }
        await this.receipts.fail(receipt.idempotencyKey, error, at);
      }
    }

    return { recovered, unresolved };
  }
}
