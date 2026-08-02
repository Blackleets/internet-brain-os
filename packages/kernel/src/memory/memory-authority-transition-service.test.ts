import { describe, expect, it } from 'vitest';
import {
  MemoryAuthorityTransitionService,
  type ExecuteMemoryAuthorityTransitionInput,
} from './memory-authority-transition-service';
import { InMemoryMemoryAuthorityReceiptRepository } from './memory-authority-receipt-repository';

function approvedInput(
  overrides: Partial<ExecuteMemoryAuthorityTransitionInput> = {},
): ExecuteMemoryAuthorityTransitionInput {
  const approval = {
    decisionId: 'approval-1',
    approver: { id: 'human-1', type: 'human' as const },
    outcome: 'approved' as const,
    policyVersion: 'memory-policy-v1',
  };

  return {
    transition: {
      from: 'proposed',
      to: 'admitted',
      executor: { id: 'kernel-1', type: 'kernel' },
      policyVersion: 'memory-policy-v1',
      approvalDecisions: [approval],
      hasValidAdmissionRecord: true,
      hasResolvedContradictions: true,
    },
    receipt: {
      memoryId: 'memory-1',
      from: 'proposed',
      to: 'admitted',
      requestId: 'request-1',
      expectedRevision: 0,
      executor: { id: 'kernel-1', type: 'kernel' },
      policyVersion: 'memory-policy-v1',
      approvalDecisions: [approval],
      evidenceIds: ['evidence-1'],
      admissionRecordIds: ['admission-1'],
      contradictionDecisionIds: ['contradiction-1'],
      reasonCode: 'validation_passed',
      reason: 'Admission gates passed.',
    },
    occurredAt: '2026-08-02T20:00:00.000Z',
    ...overrides,
  };
}

describe('MemoryAuthorityTransitionService', () => {
  it('validates and appends one authorized transition', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const service = new MemoryAuthorityTransitionService(repository);

    const result = service.execute(approvedInput());

    expect(result).toMatchObject({
      ok: true,
      kind: 'appended',
      state: 'admitted',
      revision: 1,
    });
    expect(repository.list('memory-1')).toHaveLength(1);
  });

  it('returns the original receipt for an exact replay even after state advanced', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const service = new MemoryAuthorityTransitionService(repository);
    const first = service.execute(approvedInput());

    const replay = service.execute(approvedInput({
      occurredAt: '2026-08-02T21:00:00.000Z',
    }));

    expect(first.ok).toBe(true);
    expect(replay).toMatchObject({ ok: true, kind: 'replayed', revision: 1 });
    if (first.ok && replay.ok) expect(replay.receipt).toEqual(first.receipt);
    expect(repository.list('memory-1')).toHaveLength(1);
  });

  it('rejects altered replay before lifecycle validation can mask it', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const service = new MemoryAuthorityTransitionService(repository);
    service.execute(approvedInput());

    const altered = approvedInput();
    const result = service.execute({
      ...altered,
      transition: { ...altered.transition, to: 'rejected' },
      receipt: { ...altered.receipt, to: 'rejected', reasonCode: 'human_rejected' },
    });

    expect(result).toMatchObject({ ok: false, code: 'ALTERED_REPLAY' });
    expect(repository.list('memory-1')).toHaveLength(1);
  });

  it('fails closed without writing when lifecycle authorization rejects the request', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const service = new MemoryAuthorityTransitionService(repository);
    const input = approvedInput();

    const result = service.execute({
      ...input,
      transition: { ...input.transition, approvalDecisions: [] },
      receipt: { ...input.receipt, approvalDecisions: [] },
    });

    expect(result).toMatchObject({ ok: false, code: 'MISSING_APPROVAL' });
    expect(repository.list('memory-1')).toHaveLength(0);
  });

  it('rejects mismatched validator and receipt contracts without writing', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const service = new MemoryAuthorityTransitionService(repository);
    const input = approvedInput();

    const result = service.execute({
      ...input,
      receipt: { ...input.receipt, policyVersion: 'memory-policy-v2' },
    });

    expect(result).toMatchObject({ ok: false, code: 'CONTRACT_MISMATCH' });
    expect(repository.list('memory-1')).toHaveLength(0);
  });

  it('rejects approval references that differ from those authorized', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const service = new MemoryAuthorityTransitionService(repository);
    const input = approvedInput();

    const result = service.execute({
      ...input,
      receipt: {
        ...input.receipt,
        approvalDecisions: [{
          decisionId: 'approval-other',
          approver: { id: 'human-1', type: 'human' },
          outcome: 'approved',
          policyVersion: 'memory-policy-v1',
        }],
      },
    });

    expect(result).toMatchObject({ ok: false, code: 'CONTRACT_MISMATCH' });
    expect(repository.list('memory-1')).toHaveLength(0);
  });

  it('surfaces stale revision conflicts without partial writes', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const service = new MemoryAuthorityTransitionService(repository);
    service.execute(approvedInput());
    const next = approvedInput();

    const result = service.execute({
      ...next,
      transition: {
        from: 'admitted',
        to: 'quarantined',
        executor: { id: 'kernel-1', type: 'kernel' },
        policyVersion: 'memory-policy-v1',
        hasPersistedQuarantineSignal: true,
      },
      receipt: {
        ...next.receipt,
        from: 'admitted',
        to: 'quarantined',
        requestId: 'request-2',
        expectedRevision: 0,
        approvalDecisions: [],
        reasonCode: 'unresolved_contradiction',
      },
    });

    expect(result).toMatchObject({ ok: false, code: 'REVISION_CONFLICT' });
    expect(repository.list('memory-1')).toHaveLength(1);
  });

  it('does not swallow unknown repository failures', () => {
    const repository = {
      append: () => { throw new Error('storage unavailable'); },
      list: () => [],
      findByRequestId: () => undefined,
    };
    const service = new MemoryAuthorityTransitionService(repository);

    expect(() => service.execute(approvedInput())).toThrow('storage unavailable');
  });
});
