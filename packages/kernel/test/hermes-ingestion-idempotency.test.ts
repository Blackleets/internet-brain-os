import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  HermesIngestionConflictError,
  IdempotentHermesExecutionIngestionService,
  JsonHermesIngestionReceiptRepository,
} from '../src';
import type {
  CognitivePipelineRecord,
  CognitivePipelineRecordId,
  MissionId,
  MissionTaskId,
  TaskResultId,
} from '../src';

const roots: string[] = [];
const now = '2026-07-19T21:45:00.000Z' as IsoDateTime;

async function dataRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'hermes-receipts-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function record(id: CognitivePipelineRecordId): CognitivePipelineRecord {
  return {
    id,
    execution: { missionId: 'mission-1' as MissionId },
    taskResult: { missionId: 'mission-1' as MissionId },
    validation: { decision: 'rejected' },
    recordedAt: now,
  } as CognitivePipelineRecord;
}

const baseInput = {
  idempotencyKey: 'hermes-run:1',
  receivedAt: now,
  recordId: 'pipeline-1' as CognitivePipelineRecordId,
  resultId: 'result-1' as TaskResultId,
  events: [
    { type: 'run_started' as const, missionId: 'mission-1', taskId: 'task-1', at: now },
    { type: 'evidence_recorded' as const, evidenceId: 'evidence-1', requirementKey: 'source', verified: true, at: now },
    { type: 'claim_proposed' as const, proposalId: 'proposal-1', statement: 'Fact', confidence: 0.9, evidenceIds: ['evidence-1'], at: now },
    { type: 'run_completed' as const, summary: 'Done', at: now },
  ],
};

describe('IdempotentHermesExecutionIngestionService', () => {
  test('returns the original record without executing the cognitive pipeline twice', async () => {
    const receipts = new JsonHermesIngestionReceiptRepository(await dataRoot());
    const expected = record(baseInput.recordId);
    const ingest = vi.fn(async () => structuredClone(expected));
    const service = new IdempotentHermesExecutionIngestionService({ ingest }, receipts);

    const first = await service.ingest(baseInput, { existingClaims: [] });
    const replay = await service.ingest(baseInput, { existingClaims: [] });

    expect(first).toEqual(expected);
    expect(replay).toEqual(expected);
    expect(ingest).toHaveBeenCalledTimes(1);
  });

  test('rejects reuse of an idempotency key with altered events', async () => {
    const receipts = new JsonHermesIngestionReceiptRepository(await dataRoot());
    const ingest = vi.fn(async () => record(baseInput.recordId));
    const service = new IdempotentHermesExecutionIngestionService({ ingest }, receipts);
    await service.ingest(baseInput, { existingClaims: [] });

    await expect(service.ingest({
      ...baseInput,
      events: baseInput.events.map((event) =>
        event.type === 'run_completed' ? { ...event, summary: 'Altered' } : event,
      ),
    }, { existingClaims: [] })).rejects.toBeInstanceOf(HermesIngestionConflictError);
    expect(ingest).toHaveBeenCalledTimes(1);
  });
});
