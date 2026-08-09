import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  InMemoryMemoryRecoveryReviewRepository,
  MemoryRecoveryReviewConflictError,
  type MemoryRecoveryReviewAppendResult,
  type MemoryRecoveryReviewRecord,
  type MemoryRecoveryReviewRepository,
  type MemoryRecoveryReviewRequest,
  verifyMemoryRecoveryReviewIntegrity,
} from './memory-recovery-review-repository';

interface DurableRecoveryReviewFile {
  readonly version: 1;
  readonly reviews: readonly MemoryRecoveryReviewRecord[];
}

export class DurableMemoryRecoveryReviewRepository implements MemoryRecoveryReviewRepository {
  constructor(private readonly filePath: string) {
    if (!filePath?.trim()) {
      throw new MemoryRecoveryReviewConflictError('INVALID_INPUT', 'Recovery review file path is required.');
    }
  }

  append(request: MemoryRecoveryReviewRequest): MemoryRecoveryReviewAppendResult {
    const { repository, reviews } = this.loadRepository();
    const result = repository.append(request);
    if (result.kind === 'replayed') return result;
    this.persist([...reviews, result.review]);
    return result;
  }

  list(terminalMemoryId?: string): readonly MemoryRecoveryReviewRecord[] {
    return this.loadRepository().repository.list(terminalMemoryId);
  }

  findByRequestId(requestId: string): MemoryRecoveryReviewRecord | undefined {
    return this.loadRepository().repository.findByRequestId(requestId);
  }

  getById(reviewId: string): MemoryRecoveryReviewRecord | undefined {
    return this.loadRepository().repository.getById(reviewId);
  }

  private loadRepository(): {
    readonly repository: InMemoryMemoryRecoveryReviewRepository;
    readonly reviews: readonly MemoryRecoveryReviewRecord[];
  } {
    const reviews = this.readReviews();
    const repository = new InMemoryMemoryRecoveryReviewRepository();
    for (const stored of reviews) {
      const { reviewId, payloadDigest, integrityDigest, ...request } = stored;
      const replayed = repository.append(request);
      if (
        replayed.review.reviewId !== reviewId
        || replayed.review.payloadDigest !== payloadDigest
        || replayed.review.integrityDigest !== integrityDigest
      ) {
        throw new MemoryRecoveryReviewConflictError(
          'INVALID_INTEGRITY',
          'Durable recovery review history does not reproduce its stored integrity record.',
        );
      }
    }
    return { repository, reviews };
  }

  private readReviews(): readonly MemoryRecoveryReviewRecord[] {
    let raw: string;
    try {
      raw = readFileSync(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    let parsed: DurableRecoveryReviewFile;
    try {
      parsed = JSON.parse(raw) as DurableRecoveryReviewFile;
    } catch {
      throw new MemoryRecoveryReviewConflictError('INVALID_INPUT', 'Durable recovery review file is not valid JSON.');
    }
    if (parsed?.version !== 1 || !Array.isArray(parsed.reviews)) {
      throw new MemoryRecoveryReviewConflictError('INVALID_INPUT', 'Durable recovery review file has an unsupported schema.');
    }
    for (const review of parsed.reviews) {
      if (!verifyMemoryRecoveryReviewIntegrity(review)) {
        throw new MemoryRecoveryReviewConflictError(
          'INVALID_INTEGRITY',
          'Durable recovery review integrity verification failed.',
        );
      }
    }
    return parsed.reviews.map(cloneRecord);
  }

  private persist(reviews: readonly MemoryRecoveryReviewRecord[]): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    const body = `${JSON.stringify({ version: 1, reviews }, null, 2)}\n`;
    try {
      writeFileSync(temporary, body, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      renameSync(temporary, this.filePath);
    } catch (error) {
      try { rmSync(temporary, { force: true }); } catch { /* best effort */ }
      throw error;
    }
  }
}

function cloneRecord(record: MemoryRecoveryReviewRecord): MemoryRecoveryReviewRecord {
  return { ...record, requestedBy: { ...record.requestedBy }, reviewer: { ...record.reviewer } };
}
