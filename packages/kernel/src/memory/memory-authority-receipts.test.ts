import { describe, expect, it } from 'vitest';
import {
  InMemoryMemoryTransitionReceiptRepository,
  MemoryReceiptAppendError,
  verifyMemoryTransitionReceipt,
  type MemoryTransitionReceiptInput,
} from './memory-authority-receipts';

function input(overrides: Partial<MemoryTransitionReceiptInput> = {}): MemoryTransitionReceiptInput {
  return {
    memoryId: 'memory-1',
    from: 'proposed',
    to: 'admitted',
    requestId: 'request-1',
    expectedRevision: 0,
    executor: { id: 'kernel-1', type: 'kernel' },
    approvalDecisions: [{
      decisionId: 'approval-1',
      approver: { id: 'human-1', type: 'human' },
      outcome: 'approved',
      policyVersion: 'memory-policy-v1',
    }],
    policyVersion: 'memory-policy-v1',
    evidenceIds: ['evidence-2', 'evidence-1'],
    contradictionDecisionIds: ['decision-1'],
    admissionRecordIds: ['admission-1'],
    reasonCode: 'validation_passed',
    reason: 'Admission gates passed.',
    occurredAt: '2026-08-02T20:00:00.000Z',
    ...overrides,
  };
}

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error('Expected action to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(MemoryReceiptAppendError);
    expect((error as MemoryReceiptAppendError).code).toBe(code);
  }
}

describe('InMemoryMemoryTransitionReceiptRepository', () => {
  it('appends one immutable receipt with a continuous revision and valid integrity digest', () => {
    const repository = new InMemoryMemoryTransitionReceiptRepository();
    const receipt = repository.append(input());

    expect(receipt.resultingRevision).toBe(1);
    expect(receipt.receiptId).toMatch(/^memory-receipt:/);
    expect(receipt.evidenceIds).toEqual(['evidence-1', 'evidence-2']);
    expect(verifyMemoryTransitionReceipt(receipt)).toBe(true);
    expect(repository.list('memory-1')).toEqual([receipt]);
  });

  it('returns the original receipt for an exact replay without appending again', () => {
    const repository = new InMemoryMemoryTransitionReceiptRepository();
    const first = repository.append(input());
    const replay = repository.append(input({ evidenceIds: ['evidence-1', 'evidence-2'] }));

    expect(replay).toEqual(first);
    expect(repository.list('memory-1')).toHaveLength(1);
  });

  it('blocks an altered replay using the same requestId', () => {
    const repository = new InMemoryMemoryTransitionReceiptRepository();
    repository.append(input());

    expectCode(
      () => repository.append(input({ reason: 'Altered reason.' })),
      'ALTERED_REPLAY',
    );
    expect(repository.list('memory-1')).toHaveLength(1);
  });

  it('binds a requestId globally so it cannot be reused for another memory', () => {
    const repository = new InMemoryMemoryTransitionReceiptRepository();
    repository.append(input());

    expectCode(
      () => repository.append(input({ memoryId: 'memory-2' })),
      'ALTERED_REPLAY',
    );
  });

  it('rejects stale revisions and revision gaps', () => {
    const repository = new InMemoryMemoryTransitionReceiptRepository();
    repository.append(input());

    expectCode(
      () => repository.append(input({ requestId: 'request-2', expectedRevision: 0, from: 'admitted', to: 'quarantined' })),
      'REVISION_CONFLICT',
    );
    expectCode(
      () => repository.append(input({ requestId: 'request-3', expectedRevision: 2, from: 'admitted', to: 'quarantined' })),
      'REVISION_CONFLICT',
    );
  });

  it('rejects a transition whose from state does not match the projected chain', () => {
    const repository = new InMemoryMemoryTransitionReceiptRepository();
    repository.append(input());

    expectCode(
      () => repository.append(input({
        requestId: 'request-2',
        expectedRevision: 1,
        from: 'proposed',
        to: 'rejected',
      })),
      'STATE_CONFLICT',
    );
  });

  it('normalizes unordered set-like references and approvals for replay safety', () => {
    const repository = new InMemoryMemoryTransitionReceiptRepository();
    const first = repository.append(input({
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
    }));
    const replay = repository.append(input({
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
    }));

    expect(replay).toEqual(first);
  });

  it('returns defensive copies from append, list, and request lookup', () => {
    const repository = new InMemoryMemoryTransitionReceiptRepository();
    const receipt = repository.append(input()) as { evidenceIds?: string[] };
    receipt.evidenceIds?.push('tampered');

    const listed = repository.list('memory-1')[0] as { evidenceIds?: string[] };
    listed.evidenceIds?.push('also-tampered');

    expect(repository.findByRequestId('request-1')?.evidenceIds).toEqual(['evidence-1', 'evidence-2']);
  });

  it('detects receipt tampering through the integrity digest', () => {
    const repository = new InMemoryMemoryTransitionReceiptRepository();
    const receipt = repository.append(input());

    expect(verifyMemoryTransitionReceipt({ ...receipt, reason: 'tampered' })).toBe(false);
  });

  it('rejects empty identities and invalid revisions before writing', () => {
    const repository = new InMemoryMemoryTransitionReceiptRepository();

    expectCode(() => repository.append(input({ requestId: '   ' })), 'INVALID_INPUT');
    expectCode(() => repository.append(input({ expectedRevision: -1 })), 'INVALID_INPUT');
    expect(repository.list('memory-1')).toHaveLength(0);
  });
});
