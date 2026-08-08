import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DurableMemoryAuthorityReceiptRepository } from './durable-memory-authority-receipt-repository';
import { MemoryAuthorityReceiptConflictError, type MemoryAuthorityReceiptPayload } from './memory-authority-receipt-repository';

const temporaryDirectories: string[] = [];

function tempFile(): string {
  const directory = mkdtempSync(join(tmpdir(), 'hephaestus-authority-'));
  temporaryDirectories.push(directory);
  return join(directory, 'authority-receipts.json');
}

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

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('DurableMemoryAuthorityReceiptRepository', () => {
  it('survives process-style restart and reconstructs the exact authority chain', () => {
    const file = tempFile();
    const firstProcess = new DurableMemoryAuthorityReceiptRepository(file);
    const appended = firstProcess.append(payload(), '2026-08-08T15:00:00.000Z');

    const restarted = new DurableMemoryAuthorityReceiptRepository(file);
    expect(restarted.list('memory-1')).toEqual([appended.receipt]);
    expect(restarted.findByRequestId('request-1')).toEqual(appended.receipt);
  });

  it('keeps exact replay idempotent after restart without adding another receipt', () => {
    const file = tempFile();
    const first = new DurableMemoryAuthorityReceiptRepository(file).append(payload(), '2026-08-08T15:00:00.000Z');
    const restarted = new DurableMemoryAuthorityReceiptRepository(file);
    const replay = restarted.append(payload(), '2026-08-08T16:00:00.000Z');

    expect(replay.kind).toBe('replayed');
    expect(replay.receipt).toEqual(first.receipt);
    expect(restarted.list('memory-1')).toHaveLength(1);
  });

  it('rejects altered replay after restart', () => {
    const file = tempFile();
    new DurableMemoryAuthorityReceiptRepository(file).append(payload(), '2026-08-08T15:00:00.000Z');
    const restarted = new DurableMemoryAuthorityReceiptRepository(file);

    expect(() => restarted.append(payload({ to: 'rejected', reasonCode: 'changed' }), '2026-08-08T16:00:00.000Z'))
      .toThrowError(expect.objectContaining({ code: 'ALTERED_REPLAY' }));
    expect(restarted.list('memory-1')).toHaveLength(1);
  });

  it('fails closed when the durable file is tampered with', () => {
    const file = tempFile();
    new DurableMemoryAuthorityReceiptRepository(file).append(payload(), '2026-08-08T15:00:00.000Z');
    const stored = JSON.parse(readFileSync(file, 'utf8'));
    stored.receipts[0].reason = 'tampered';
    writeFileSync(file, JSON.stringify(stored));

    const restarted = new DurableMemoryAuthorityReceiptRepository(file);
    expect(() => restarted.list('memory-1')).toThrowError(expect.objectContaining({ code: 'ALTERED_REPLAY' }));
  });

  it('fails closed on corrupt JSON and unsupported schemas', () => {
    const file = tempFile();
    writeFileSync(file, '{broken');
    expect(() => new DurableMemoryAuthorityReceiptRepository(file).list('memory-1'))
      .toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));

    writeFileSync(file, JSON.stringify({ version: 99, receipts: [] }));
    expect(() => new DurableMemoryAuthorityReceiptRepository(file).list('memory-1'))
      .toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });

  it('persists a sequential chain and revalidates every receipt on restart', () => {
    const file = tempFile();
    const repository = new DurableMemoryAuthorityReceiptRepository(file);
    repository.append(payload(), '2026-08-08T15:00:00.000Z');
    repository.append(payload({
      from: 'admitted',
      to: 'quarantined',
      requestId: 'request-2',
      expectedRevision: 1,
      reasonCode: 'quarantine_signal',
      reason: 'A new contradiction requires review.',
      approvalDecisions: undefined,
      admissionRecordIds: undefined,
      quarantineSignalIds: ['signal-1'],
    }), '2026-08-08T16:00:00.000Z');

    const restarted = new DurableMemoryAuthorityReceiptRepository(file);
    expect(restarted.list('memory-1').map((receipt) => receipt.resultingRevision)).toEqual([1, 2]);
    expect(restarted.list('memory-1').at(-1)?.to).toBe('quarantined');
  });

  it('does not publish a receipt when durable persistence cannot complete', () => {
    const directory = mkdtempSync(join(tmpdir(), 'hephaestus-authority-readonly-'));
    temporaryDirectories.push(directory);
    const file = join(directory, 'authority-receipts.json');
    const repository = new DurableMemoryAuthorityReceiptRepository(file);

    if (process.platform === 'win32') return;
    chmodSync(directory, 0o500);
    try {
      expect(() => repository.append(payload(), '2026-08-08T15:00:00.000Z')).toThrow();
    } finally {
      chmodSync(directory, 0o700);
    }
    expect(() => repository.list('memory-1')).not.toThrow();
    expect(repository.list('memory-1')).toHaveLength(0);
  });

  it('rejects an empty path before touching disk', () => {
    expect(() => new DurableMemoryAuthorityReceiptRepository('   ')).toThrowError(MemoryAuthorityReceiptConflictError);
  });
});
