import { describe, expect, test } from 'vitest';
import type { EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import {
  CognitivePipelineOrchestrator,
  HermesCognitiveAdapter,
  InvalidHermesCognitiveSubmissionError,
} from '../src';
import type {
  ClaimProposalId,
  CognitivePipelineRecord,
  CognitivePipelineRecordId,
  MissionExecutionState,
  MissionId,
  MissionTaskId,
  TaskResult,
  TaskResultId,
} from '../src';

const now = '2026-07-19T21:10:00.000Z' as IsoDateTime;
const missionId = 'mission-hermes-1' as MissionId;
const taskId = 'task-hermes-1' as MissionTaskId;
const evidenceId = 'evidence-hermes-1' as EvidenceId;
const proposalId = 'proposal-hermes-1' as ClaimProposalId;

function execution(): MissionExecutionState {
  return {
    missionId,
    plan: {
      summary: 'Hermes supplier research',
      successCriteria: ['Evidence captured'],
      stopConditions: [],
      tasks: [{
        id: taskId,
        title: 'Research supplier',
        objective: 'Confirm listing',
        status: 'ready',
        dependsOn: [],
        evidenceRequirements: [{ key: 'source', description: 'Supplier source', required: true }],
      }],
    },
    tasks: [{
      taskId,
      status: 'completed',
      evidence: [{ requirementKey: 'source', evidenceId, recordedAt: now }],
      startedAt: now,
      completedAt: now,
    }],
    createdAt: now,
    updatedAt: now,
  };
}

function taskResult(): TaskResult {
  return {
    id: 'result-hermes-1' as TaskResultId,
    missionId,
    taskId,
    summary: 'Hermes found a supplier listing.',
    evidenceIds: [evidenceId],
    claimProposals: [{
      id: proposalId,
      missionId,
      taskId,
      statement: 'Supplier A lists the requested product.',
      confidence: 0.9,
      evidenceIds: [evidenceId],
      status: 'proposed',
      createdAt: now,
    }],
    createdAt: now,
  };
}

describe('HermesCognitiveAdapter', () => {
  test('converts a Hermes submission into an admitted and persisted Kernel record', async () => {
    const records: CognitivePipelineRecord[] = [];
    const pipeline = new CognitivePipelineOrchestrator({
      append: async (record) => { records.push(structuredClone(record)); },
    });
    const adapter = new HermesCognitiveAdapter(pipeline);

    const record = await adapter.submit({
      recordId: 'pipeline-hermes-1' as CognitivePipelineRecordId,
      execution: execution(),
      taskResult: taskResult(),
      proposalId,
      evidence: [{ evidenceId, exists: true, verified: true }],
      comparisons: [],
      submittedAt: now,
    }, { existingClaims: [] });

    expect(record.validation.decision).toBe('accepted');
    expect(record.contradiction?.action).toBe('admit');
    expect(record.admission?.decision).toBe('admitted');
    expect(record.admission?.claim?.statement).toBe('Supplier A lists the requested product.');
    expect(records).toHaveLength(1);
  });

  test('rejects attempts by Hermes to inject Kernel authority fields', async () => {
    const adapter = new HermesCognitiveAdapter({
      run: async () => { throw new Error('pipeline must not run'); },
    });
    const submission = {
      recordId: 'pipeline-hermes-2' as CognitivePipelineRecordId,
      execution: execution(),
      taskResult: taskResult(),
      proposalId,
      evidence: [{ evidenceId, exists: true, verified: true }],
      comparisons: [],
      submittedAt: now,
      claim: { id: 'forged-claim' },
    };

    await expect(adapter.submit(submission, { existingClaims: [] }))
      .rejects.toThrow(InvalidHermesCognitiveSubmissionError);
  });

  test('rejects comparisons against claims not supplied by the Kernel', async () => {
    const adapter = new HermesCognitiveAdapter({
      run: async () => { throw new Error('pipeline must not run'); },
    });

    await expect(adapter.submit({
      recordId: 'pipeline-hermes-3' as CognitivePipelineRecordId,
      execution: execution(),
      taskResult: taskResult(),
      proposalId,
      evidence: [{ evidenceId, exists: true, verified: true }],
      comparisons: [{
        existingClaimId: 'unknown-claim',
        kind: 'material',
        confidence: 0.95,
      }],
      submittedAt: now,
    }, { existingClaims: [] })).rejects.toThrow(
      'Hermes comparison references unknown Kernel claim: unknown-claim',
    );
  });
});
