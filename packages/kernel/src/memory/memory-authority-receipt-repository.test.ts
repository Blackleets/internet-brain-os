import { describe, expect, it } from 'vitest';
import {
  InMemoryMemoryAuthorityReceiptRepository,
  MemoryAuthorityReceiptConflictError,
  verifyMemoryAuthorityReceiptIntegrity,
  type MemoryAuthorityReceiptPayload,
} from './memory-authority-receipt-repository';

function payload(overrides: Partial<MemoryAuthorityReceiptPayload> = {}): MemoryAuthorityReceiptPayload {
  return {
    memoryId: 'memory-1',
    from: 'proposed',
    to: 'admitted',
    requestId: 'request-1',
    expectedRevision: 0,
    executor: { id: 'kernel-1', type: 'kernel' },
    policyVersion: 'memory-policy-v1',
    approvalDecisions: [{
      decisionId: 'approval-1',
      approver: { id: 'human-1', type: 'human' },
      outcome: 'approved',
      policyVersion: 'memory-policy-v1',
    }],
    evidenceIds: ['evidence-2', 'evidence-1'],
    contradictionDecisionIds: ['contradiction-1'],
    admissionRecordIds: ['admission-1'],
    reasonCode: 'validation_passed',
    reason: 'Admission gates passed.',
    ...overrides,
  };
}

describe('InMemoryMemoryAuthorityReceiptRepository', () => {
  it('appends one immutable receipt with a sequential revision and valid integrity digest', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const result = repository.append(payload(), '2026-08-02T18:00:00.000Z');

    expect(result.kind).toBe('appended');
    expect(result.receipt.resultingRevision).toBe(1);
    expect(result.receipt.receiptId).toContain(result.receipt.integrityDigest);
    expect(verifyMemoryAuthorityReceiptIntegrity(result.receipt)).toBe(true);
    expect(repository.list('memory-1')).toEqual([result.receipt]);
  });

  it('returns the original receipt for an exact replay without appending twice', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const first = repository.append(payload(), '2026-08-02T18:00:00.000Z');
    const replay = repository.append(
      payload({
        evidenceIds: ['evidence-1', 'evidence-2', 'evidence-1'],
      }),
      '2026-08-02T19:00:00.000Z',
    );

    expect(replay.kind).toBe('replayed');
    expect(replay.receipt).toEqual(first.receipt);
    expect(repository.list('memory-1')).toHaveLength(1);
  });

  it('rejects an altered replay using the same requestId', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    repository.append(payload(), '2026-08-02T18:00:00.000Z');

    expect(() => repository.append(
      payload({ to: 'rejected', reasonCode: 'human_rejected' }),
      '2026-08-02T19:00:00.000Z',
    )).toThrowError(MemoryAuthorityReceiptConflictError);

    try {
      repository.append(payload({ to: 'rejected' }), '2026-08-02T19:00:00.000Z');
    } catch (error) {
      expect(error).toMatchObject({ code: 'ALTERED_REPLAY' });
    }
  });

  it('binds a requestId globally so it cannot be reused for another memory', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    repository.append(payload(), '2026-08-02T18:00:00.000Z');

    expect(() => repository.append(
      payload({ memoryId: 'memory-2' }),
      '2026-08-02T19:00:00.000Z',
    )).toThrowError(expect.objectContaining({ code: 'ALTERED_REPLAY' }));
  });

  it('rejects stale revisions, state mismatches, and revision gaps', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    repository.append(payload(), '2026-08-02T18:00:00.000Z');

    expect(() => repository.append(
      payload({ requestId: 'request-2', expectedRevision: 0, from: 'admitted', to: 'quarantined' }),
      '2026-08-02T19:00:00.000Z',
    )).toThrowError(expect.objectContaining({ code: 'REVISION_CONFLICT' }));

    expect(() => repository.append(
      payload({ requestId: 'request-3', expectedRevision: 1, from: 'proposed', to: 'quarantined' }),
      '2026-08-02T19:00:00.000Z',
    )).toThrowError(expect.objectContaining({ code: 'STATE_CONFLICT' }));

    const empty = new InMemoryMemoryAuthorityReceiptRepository();
    expect(() => empty.append(
      payload({ requestId: 'request-gap', expectedRevision: 2 }),
      '2026-08-02T19:00:00.000Z',
    )).toThrowError(expect.objectContaining({ code: 'REVISION_CONFLICT' }));
  });

  it('returns defensive copies and detects receipt tampering', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    repository.append(payload(), '2026-08-02T18:00:00.000Z');
    const listed = repository.list('memory-1');

    (listed[0].evidenceIds as string[]).push('mutated');
    expect(repository.list('memory-1')[0].evidenceIds).toEqual(['evidence-2', 'evidence-1']);

    const tampered = { ...repository.list('memory-1')[0], reason: 'altered' };
    expect(verifyMemoryAuthorityReceiptIntegrity(tampered)).toBe(false);
  });
});
