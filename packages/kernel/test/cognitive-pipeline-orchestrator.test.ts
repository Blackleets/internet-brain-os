import { describe, expect, test } from 'vitest';
import type { EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import {
  CognitivePipelineOrchestrator,
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

const now = '2026-07-19T20:40:00.000Z' as IsoDateTime;
const missionId = 'mission-1' as MissionId;
const taskId = 'task-1' as MissionTaskId;
const evidenceId = 'evidence-1' as EvidenceId;

function execution(): MissionExecutionState {
  return {
    missionId,
    plan: {
      summary: 'Plan',
      successCriteria: ['Done'],
      stopConditions: [],
      tasks: [{
        id: taskId,
        title: 'Research',
        objective: 'Find facts',
        status: 'ready',
        dependsOn: [],
        evidenceRequirements: [{ key: 'source', description: 'Source', required: true }],
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
    id: 'result-1' as TaskResultId,
    missionId,
    taskId,
    summary: 'Confirmed fact',
    evidenceIds: [evidenceId],
    claimProposals: [{
      id: 'proposal-1' as ClaimProposalId,
      missionId,
      taskId,
      statement: 'Supplier A lists the product.',
      confidence: 0.9,
      evidenceIds: [evidenceId],
      status: 'proposed',
      createdAt: now,
    }],
    createdAt: now,
  };
}

describe('CognitivePipelineOrchestrator', () => {
  test('runs validation, contradiction, admission, and persistence as one operation', async () => {
    const records: CognitivePipelineRecord[] = [];
    const writer = { append: async (record: CognitivePipelineRecord) => { records.push(structuredClone(record)); } };
    const result = taskResult();

    const record = await new CognitivePipelineOrchestrator(writer).run({
      recordId: 'pipeline-1' as CognitivePipelineRecordId,
      execution: execution(),
      taskResult: result,
      proposal: result.claimProposals[0]!,
      validationContext: {
        evidence: [{ evidenceId, exists: true, verified: true }],
        evaluatedAt: now,
      },
      existingClaims: [],
      comparisons: [],
      recordedAt: now,
    });

    expect(record.validation.decision).toBe('accepted');
    expect(record.contradiction?.action).toBe('admit');
    expect(record.admission?.decision).toBe('admitted');
    expect(record.admission?.claim?.verificationStatus).toBe('verified');
    expect(records).toHaveLength(1);
  });

  test('persists rejected validation without running downstream gates', async () => {
    const records: CognitivePipelineRecord[] = [];
    const result = taskResult();
    const proposal = { ...result.claimProposals[0]!, confidence: 0.2 };

    const record = await new CognitivePipelineOrchestrator({
      append: async (value) => { records.push(structuredClone(value)); },
    }).run({
      recordId: 'pipeline-2' as CognitivePipelineRecordId,
      execution: execution(),
      taskResult: { ...result, claimProposals: [proposal] },
      proposal,
      validationContext: {
        evidence: [{ evidenceId, exists: true, verified: true }],
        evaluatedAt: now,
      },
      existingClaims: [],
      comparisons: [],
      recordedAt: now,
    });

    expect(record.validation.decision).toBe('rejected');
    expect(record.contradiction).toBeUndefined();
    expect(record.admission).toBeUndefined();
    expect(records).toHaveLength(1);
  });
});
