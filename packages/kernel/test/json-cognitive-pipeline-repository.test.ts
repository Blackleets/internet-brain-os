import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
  AlreadyExistsError,
  InvalidCognitivePipelineRecordError,
  JsonCognitivePipelineRepository,
} from '../src';
import type { CognitivePipelineRecord } from '../src';

const roots: string[] = [];

async function repository(): Promise<JsonCognitivePipelineRepository> {
  const root = await mkdtemp(join(tmpdir(), 'internet-brain-pipeline-'));
  roots.push(root);
  return new JsonCognitivePipelineRepository(root);
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function record(): CognitivePipelineRecord {
  return {
    id: 'pipeline-1',
    recordedAt: '2026-07-19T20:30:00.000Z',
    execution: { missionId: 'mission-1' },
    taskResult: {
      missionId: 'mission-1',
      claimProposals: [{ id: 'proposal-1' }],
    },
    validation: {
      proposal: { id: 'proposal-1' },
      candidate: { id: 'candidate-1' },
    },
    contradiction: {
      candidate: { id: 'candidate-1' },
      action: 'admit',
    },
    admission: {
      candidate: { id: 'candidate-1' },
      contradiction: {
        candidate: { id: 'candidate-1' },
        action: 'admit',
      },
      decision: 'admitted',
      claim: { id: 'claim-1' },
    },
  } as unknown as CognitivePipelineRecord;
}

describe('JsonCognitivePipelineRepository', () => {
  test('persists and reloads a complete cognitive expediente atomically', async () => {
    const repo = await repository();
    await repo.append(record());

    const stored = await repo.get('pipeline-1' as CognitivePipelineRecord['id']);
    expect(stored.admission?.decision).toBe('admitted');
    expect(stored.admission?.claim?.id).toBe('claim-1');
  });

  test('is append-only for record IDs', async () => {
    const repo = await repository();
    await repo.append(record());
    await expect(repo.append(record())).rejects.toThrow(AlreadyExistsError);
  });

  test('rejects broken provenance chains before writing', async () => {
    const repo = await repository();
    const invalid = record();
    const changed = {
      ...invalid,
      execution: { ...invalid.execution, missionId: 'mission-2' },
    } as CognitivePipelineRecord;

    await expect(repo.append(changed)).rejects.toThrow(InvalidCognitivePipelineRecordError);
    expect(await repo.list()).toEqual([]);
  });

  test('does not expose mutable stored state', async () => {
    const repo = await repository();
    const input = record();
    await repo.append(input);

    (input.taskResult.claimProposals as Array<{ id: string }>).push({ id: 'proposal-later' });
    const stored = await repo.get(input.id);
    expect(stored.taskResult.claimProposals).toHaveLength(1);
  });
});
