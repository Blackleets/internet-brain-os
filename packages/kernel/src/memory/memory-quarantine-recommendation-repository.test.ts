import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@internet-brain-os/shared';
import { evaluateMemoryQuarantineSignals } from './memory-quarantine-signal-evaluator';
import {
  InMemoryMemoryQuarantineRecommendationRepository,
  MemoryQuarantineRecommendationConflictError,
  assessMemoryQuarantineRecommendationFreshness,
  verifyMemoryQuarantineRecommendationIntegrity,
} from './memory-quarantine-recommendation-repository';
import { DurableMemoryQuarantineRecommendationRepository } from './durable-memory-quarantine-recommendation-repository';

const directories: string[] = [];
afterEach(() => {
  while (directories.length > 0) rmSync(directories.pop()!, { recursive: true, force: true });
});

function recommendation(at = '2026-08-09T13:00:00.000Z') {
  const result = evaluateMemoryQuarantineSignals({
    memoryId: 'memory:alpha',
    lifecycleRevision: 4,
    state: 'admitted',
    evaluatorVersion: 'quarantine-v1',
    evaluatedAt: at as IsoDateTime,
    references: {
      invalidEvidenceIds: ['evidence:2', 'evidence:1'],
      unresolvedContradictionDecisionIds: ['contradiction:1'],
    },
  });
  if (!result.recommendation) throw new Error('Expected recommendation fixture.');
  return result.recommendation;
}

describe('memory quarantine recommendation repository', () => {
  it('appends once and treats the same deterministic basis as replay even with a later evaluation timestamp', () => {
    const repository = new InMemoryMemoryQuarantineRecommendationRepository();
    const first = repository.append(recommendation());
    const replay = repository.append(recommendation('2026-08-09T13:05:00.000Z'));

    expect(first.kind).toBe('appended');
    expect(replay.kind).toBe('replayed');
    expect(replay.recommendation.recommendedAt).toBe('2026-08-09T13:00:00.000Z');
    expect(repository.list('memory:alpha')).toHaveLength(1);
    expect(verifyMemoryQuarantineRecommendationIntegrity(replay.recommendation)).toBe(true);
  });

  it('rejects a forged recommendation identity', () => {
    const repository = new InMemoryMemoryQuarantineRecommendationRepository();
    const value = recommendation();
    expect(() => repository.append({ ...value, recommendationId: 'memory-quarantine:forged' }))
      .toThrowError(MemoryQuarantineRecommendationConflictError);
  });

  it('returns defensive copies that cannot mutate stored signal references', () => {
    const repository = new InMemoryMemoryQuarantineRecommendationRepository();
    const appended = repository.append(recommendation()).recommendation;
    const copy = repository.getById(appended.recommendationId)!;
    (copy.signals[0].referenceIds as string[]).push('evidence:mutated');
    const reread = repository.getById(appended.recommendationId)!;
    expect(reread.signals[0].referenceIds).not.toContain('evidence:mutated');
  });

  it('marks a recommendation stale when revision, evaluator version or signal basis changes', () => {
    const stored = new InMemoryMemoryQuarantineRecommendationRepository()
      .append(recommendation()).recommendation;
    expect(assessMemoryQuarantineRecommendationFreshness(stored, {
      currentLifecycleRevision: 4,
      currentEvaluatorVersion: 'quarantine-v1',
      currentSignals: stored.signals,
    })).toEqual({ status: 'fresh', staleReasons: [] });

    const stale = assessMemoryQuarantineRecommendationFreshness(stored, {
      currentLifecycleRevision: 5,
      currentEvaluatorVersion: 'quarantine-v2',
      currentSignals: [stored.signals[0]],
    });
    expect(stale.status).toBe('stale');
    expect(stale.staleReasons).toEqual([
      'lifecycle_revision_changed',
      'evaluator_version_changed',
      'signal_basis_changed',
    ]);
  });

  it('survives durable restart and exact replay without duplicate records', () => {
    const directory = mkdtempSync(join(tmpdir(), 'efesto-quarantine-'));
    directories.push(directory);
    const filePath = join(directory, 'recommendations.json');
    const first = new DurableMemoryQuarantineRecommendationRepository(filePath);
    const appended = first.append(recommendation());
    expect(appended.kind).toBe('appended');

    const restarted = new DurableMemoryQuarantineRecommendationRepository(filePath);
    expect(restarted.list('memory:alpha')).toHaveLength(1);
    expect(restarted.append(recommendation('2026-08-09T14:00:00.000Z')).kind).toBe('replayed');
    expect(restarted.list('memory:alpha')).toHaveLength(1);
  });

  it('fails closed on corrupt or tampered durable content', () => {
    const directory = mkdtempSync(join(tmpdir(), 'efesto-quarantine-'));
    directories.push(directory);
    const filePath = join(directory, 'recommendations.json');
    writeFileSync(filePath, '{not-json', 'utf8');
    expect(() => new DurableMemoryQuarantineRecommendationRepository(filePath).list())
      .toThrowError(MemoryQuarantineRecommendationConflictError);

    const repository = new DurableMemoryQuarantineRecommendationRepository(filePath);
    writeFileSync(filePath, JSON.stringify({ version: 1, recommendations: [] }), 'utf8');
    repository.append(recommendation());
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    parsed.recommendations[0].signals[0].referenceIds[0] = 'evidence:tampered';
    writeFileSync(filePath, JSON.stringify(parsed), 'utf8');
    expect(() => new DurableMemoryQuarantineRecommendationRepository(filePath).list())
      .toThrowError(MemoryQuarantineRecommendationConflictError);
  });
});
