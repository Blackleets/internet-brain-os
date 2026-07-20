import type {
  CognitivePipelineRecord,
  CognitivePipelineRecordId,
  HermesIngestionReceipt,
} from '../storage';
import { buildReplayLabCaseView, type ReplayLabCaseView } from './replay-lab-read-model';

export interface ReplayLabRecordReader {
  list(): Promise<readonly CognitivePipelineRecord[]>;
  get(id: CognitivePipelineRecordId): Promise<CognitivePipelineRecord>;
}

export interface ReplayLabReceiptReader {
  listPending(): Promise<readonly HermesIngestionReceipt[]>;
  listExpiredPending(at: string): Promise<readonly HermesIngestionReceipt[]>;
}

export interface ReplayLabReceiptListReader {
  list(): Promise<readonly HermesIngestionReceipt[]>;
}

export interface ReplayLabQueryServiceDependencies {
  readonly records: ReplayLabRecordReader;
  readonly receipts?: ReplayLabReceiptListReader;
}

export class ReplayLabQueryService {
  private readonly records: ReplayLabRecordReader;
  private readonly receipts?: ReplayLabReceiptListReader;

  constructor(dependencies: ReplayLabQueryServiceDependencies) {
    this.records = dependencies.records;
    this.receipts = dependencies.receipts;
  }

  async listCases(): Promise<readonly ReplayLabCaseView[]> {
    const [records, receipts] = await Promise.all([
      this.records.list(),
      this.safeListReceipts(),
    ]);
    const receiptsByRecordId = indexReceiptsByRecordId(receipts);

    return records
      .map((record) => buildReplayLabCaseView(record, { receipt: receiptsByRecordId.get(record.id) }))
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || a.id.localeCompare(b.id));
  }

  async getCase(id: CognitivePipelineRecordId): Promise<ReplayLabCaseView> {
    const [record, receipts] = await Promise.all([
      this.records.get(id),
      this.safeListReceipts(),
    ]);
    const receipt = receipts.find((candidate) => candidate.recordId === record.id);
    return buildReplayLabCaseView(record, { receipt });
  }

  private async safeListReceipts(): Promise<readonly HermesIngestionReceipt[]> {
    if (!this.receipts) return [];
    return this.receipts.list();
  }
}

function indexReceiptsByRecordId(
  receipts: readonly HermesIngestionReceipt[],
): ReadonlyMap<CognitivePipelineRecordId, HermesIngestionReceipt> {
  const byRecordId = new Map<CognitivePipelineRecordId, HermesIngestionReceipt>();
  for (const receipt of receipts) {
    const existing = byRecordId.get(receipt.recordId);
    if (!existing || receipt.updatedAt.localeCompare(existing.updatedAt) > 0) {
      byRecordId.set(receipt.recordId, receipt);
    }
  }
  return byRecordId;
}
