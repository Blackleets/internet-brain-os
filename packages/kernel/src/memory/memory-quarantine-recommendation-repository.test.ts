import { describe, expect, it } from 'vitest';
import {
  evaluateMemoryQuarantineRecommendation,
  type MemoryQuarantineRecommendation,
  type PersistedMemoryQuarantineSignal,
} from './memory-quarantine-recommendation';
import {
  InMemoryMemoryQuarantineRecommendationRepository,
  MemoryQuarantineRecommendationRepositoryError,
} from './memory-quarantine-recommendation-repository';

function signal(overrides: Partial<PersistedMemoryQuarantineSignal> = {}): PersistedMemoryQuarantineSignal {
  return {
    signalId: 'signal-1',
    memoryId: 'memory-1',
    lifecycleRevision: 1,
    type: 'provenance_gap',
    severity: 'high',
    referenceIds: ['evidence-1'],
    evaluatorVersion: 'quarantine-evaluator-v1',
    observedAt: '2026-08-09T10:00:00.000Z',
    ...overrides,
  };
}

function recommendation(overrides: {
  memoryId?: string;
  lifecycleRevision?: number;
  observedAt?: string;
  signalId?: string;
} = {}): MemoryQuarantineRecommendation {
  const memoryId = overrides.memoryId ?? 'memory-1';
  const lifecycleRevision = overrides.lifecycleRevision ?? 1;
  const result = evaluateMemoryQuarantineRecommendation({
    memoryId,
    lifecycleRevision,
    state: 'proposed',
    signals: [signal({
      memoryId,
      lifecycleRevision,
      signalId: overrides.signalId ?? 'signal-1',
      observedAt: overrides.observedAt ?? '2026-08-09T10:00:00.000Z',
    })],
    evaluatorVersion: 'quarantine-evaluator-v1',
  });
  if (result.kind !== 'recommended') throw new Error('Expected recommendation.');
  return result.recommendation;
}

describe('InMemoryMemoryQuarantineRecommendationRepository', () => {
  it('appends an integrity-verified recommendation and returns defensive copies', () => {
    const repository = new InMemoryMemoryQuarantineRecommendationRepository();
    const source = recommendation();
    const result = repository.append(source);

    expect(result.kind).toBe('appended');
    expect(repository.find(source.recommendationId)).toEqual(source);
    expect(repository.list('memory-1')).toEqual([source]);

    (result.recommendation.signals[0].referenceIds as string[]).push('mutated');
    expect(repository.find(source.recommendationId)?.signals[0].referenceIds).toEqual(['evidence-1']);
  });

  it('replays an exact recommendation without appending a duplicate', () => {
    const repository = new InMemoryMemoryQuarantineRecommendationRepository();
    const source = recommendation();
    const first = repository.append(source);
    const replay = repository.append(source);

    expect(first.kind).toBe('appended');
    expect(replay.kind).toBe('replayed');
    expect(replay.recommendation).toEqual(first.recommendation);
    expect(repository.list('memory-1')).toHaveLength(1);
  });

  it('rejects tampered recommendations before writing', () => {
    const repository = new InMemoryMemoryQuarantineRecommendationRepository();
    const source = recommendation();

    expect(() => repository.append({
      ...source,
      lifecycleRevision: 99,
    })).toThrowError(expect.objectContaining({ code: 'INTEGRITY_FAILURE' }));
    expect(repository.list('memory-1')).toHaveLength(0);
  });

  it('scopes and sorts recommendations deterministically', () => {
    const repository = new InMemoryMemoryQuarantineRecommendationRepository();
    const later = recommendation({ signalId: 'signal-later', observedAt: '2026-08-09T12:00:00Z' });
    const earlier = recommendation({ signalId: 'signal-earlier', observedAt: '2026-08-09T09:00:00Z' });
    const other = recommendation({ memoryId: 'memory-2', signalId: 'signal-other' });

    repository.append(later);
    repository.append(other);
    repository.append(earlier);

    expect(repository.list('memory-1').map((entry) => entry.recommendationId)).toEqual([
      earlier.recommendationId,
      later.recommendationId,
    ]);
    expect(repository.list('memory-2')).toEqual([other]);
  });

  it('uses the declared repository error for invalid lookup input', () => {
    const repository = new InMemoryMemoryQuarantineRecommendationRepository();
    expect(() => repository.find('   ')).toThrowError(MemoryQuarantineRecommendationRepositoryError);
    expect(() => repository.list('   ')).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });
});
