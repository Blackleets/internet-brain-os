import { describe, expect, test } from 'vitest';
import type { IsoDateTime } from '@internet-brain-os/shared';
import { HermesIngestionRecoveryCoordinator } from '../src';
import type {
  CognitivePipelineRecord,
  CognitivePipelineRecordId,
  HermesIngestionReceipt,
} from '../src';

const now = '2026-07-19T22:00:00.000Z' as IsoDateTime;

function record(id: string): CognitivePipelineRecord {
  return {
    id: id as CognitivePipelineRecordId,
    execution: { missionId: 'mission-1' as never, plan: { summary: '', successCriteria: [], stopConditions: [], tasks: [] }, tasks: [], createdAt: now, updatedAt: now },
    taskResult: { id: 'result-1' as never, missionId: 'mission-1' as never, taskId: 'task-1' as never, summary: '', evidenceIds: [], claimProposals: [], createdAt: now },
    validation: { proposal: { id: 'proposal-1' as never, missionId: 'mission-1' as never, taskId: 'task-1' as never, statement: 'x', confidence: 0.1, evidenceIds: ['e-1' as never], status: 'proposed', createdAt: now }, decision: 'rejected', reasons: [], evaluatedAt: now },
    recordedAt: now,
  };
}

describe('HermesIngestionRecoveryCoordinator', () => {
  test('completes pending receipt from an existing cognitive record without rerunning ingestion', async () => {
    const pending: HermesIngestionReceipt = { idempotencyKey: 'key-1', fingerprint: 'fp', recordId: 'record-1' as CognitivePipelineRecordId, status: 'pending', createdAt: now, updatedAt: now };
    const completed: string[] = [];
    const coordinator = new HermesIngestionRecoveryCoordinator(
      {
        listPending: async () => [pending],
        complete: async (key) => { completed.push(key); },
        fail: async () => undefined,
      },
      { get: async () => record('record-1') },
      () => false,
    );

    await expect(coordinator.reconcile(now)).resolves.toEqual({ recovered: ['key-1'], unresolved: [] });
    expect(completed).toEqual(['key-1']);
  });

  test('leaves receipt pending when no cognitive record exists yet', async () => {
    const pending: HermesIngestionReceipt = { idempotencyKey: 'key-2', fingerprint: 'fp', recordId: 'record-2' as CognitivePipelineRecordId, status: 'pending', createdAt: now, updatedAt: now };
    const missing = new Error('missing');
    const coordinator = new HermesIngestionRecoveryCoordinator(
      { listPending: async () => [pending], complete: async () => undefined, fail: async () => undefined },
      { get: async () => { throw missing; } },
      (error) => error === missing,
    );

    await expect(coordinator.reconcile(now)).resolves.toEqual({ recovered: [], unresolved: ['key-2'] });
  });
});
