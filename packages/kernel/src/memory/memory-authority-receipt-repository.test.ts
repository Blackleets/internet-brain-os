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
    quarantineSignalIds: ['signal-1'],
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
    expect(result.receipt.evidenceIds).toEqual(['evidence-1', 'evidence-2']);
    expect(result.receipt.quarantineSignalIds).toEqual(['signal-1']);
    expect(verifyMemoryAuthorityReceiptIntegrity(result.receipt)).toBe(true);
    expect(repository.list('memory-1')).toEqual([result.receipt]);
  });

  it('returns the original receipt for an exact normalized replay without appending twice', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const first = repository.append(payload(), '2026-08-02T18:00:00.000Z');
    const replay = repository.append(
      payload({
        memoryId: ' memory-1 ',
        requestId: ' request-1 ',
        executor: { id: ' kernel-1 ', type: 'kernel' },
        evidenceIds: ['evidence-1', ' evidence-2 ', 'evidence-1'],
        quarantineSignalIds: [' signal-1 ', 'signal-1'],
      }),
      '2026-08-02T19:00:00.000Z',
    );

    expect(replay.kind).toBe('replayed');
    expect(replay.receipt).toEqual(first.receipt);
    expect(repository.list(' memory-1 ')).toHaveLength(1);
    expect(repository.findByRequestId(' request-1 ')).toEqual(first.receipt);
  });

  it('rejects an altered replay using the same normalized requestId', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    repository.append(payload(), '2026-08-02T18:00:00.000Z');

    expect(() => repository.append(
      payload({ requestId: ' request-1 ', to: 'rejected', reasonCode: 'human_rejected' }),
      '2026-08-02T19:00:00.000Z',
    )).toThrowError(expect.objectContaining({ code: 'ALTERED_REPLAY' }));
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

  it('normalizes unordered approvals and reference sets for replay safety', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const first = repository.append(payload({
      approvalDecisions: [
        {
          decisionId: 'approval-2',
          approver: { id: 'founder-1', type: 'founder' },
          outcome: 'approved',
          policyVersion: 'memory-policy-v1',
        },
        {
          decisionId: 'approval-1',
          approver: { id: 'human-1', type: 'human' },
          outcome: 'approved',
          policyVersion: 'memory-policy-v1',
        },
      ],
      evidenceIds: ['evidence-2', 'evidence-1', 'evidence-1'],
    }), '2026-08-02T18:00:00.000Z');
    const replay = repository.append(payload({
      approvalDecisions: [
        {
          decisionId: 'approval-1',
          approver: { id: 'human-1', type: 'human' },
          outcome: 'approved',
          policyVersion: 'memory-policy-v1',
        },
        {
          decisionId: 'approval-2',
          approver: { id: 'founder-1', type: 'founder' },
          outcome: 'approved',
          policyVersion: 'memory-policy-v1',
        },
      ],
      evidenceIds: ['evidence-1', 'evidence-2'],
    }), '2026-08-02T19:00:00.000Z');

    expect(replay.kind).toBe('replayed');
    expect(replay.receipt).toEqual(first.receipt);
  });

  it('returns defensive copies and detects receipt tampering', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    repository.append(payload(), '2026-08-02T18:00:00.000Z');
    const listed = repository.list('memory-1');

    (listed[0].evidenceIds as string[]).push('mutated');
    (listed[0].quarantineSignalIds as string[]).push('mutated-signal');
    expect(repository.list('memory-1')[0].evidenceIds).toEqual(['evidence-1', 'evidence-2']);
    expect(repository.list('memory-1')[0].quarantineSignalIds).toEqual(['signal-1']);

    const tampered = { ...repository.list('memory-1')[0], reason: 'altered' };
    expect(verifyMemoryAuthorityReceiptIntegrity(tampered)).toBe(false);
  });

  it('rejects empty normalized fields, blank references, and unsafe revisions before writing', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();

    expect(() => repository.append(payload({ requestId: '   ' }), '2026-08-02T18:00:00.000Z'))
      .toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(() => repository.append(payload({ evidenceIds: ['evidence-1', '   '] }), '2026-08-02T18:00:00.000Z'))
      .toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(() => repository.append(payload({ expectedRevision: Number.MAX_SAFE_INTEGER + 1 }), '2026-08-02T18:00:00.000Z'))
      .toThrowError(expect.objectContaining({ code: 'INVALID_REVISION' }));
    expect(repository.list('memory-1')).toHaveLength(0);
  });

  it('does not include retry time in the replay identity but preserves the original receipt time', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const first = repository.append(payload(), '2026-08-02T18:00:00.000Z');
    const replay = repository.append(payload(), '2026-08-03T18:00:00.000Z');

    expect(replay.kind).toBe('replayed');
    expect(replay.receipt.occurredAt).toBe(first.receipt.occurredAt);
  });

  it('uses the declared conflict error for invalid data', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();

    expect(() => repository.append(payload({ reason: '' }), '2026-08-02T18:00:00.000Z'))
      .toThrowError(MemoryAuthorityReceiptConflictError);
  });
});
