import * as nodeFileSystem from 'node:fs';
import { dirname } from 'node:path';
import {
  InMemoryMemoryAuthorityReceiptRepository,
  MemoryAuthorityReceiptConflictError,
  type MemoryAuthorityReceiptAppendResult,
  type MemoryAuthorityReceiptPayload,
  type MemoryAuthorityReceiptRepository,
  type MemoryAuthorityTransitionReceipt,
  verifyMemoryAuthorityReceiptIntegrity,
} from './memory-authority-receipt-repository';

interface DurableReceiptFile {
  readonly version: 1;
  readonly receipts: readonly MemoryAuthorityTransitionReceipt[];
}

export type DurableMemoryAuthorityReceiptFileSystem = Pick<
  typeof nodeFileSystem,
  'mkdirSync' | 'readFileSync' | 'renameSync' | 'rmSync' | 'writeFileSync'
>;

export class DurableMemoryAuthorityReceiptRepository implements MemoryAuthorityReceiptRepository {
  constructor(
    private readonly filePath: string,
    private readonly fileSystem: DurableMemoryAuthorityReceiptFileSystem = nodeFileSystem,
  ) {
    if (!filePath?.trim()) throw new MemoryAuthorityReceiptConflictError('INVALID_INPUT', 'Authority receipt file path is required.');
  }

  append(payload: MemoryAuthorityReceiptPayload, occurredAt: string): MemoryAuthorityReceiptAppendResult {
    const { repository, receipts } = this.loadRepository();
    const result = repository.append(payload, occurredAt);
    if (result.kind === 'replayed') return result;
    this.persist([...receipts, result.receipt]);
    return result;
  }

  list(memoryId: string): readonly MemoryAuthorityTransitionReceipt[] {
    return this.loadRepository().repository.list(memoryId);
  }

  findByRequestId(requestId: string): MemoryAuthorityTransitionReceipt | undefined {
    return this.loadRepository().repository.findByRequestId(requestId);
  }

  private loadRepository(): {
    readonly repository: InMemoryMemoryAuthorityReceiptRepository;
    readonly receipts: readonly MemoryAuthorityTransitionReceipt[];
  } {
    const receipts = this.readReceipts();
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    for (const receipt of receipts) {
      const { receiptId: _receiptId, resultingRevision: _resultingRevision, occurredAt, payloadDigest: _payloadDigest, integrityDigest: _integrityDigest, ...payload } = receipt;
      const replayed = repository.append(payload, occurredAt);
      if (replayed.receipt.receiptId !== receipt.receiptId || replayed.receipt.integrityDigest !== receipt.integrityDigest) {
        throw new MemoryAuthorityReceiptConflictError('ALTERED_REPLAY', 'Durable authority receipt history does not reproduce its stored integrity digest.');
      }
    }
    return { repository, receipts };
  }

  private readReceipts(): readonly MemoryAuthorityTransitionReceipt[] {
    let raw: string;
    try {
      raw = this.fileSystem.readFileSync(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    let parsed: DurableReceiptFile;
    try {
      parsed = JSON.parse(raw) as DurableReceiptFile;
    } catch {
      throw new MemoryAuthorityReceiptConflictError('INVALID_INPUT', 'Durable authority receipt file is not valid JSON.');
    }
    if (parsed?.version !== 1 || !Array.isArray(parsed.receipts)) {
      throw new MemoryAuthorityReceiptConflictError('INVALID_INPUT', 'Durable authority receipt file has an unsupported schema.');
    }
    for (const receipt of parsed.receipts) {
      if (!verifyMemoryAuthorityReceiptIntegrity(receipt)) {
        throw new MemoryAuthorityReceiptConflictError('ALTERED_REPLAY', 'Durable authority receipt integrity verification failed.');
      }
    }
    return parsed.receipts.map(cloneReceipt);
  }

  private persist(receipts: readonly MemoryAuthorityTransitionReceipt[]): void {
    const directory = dirname(this.filePath);
    this.fileSystem.mkdirSync(directory, { recursive: true });
    const temporary = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    const body = `${JSON.stringify({ version: 1, receipts }, null, 2)}\n`;
    try {
      this.fileSystem.writeFileSync(temporary, body, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      this.fileSystem.renameSync(temporary, this.filePath);
    } catch (error) {
      try { this.fileSystem.rmSync(temporary, { force: true }); } catch { /* cleanup best effort */ }
      throw error;
    }
  }
}

function cloneReceipt(receipt: MemoryAuthorityTransitionReceipt): MemoryAuthorityTransitionReceipt {
  return {
    ...receipt,
    executor: { ...receipt.executor },
    approvalDecisions: receipt.approvalDecisions?.map((decision) => ({ ...decision, approver: { ...decision.approver } })),
    evidenceIds: receipt.evidenceIds ? [...receipt.evidenceIds] : undefined,
    contradictionDecisionIds: receipt.contradictionDecisionIds ? [...receipt.contradictionDecisionIds] : undefined,
    admissionRecordIds: receipt.admissionRecordIds ? [...receipt.admissionRecordIds] : undefined,
    quarantineSignalIds: receipt.quarantineSignalIds ? [...receipt.quarantineSignalIds] : undefined,
  };
}
