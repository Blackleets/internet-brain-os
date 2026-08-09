import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { MemoryQuarantineRecommendation } from './memory-quarantine-recommendation';
import { cloneMemoryQuarantineRecommendation } from './memory-quarantine-recommendation';
import {
  InMemoryMemoryQuarantineRecommendationRepository,
  MemoryQuarantineRecommendationRepositoryError,
  type MemoryQuarantineRecommendationAppendResult,
  type MemoryQuarantineRecommendationRepository,
} from './memory-quarantine-recommendation-repository';

interface DurableMemoryQuarantineRecommendationFile {
  readonly version: 1;
  readonly recommendations: readonly MemoryQuarantineRecommendation[];
}

export class DurableMemoryQuarantineRecommendationRepository
  implements MemoryQuarantineRecommendationRepository
{
  constructor(private readonly filePath: string) {
    if (!filePath?.trim()) {
      throw new MemoryQuarantineRecommendationRepositoryError(
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

  list(memoryId: string): readonly MemoryQuarantineRecommendation[] {
    return this.loadRepository().repository.list(memoryId);
  }

  find(recommendationId: string): MemoryQuarantineRecommendation | undefined {
    return this.loadRepository().repository.find(recommendationId);
  }

  private loadRepository(): {
    readonly repository: InMemoryMemoryQuarantineRecommendationRepository;
    readonly recommendations: readonly MemoryQuarantineRecommendation[];
  } {
    const recommendations = this.readRecommendations();
    const repository = new InMemoryMemoryQuarantineRecommendationRepository();
    for (const recommendation of recommendations) {
      const replayed = repository.append(recommendation);
      if (
        replayed.recommendation.recommendationId !== recommendation.recommendationId ||
        replayed.recommendation.integrityDigest !== recommendation.integrityDigest
      ) {
        throw new MemoryQuarantineRecommendationRepositoryError(
          'ALTERED_REPLAY',
          'Durable quarantine recommendation history does not reproduce its stored identity.',
        );
      }
    }
    return { repository, recommendations };
  }

  private readRecommendations(): readonly MemoryQuarantineRecommendation[] {
    let raw: string;
    try {
      raw = readFileSync(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }

    let parsed: DurableMemoryQuarantineRecommendationFile;
    try {
      parsed = JSON.parse(raw) as DurableMemoryQuarantineRecommendationFile;
    } catch {
      throw new MemoryQuarantineRecommendationRepositoryError(
        'INVALID_INPUT',
        'Durable quarantine recommendation file is not valid JSON.',
      );
    }

    if (parsed?.version !== 1 || !Array.isArray(parsed.recommendations)) {
      throw new MemoryQuarantineRecommendationRepositoryError(
        'INVALID_INPUT',
        'Durable quarantine recommendation file has an unsupported schema.',
      );
    }

    return parsed.recommendations.map(cloneMemoryQuarantineRecommendation);
  }

  private persist(recommendations: readonly MemoryQuarantineRecommendation[]): void {
    const directory = dirname(this.filePath);
    mkdirSync(directory, { recursive: true });
    const temporary = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    const body = `${JSON.stringify({ version: 1, recommendations }, null, 2)}\n`;
    try {
      writeFileSync(temporary, body, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      renameSync(temporary, this.filePath);
    } catch (error) {
      try {
        rmSync(temporary, { force: true });
      } catch {
        // Cleanup is best effort and must not mask the write error.
      }
      throw error;
    }
  }
}
