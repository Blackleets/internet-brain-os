import { describe, expect, it } from 'vitest';
import { InMemoryMemoryAuthorityReceiptRepository } from './memory-authority-receipt-repository';
import { reconcileMemoryAuthorityAtStartup } from './memory-authority-reconciliation';

function admittedReceipt(memoryId = 'memory-1', requestId = 'request-1') {
  const repository = new InMemoryMemoryAuthorityReceiptRepository();
  return repository.append({
    memoryId,
    from: 'proposed',
    to: 'admitted',
    requestId,
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
  }, '2026-08-02T20:00:00.000Z').receipt;
}

const references = {
  evidenceIds: ['evidence-1'],
  contradictionDecisionIds: ['contradiction-1'],
  admissionRecordIds: ['admission-1'],
  approvalDecisionIds: ['approval-1'],
};

describe('reconcileMemoryAuthorityAtStartup', () => {
  it('marks an admitted valid chain as reusable', () => {
    const report = reconcileMemoryAuthorityAtStartup([
      { memoryId: 'memory-1', receipts: [admittedReceipt()] },
    ], references);

    expect(report.entries[0]).toMatchObject({ status: 'valid', reusable: true });
    expect(report.counts.valid).toBe(1);
  });

  it('blocks valid non-admitted state from reuse', () => {
    const repository = new InMemoryMemoryAuthorityReceiptRepository();
    const receipt = repository.append({
      memoryId: 'memory-1', from: 'proposed', to: 'quarantined', requestId: 'request-1', expectedRevision: 0,
      executor: { id: 'kernel-1', type: 'kernel' }, policyVersion: 'memory-policy-v1',
      reasonCode: 'risk_signal', reason: 'Persisted deterministic risk signal.',
    }, '2026-08-02T20:00:00.000Z').receipt;

    expect(reconcileMemoryAuthorityAtStartup([{ memoryId: 'memory-1', receipts: [receipt] }]).entries[0])
      .toMatchObject({ status: 'valid', reusable: false });
  });

  it('classifies empty legacy chains as migration required', () => {
    const entry = reconcileMemoryAuthorityAtStartup([{ memoryId: 'legacy-1', receipts: [] }]).entries[0];
    expect(entry).toMatchObject({ status: 'migration_required', reusable: false });
  });

  it('blocks missing references', () => {
    const entry = reconcileMemoryAuthorityAtStartup([
      { memoryId: 'memory-1', receipts: [admittedReceipt()] },
    ], { ...references, evidenceIds: [] }).entries[0];

    expect(entry).toMatchObject({ status: 'missing_reference', reusable: false });
    expect(entry.missingReferenceIds).toEqual(['evidence-1']);
  });

  it('classifies receipt tampering as integrity failure', () => {
    const receipt = { ...admittedReceipt(), reason: 'tampered' };
    expect(reconcileMemoryAuthorityAtStartup([{ memoryId: 'memory-1', receipts: [receipt] }]).entries[0])
      .toMatchObject({ status: 'integrity_failure', reusable: false });
  });

  it('blocks duplicate memory identities and cross-memory request reuse as ambiguous', () => {
    const duplicate = reconcileMemoryAuthorityAtStartup([
      { memoryId: 'memory-1', receipts: [admittedReceipt()] },
      { memoryId: 'memory-1', receipts: [admittedReceipt('memory-1', 'request-2')] },
    ], references);
    expect(duplicate.entries.every((entry) => entry.status === 'ambiguous_chain')).toBe(true);

    const reused = reconcileMemoryAuthorityAtStartup([
      { memoryId: 'memory-1', receipts: [admittedReceipt('memory-1', 'shared')] },
      { memoryId: 'memory-2', receipts: [admittedReceipt('memory-2', 'shared')] },
    ], references);
    expect(reused.entries.every((entry) => entry.status === 'ambiguous_chain')).toBe(true);
  });

  it('returns defensive report arrays', () => {
    const report = reconcileMemoryAuthorityAtStartup([
      { memoryId: 'memory-1', receipts: [admittedReceipt()] },
    ], references);
    (report.entries[0].missingReferenceIds as string[]).push('tampered');
    expect(report.entries[0].missingReferenceIds).toEqual(['tampered']);

    const fresh = reconcileMemoryAuthorityAtStartup([
      { memoryId: 'memory-1', receipts: [admittedReceipt()] },
    ], references);
    expect(fresh.entries[0].missingReferenceIds).toEqual([]);
  });
});
