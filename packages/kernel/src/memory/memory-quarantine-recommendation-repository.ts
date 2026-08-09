import type { MemoryQuarantineRecommendation } from './memory-quarantine-recommendation';
import {
  cloneMemoryQuarantineRecommendation,
  verifyMemoryQuarantineRecommendationIntegrity,
} from './memory-quarantine-recommendation';

export type MemoryQuarantineRecommendationAppendResult =
  | { readonly kind: 'appended'; readonly recommendation: MemoryQuarantineRecommendation }
  | { readonly kind: 'replayed'; readonly recommendation: MemoryQuarantineRecommendation };

export class MemoryQuarantineRecommendationRepositoryError extends Error {
  constructor(
    readonly code: 'INVALID_INPUT' | 'ALTERED_REPLAY' | 'INTEGRITY_FAILURE',
    message: string,
  ) {
    super(message);
    this.name = 'MemoryQuarantineRecommendationRepositoryError';
  }
}

export interface MemoryQuarantineRecommendationRepository {
  append(recommendation: MemoryQuarantineRecommendation): MemoryQuarantineRecommendationAppendResult;
  list(memoryId: string): readonly MemoryQuarantineRecommendation[];
  find(recommendationId: string): MemoryQuarantineRecommendation | undefined;
}

export class InMemoryMemoryQuarantineRecommendationRepository
  implements MemoryQuarantineRecommendationRepository
{
  private readonly byId = new Map<string, MemoryQuarantineRecommendation>();
  private readonly byMemory = new Map<string, MemoryQuarantineRecommendation[]>();

  append(recommendation: MemoryQuarantineRecommendation): MemoryQuarantineRecommendationAppendResult {
    const normalized = normalizeRecommendation(recommendation);
    const existing = this.byId.get(normalized.recommendationId);

    if (existing) {
      if (existing.integrityDigest !== normalized.integrityDigest) {
        throw new MemoryQuarantineRecommendationRepositoryError(
          'ALTERED_REPLAY',
          'The recommendation id is already bound to different normalized content.',
        );
      }
      return { kind: 'replayed', recommendation: cloneMemoryQuarantineRecommendation(existing) };
    }

    const stored = cloneMemoryQuarantineRecommendation(normalized);
    const chain = this.byMemory.get(stored.memoryId) ?? [];
    this.byId.set(stored.recommendationId, stored);
    this.byMemory.set(stored.memoryId, [...chain, stored]);
    return { kind: 'appended', recommendation: cloneMemoryQuarantineRecommendation(stored) };
  }

  list(memoryId: string): readonly MemoryQuarantineRecommendation[] {
    const normalizedMemoryId = required(memoryId, 'memoryId');
    return (this.byMemory.get(normalizedMemoryId) ?? [])
      .map(cloneMemoryQuarantineRecommendation)
      .sort((left, right) =>
        left.recommendedAt.localeCompare(right.recommendedAt) ||
        left.recommendationId.localeCompare(right.recommendationId),
      );
  }

  find(recommendationId: string): MemoryQuarantineRecommendation | undefined {
    const normalizedId = required(recommendationId, 'recommendationId');
    const recommendation = this.byId.get(normalizedId);
    return recommendation ? cloneMemoryQuarantineRecommendation(recommendation) : undefined;
  }
}

function normalizeRecommendation(
  recommendation: MemoryQuarantineRecommendation,
): MemoryQuarantineRecommendation {
  if (!verifyMemoryQuarantineRecommendationIntegrity(recommendation)) {
    throw new MemoryQuarantineRecommendationRepositoryError(
      'INTEGRITY_FAILURE',
      'Quarantine recommendation integrity verification failed.',
    );
  }

  const memoryId = required(recommendation.memoryId, 'memoryId');
  const recommendationId = required(recommendation.recommendationId, 'recommendationId');
  const evaluatorVersion = required(recommendation.evaluatorVersion, 'evaluatorVersion');
  if (!Number.isSafeInteger(recommendation.lifecycleRevision) || recommendation.lifecycleRevision < 0) {
    throw new MemoryQuarantineRecommendationRepositoryError(
      'INVALID_INPUT',
      'lifecycleRevision must be a non-negative safe integer.',
    );
  }
  if (recommendation.signals.length === 0) {
    throw new MemoryQuarantineRecommendationRepositoryError(
      'INVALID_INPUT',
      'A persisted quarantine recommendation requires at least one signal.',
    );
  }

  return cloneMemoryQuarantineRecommendation({
    ...recommendation,
    memoryId,
    recommendationId,
    evaluatorVersion,
  });
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new MemoryQuarantineRecommendationRepositoryError('INVALID_INPUT', `${field} is required.`);
  }
  return normalized;
}
