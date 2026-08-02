import { describe, expect, it } from 'vitest';
import { projectMemoryAuthorityState } from './memory-authority-projector';
import {
  InMemoryMemoryAuthorityReceiptRepository,
  type MemoryAuthorityReceiptPayload,
  type MemoryAuthorityTransitionReceipt,
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
    evidenceIds: ['evidence-1'],
    contradictionDecisionIds: ['contradiction-1'],
    admissionRecordIds: ['admission-1'],
    reasonCode: 'validation_passed',
    reason: 'Admission gates passed.',
    ...overrides,
  };
}

function append(
  repository: InMemoryMemoryAuthorityReceiptRepository,
  overrides: Partial<MemoryAuthorityReceiptPayload> = {},
): MemoryAuthorityTransitionReceipt {
  return repository.append(payload(overrides), '2026-08-02T20:00:00.000Z').receipt;
}

describe('projectMemoryAuthorityState', () => {
  it('rebuilds the current authority state and revision from an ordered valid chain', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const admitted = append(repository);
    const quarantined = append(repository, {
      from: 'admitted',
      to: 'quarantined',
      requestId: 'request-2',
      expectedRevision: 1,
      reasonCode: 'integrity_signal',
      reason: 'A persisted signal requires isolation.',
    });

    expect(projectMemoryAuthorityState('memory-1', [admitted, quarantined])).toEqual({
      status: 'valid',
      memoryId: 'memory-1',
      state: 'quarantined',
      revision: 2,
      receiptIds: [admitted.receiptId, quarantined.receiptId],
    });
  });

  it('blocks an empty chain instead of inventing a default authority state', () => {
    expect(projectMemoryAuthorityState('memory-1', [])).toMatchObject({
      status: 'blocked',
      failureCode: 'EMPTY_CHAIN',
    });
  });

  it('blocks receipt tampering before projecting state', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const receipt = append(repository);
    const tampered = { ...receipt, reason: 'altered after append' };

    expect(projectMemoryAuthorityState('memory-1', [tampered])).toMatchObject({
      status: 'blocked',
      failureCode: 'INVALID_INTEGRITY',
      failedReceiptId: receipt.receiptId,
    });
  });

  it('blocks cross-memory contamination', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const receipt = append(repository, { memoryId: 'memory-2' });

    expect(projectMemoryAuthorityState('memory-1', [receipt])).toMatchObject({
      status: 'blocked',
      failureCode: 'CROSS_MEMORY_RECEIPT',
    });
  });

  it('blocks out-of-order receipts and revision gaps without sorting by timestamp', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const first = append(repository);
    const second = append(repository, {
      from: 'admitted',
      to: 'quarantined',
      requestId: 'request-2',
      expectedRevision: 1,
    });

    expect(projectMemoryAuthorityState('memory-1', [second, first])).toMatchObject({
      status: 'blocked',
      failureCode: 'REVISION_GAP',
      failedReceiptId: second.receiptId,
    });
  });

  it('blocks a state mismatch even when each receipt has valid integrity', () => {
    const admittedRepository = new InMemoryMemoryAuthorityReceiptRepository();
    const admitted = append(admittedRepository);

    const alternateRepository = new InMemoryMemoryAuthorityReceiptRepository();
    append(alternateRepository, { to: 'quarantined' });
    const alternateSecond = append(alternateRepository, {
      from: 'quarantined',
      to: 'admitted',
      requestId: 'request-2',
      expectedRevision: 1,
    });

    expect(projectMemoryAuthorityState('memory-1', [admitted, alternateSecond])).toMatchObject({
      status: 'blocked',
      failureCode: 'STATE_MISMATCH',
      failedReceiptId: alternateSecond.receiptId,
    });
  });

  it('blocks lifecycle transitions that are structurally impossible', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const invalid = append(repository, { to: 'revoked' });

    expect(projectMemoryAuthorityState('memory-1', [invalid])).toMatchObject({
      status: 'blocked',
      failureCode: 'INVALID_TRANSITION',
    });
  });

  it('blocks any receipt after a terminal authority state', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const rejected = append(repository, { to: 'rejected' });
    const continuation = append(repository, {
      from: 'rejected',
      to: 'proposed',
      requestId: 'request-2',
      expectedRevision: 1,
    });

    expect(projectMemoryAuthorityState('memory-1', [rejected, continuation])).toMatchObject({
      status: 'blocked',
      failureCode: 'TERMINAL_CONTINUATION',
      failedReceiptId: continuation.receiptId,
    });
  });

  it('returns defensive receipt identifiers in the valid projection', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const receipt = append(repository);
    const projection = projectMemoryAuthorityState('memory-1', [receipt]);

    expect(projection.status).toBe('valid');
    if (projection.status !== 'valid') return;
    (projection.receiptIds as string[]).push('tampered');

    expect(projectMemoryAuthorityState('memory-1', [receipt])).toMatchObject({
      status: 'valid',
      receiptIds: [receipt.receiptId],
    });
  });
});
