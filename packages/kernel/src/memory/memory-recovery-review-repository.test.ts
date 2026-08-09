import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  InMemoryMemoryRecoveryReviewRepository,
  MemoryRecoveryReviewConflictError,
  assessMemoryRecoveryReviewFreshness,
  verifyMemoryRecoveryReviewIntegrity,
  type MemoryRecoveryReviewRequest,
} from './memory-recovery-review-repository';
import { DurableMemoryRecoveryReviewRepository } from './durable-memory-recovery-review-repository';

const directories: string[] = [];
afterEach(() => {
  while (directories.length > 0) rmSync(directories.pop()!, { recursive: true, force: true });
});

function request(overrides: Partial<MemoryRecoveryReviewRequest> = {}): MemoryRecoveryReviewRequest {
  return {
    terminalMemoryId: 'memory:terminal',
    terminalState: 'revoked',
    terminalRevision: 6,
    requestId: 'recovery-request:1',
    requestedBy: { id: 'recovery:operator', type: 'recovery' },
    reviewer: { id: 'founder:1', type: 'founder' },
    policyVersion: 'memory-policy-v1',
    requiresFounderApproval: true,
    outcome: 'approved_new_candidate',
    replacementCandidateMemoryId: 'memory:candidate:new',
    reason: 'New verified evidence justifies a new candidate review.',
    occurredAt: '2026-08-09T14:00:00.000Z' as IsoDateTime,
    ...overrides,
  };
}

describe('terminal memory recovery review repository', () => {
  it('records founder-approved recovery without reopening the terminal memory id', () => {
    const repository = new InMemoryMemoryRecoveryReviewRepository();
    const result = repository.append(request());
    expect(result.kind).toBe('appended');
    expect(result.review.terminalMemoryId).toBe('memory:terminal');
    expect(result.review.replacementCandidateMemoryId).toBe('memory:candidate:new');
    expect(result.review.replacementCandidateMemoryId).not.toBe(result.review.terminalMemoryId);
    expect(verifyMemoryRecoveryReviewIntegrity(result.review)).toBe(true);
  });

  it('rejects non-terminal memory and unauthorized automated reviewers', () => {
    expect(() => new InMemoryMemoryRecoveryReviewRepository().append(request({
      terminalState: 'admitted' as never,
    }))).toThrowError(MemoryRecoveryReviewConflictError);

    expect(() => new InMemoryMemoryRecoveryReviewRepository().append(request({
      reviewer: { id: 'kernel:1', type: 'kernel' },
      requiresFounderApproval: false,
    }))).toThrowError(MemoryRecoveryReviewConflictError);
  });

  it('enforces founder approval when the governing review requires it', () => {
    expect(() => new InMemoryMemoryRecoveryReviewRepository().append(request({
      reviewer: { id: 'human:1', type: 'human' },
      requiresFounderApproval: true,
    }))).toThrowError(MemoryRecoveryReviewConflictError);
  });

  it('requires an approved recovery to point at a distinct new candidate identity', () => {
    const repository = new InMemoryMemoryRecoveryReviewRepository();
    expect(() => repository.append(request({ replacementCandidateMemoryId: undefined })))
      .toThrowError(MemoryRecoveryReviewConflictError);
    expect(() => repository.append(request({ replacementCandidateMemoryId: 'memory:terminal' })))
      .toThrowError(MemoryRecoveryReviewConflictError);
  });

  it('allows a human denial without creating a replacement candidate', () => {
    const record = new InMemoryMemoryRecoveryReviewRepository().append(request({
      reviewer: { id: 'human:1', type: 'human' },
      requiresFounderApproval: false,
      outcome: 'denied',
      replacementCandidateMemoryId: 'ignored',
    })).review;
    expect(record.outcome).toBe('denied');
    expect(record.replacementCandidateMemoryId).toBeUndefined();
  });

  it('is idempotent by requestId and rejects altered replay', () => {
    const repository = new InMemoryMemoryRecoveryReviewRepository();
    const first = repository.append(request());
    const replay = repository.append(request());
    expect(first.kind).toBe('appended');
    expect(replay.kind).toBe('replayed');
    expect(replay.review.reviewId).toBe(first.review.reviewId);
    expect(() => repository.append(request({ reason: 'altered' })))
      .toThrowError(MemoryRecoveryReviewConflictError);
  });

  it('marks review state stale when policy or terminal record context changes', () => {
    const review = new InMemoryMemoryRecoveryReviewRepository().append(request()).review;
    expect(assessMemoryRecoveryReviewFreshness(review, {
      terminalState: 'revoked', terminalRevision: 6, policyVersion: 'memory-policy-v1',
    })).toEqual({ status: 'fresh', staleReasons: [] });
    expect(assessMemoryRecoveryReviewFreshness(review, {
      terminalState: 'superseded', terminalRevision: 7, policyVersion: 'memory-policy-v2',
    })).toEqual({
      status: 'stale',
      staleReasons: ['terminal_state_changed', 'terminal_revision_changed', 'policy_version_changed'],
    });
  });

  it('survives durable restart and rejects tampered history', () => {
    const directory = mkdtempSync(join(tmpdir(), 'efesto-recovery-review-'));
    directories.push(directory);
    const filePath = join(directory, 'reviews.json');
    const durable = new DurableMemoryRecoveryReviewRepository(filePath);
    expect(durable.append(request()).kind).toBe('appended');

    const restarted = new DurableMemoryRecoveryReviewRepository(filePath);
    expect(restarted.list('memory:terminal')).toHaveLength(1);
    expect(restarted.append(request()).kind).toBe('replayed');

    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    parsed.reviews[0].replacementCandidateMemoryId = 'memory:tampered';
    writeFileSync(filePath, JSON.stringify(parsed), 'utf8');
    expect(() => new DurableMemoryRecoveryReviewRepository(filePath).list())
      .toThrowError(MemoryRecoveryReviewConflictError);
  });

  it('fails closed on corrupt durable JSON', () => {
    const directory = mkdtempSync(join(tmpdir(), 'efesto-recovery-review-'));
    directories.push(directory);
    const filePath = join(directory, 'reviews.json');
    writeFileSync(filePath, '{broken', 'utf8');
    expect(() => new DurableMemoryRecoveryReviewRepository(filePath).list())
      .toThrowError(MemoryRecoveryReviewConflictError);
  });
});
