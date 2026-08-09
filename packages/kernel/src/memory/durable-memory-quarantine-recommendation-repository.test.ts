import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  evaluateMemoryQuarantineRecommendation,
  type MemoryQuarantineRecommendation,
} from './memory-quarantine-recommendation';
import { MemoryQuarantineRecommendationRepositoryError } from './memory-quarantine-recommendation-repository';
import { DurableMemoryQuarantineRecommendationRepository } from './durable-memory-quarantine-recommendation-repository';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function recommendation(): MemoryQuarantineRecommendation {
  const result = evaluateMemoryQuarantineRecommendation({
    memoryId: 'memory-1',
    lifecycleRevision: 3,
    state: 'admitted',
    signals: [{
      signalId: 'signal-1',
      memoryId: 'memory-1',
      lifecycleRevision: 3,
      type: 'evidence_invalidation',
      severity: 'critical',
      referenceIds: ['evidence-1'],
      evaluatorVersion: 'quarantine-evaluator-v1',
      observedAt: '2026-08-09T10:00:00.000Z',
    }],
    evaluatorVersion: 'quarantine-evaluator-v1',
  });
  if (result.kind !== 'recommended') throw new Error('Expected recommendation.');
  return result.recommendation;
}

function repositoryPath(): string {
  const directory = mkdtempSync(join(tmpdir(), 'efesto-quarantine-recommendations-'));
  directories.push(directory);
  return join(directory, 'recommendations.json');
}

describe('DurableMemoryQuarantineRecommendationRepository', () => {
  it('persists and reconstructs an exact recommendation', () => {
    const path = repositoryPath();
    const source = recommendation();
    const writer = new DurableMemoryQuarantineRecommendationRepository(path);
    expect(writer.append(source).kind).toBe('appended');

    const reader = new DurableMemoryQuarantineRecommendationRepository(path);
    expect(reader.find(source.recommendationId)).toEqual(source);
    expect(reader.list('memory-1')).toEqual([source]);
  });

  it('treats an exact replay as idempotent without duplicating durable state', () => {
    const path = repositoryPath();
    const source = recommendation();
    const repository = new DurableMemoryQuarantineRecommendationRepository(path);

    expect(repository.append(source).kind).toBe('appended');
    expect(repository.append(source).kind).toBe('replayed');
    expect(repository.list('memory-1')).toHaveLength(1);

    const persisted = JSON.parse(readFileSync(path, 'utf8')) as { recommendations: unknown[] };
    expect(persisted.recommendations).toHaveLength(1);
  });

  it('fails closed when durable recommendation content is tampered', () => {
    const path = repositoryPath();
    const source = recommendation();
    const repository = new DurableMemoryQuarantineRecommendationRepository(path);
    repository.append(source);

    const persisted = JSON.parse(readFileSync(path, 'utf8')) as {
      version: number;
      recommendations: MemoryQuarantineRecommendation[];
    };
    persisted.recommendations[0] = {
      ...persisted.recommendations[0],
      evaluatorVersion: 'tampered',
    };
    writeFileSync(path, `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');

    expect(() => new DurableMemoryQuarantineRecommendationRepository(path).list('memory-1'))
      .toThrowError(expect.objectContaining({ code: 'INTEGRITY_FAILURE' }));
  });

  it('rejects malformed JSON and unsupported durable schema', () => {
    const malformedPath = repositoryPath();
    writeFileSync(malformedPath, '{', 'utf8');
    expect(() => new DurableMemoryQuarantineRecommendationRepository(malformedPath).list('memory-1'))
      .toThrowError(MemoryQuarantineRecommendationRepositoryError);

    const schemaPath = repositoryPath();
    writeFileSync(schemaPath, JSON.stringify({ version: 2, recommendations: [] }), 'utf8');
    expect(() => new DurableMemoryQuarantineRecommendationRepository(schemaPath).list('memory-1'))
      .toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });

  it('returns defensive copies after durable reload', () => {
    const path = repositoryPath();
    const source = recommendation();
    const repository = new DurableMemoryQuarantineRecommendationRepository(path);
    repository.append(source);

    const listed = repository.list('memory-1');
    (listed[0].signals[0].referenceIds as string[]).push('mutated');

    expect(repository.list('memory-1')[0].signals[0].referenceIds).toEqual(['evidence-1']);
  });
});
