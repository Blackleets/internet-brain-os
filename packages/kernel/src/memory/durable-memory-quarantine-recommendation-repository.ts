import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  InMemoryMemoryQuarantineRecommendationRepository,
  MemoryQuarantineRecommendationConflictError,
  type MemoryQuarantineRecommendationAppendResult,
  type MemoryQuarantineRecommendationRepository,
  type StoredMemoryQuarantineRecommendation,
  verifyMemoryQuarantineRecommendationIntegrity,
} from './memory-quarantine-recommendation-repository';
import type { MemoryQuarantineRecommendation } from './memory-quarantine-signal-evaluator';

interface DurableRecommendationFile {
  readonly version: 1;
  readonly recommendations: readonly StoredMemoryQuarantineRecommendation[];
}

export class DurableMemoryQuarantineRecommendationRepository
implements MemoryQuarantineRecommendationRepository {
  constructor(private readonly filePath: string) {
    if (!filePath?.trim()) {
      throw new MemoryQuarantineRecommendationConflictError(
        'INVALID_INPUT',
        'Quarantine recommendation file path is required.',
      );
    }
  }

  append(recommendation: MemoryQuarantineRecommendation): MemoryQuarantineRecommendationAppendResult {
    const { repository, recommendations } = this.loadRepository();
    const result = repository.append(recommendation);
    if (result.kind === 'replayed') return result;
    this.persist([...recommendations, result.recommendation]);
    return result;
  }

  list(memoryId?: string): readonly StoredMemoryQuarantineRecommendation[] {
    return this.loadRepository().repository.list(memoryId);
  }

  getById(recommendationId: string): StoredMemoryQuarantineRecommendation | undefined {
    return this.loadRepository().repository.getById(recommendationId);
  }

  private loadRepository(): {
    readonly repository: InMemoryMemoryQuarantineRecommendationRepository;
    readonly recommendations: readonly StoredMemoryQuarantineRecommendation[];
  } {
    const recommendations = this.readRecommendations();
    const repository = new InMemoryMemoryQuarantineRecommendationRepository();
    for (const stored of recommendations) {
      const { basisDigest, integrityDigest, ...recommendation } = stored;
      const replayed = repository.append(recommendation);
      if (
        replayed.recommendation.basisDigest !== basisDigest
        || replayed.recommendation.integrityDigest !== integrityDigest
      ) {
        throw new MemoryQuarantineRecommendationConflictError(
          'INVALID_INTEGRITY',
          'Durable quarantine recommendation history does not reproduce its stored integrity digest.',
        );
      }
    }
    return { repository, recommendations };
  }

  private readRecommendations(): readonly StoredMemoryQuarantineRecommendation[] {
    let raw: string;
    try {
      raw = readFileSync(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }

    let parsed: DurableRecommendationFile;
    try {
      parsed = JSON.parse(raw) as DurableRecommendationFile;
    } catch {
      throw new MemoryQuarantineRecommendationConflictError(
        'INVALID_INPUT',
        'Durable quarantine recommendation file is not valid JSON.',
      );
    }
    if (parsed?.version !== 1 || !Array.isArray(parsed.recommendations)) {
      throw new MemoryQuarantineRecommendationConflictError(
        'INVALID_INPUT',
        'Durable quarantine recommendation file has an unsupported schema.',
      );
    }
    for (const recommendation of parsed.recommendations) {
      if (!verifyMemoryQuarantineRecommendationIntegrity(recommendation)) {
        throw new MemoryQuarantineRecommendationConflictError(
          'INVALID_INTEGRITY',
          'Durable quarantine recommendation integrity verification failed.',
        );
      }
    }
    return parsed.recommendations.map(cloneStored);
  }

  private persist(recommendations: readonly StoredMemoryQuarantineRecommendation[]): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    const body = `${JSON.stringify({ version: 1, recommendations }, null, 2)}\n`;
    try {
      writeFileSync(temporary, body, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      renameSync(temporary, this.filePath);
    } catch (error) {
      try { rmSync(temporary, { force: true }); } catch { /* cleanup best effort */ }
      throw error;
    }
  }
}

function cloneStored(value: StoredMemoryQuarantineRecommendation): StoredMemoryQuarantineRecommendation {
  return {
    ...value,
    signals: value.signals.map((signal) => ({ ...signal, referenceIds: [...signal.referenceIds] })),
  };
}
