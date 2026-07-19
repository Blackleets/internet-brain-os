import { describe, expect, test } from 'vitest';
import type { EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import {
  InvalidTaskResultError,
  TaskResultBuilder,
  TaskResultTaskStateError,
  UnsupportedClaimEvidenceError,
} from '../src';
import type {
  MissionExecutionState,
  MissionId,
  MissionTaskId,
  TaskResultId,
} from '../src';

const now = '2026-07-19T20:00:00.000Z' as IsoDateTime;
const missionId = 'mission-1' as MissionId;
const taskId = 'task-1' as MissionTaskId;
const evidenceId = 'evidence-1' as EvidenceId;

function execution(status: 'active' | 'completed' = 'completed'): MissionExecutionState {
  return {
    missionId,
    plan: {
      summary: 'Plan',
      successCriteria: ['Done'],
      stopConditions: [],
      tasks: [
        {
          id: taskId,
          title: 'Research',
          objective: 'Find facts',
          status: 'ready',
          dependsOn: [],
          evidenceRequirements: [
            { key: 'source', description: 'Primary source', required: true },
          ],
        },
      ],
    },
    tasks: [
      {
        taskId,
        status,
        evidence: [{ requirementKey: 'source', evidenceId, recordedAt: now }],
        startedAt: now,
        completedAt: status === 'completed' ? now : undefined,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

describe('TaskResultBuilder', () => {
  test('builds a result and keeps claims in proposed state', () => {
    const result = new TaskResultBuilder().build(execution(), taskId, {
      id: 'result-1' as TaskResultId,
      summary: '  Supplier pricing was confirmed.  ',
      createdAt: now,
      claimProposals: [
        {
          statement: '  Supplier A lists a unit price.  ',
          confidence: 0.9,
          evidenceIds: [evidenceId, evidenceId],
          rationale: '  Direct product page.  ',
        },
      ],
    });

    expect(result.summary).toBe('Supplier pricing was confirmed.');
    expect(result.evidenceIds).toEqual([evidenceId]);
    expect(result.claimProposals[0]).toMatchObject({
      statement: 'Supplier A lists a unit price.',
      confidence: 0.9,
      evidenceIds: [evidenceId],
      rationale: 'Direct product page.',
      status: 'proposed',
    });
  });

  test('rejects results for incomplete tasks', () => {
    expect(() =>
      new TaskResultBuilder().build(execution('active'), taskId, {
        id: 'result-1' as TaskResultId,
        summary: 'Summary',
        createdAt: now,
      }),
    ).toThrow(TaskResultTaskStateError);
  });

  test('rejects claims that cite evidence outside the task', () => {
    expect(() =>
      new TaskResultBuilder().build(execution(), taskId, {
        id: 'result-1' as TaskResultId,
        summary: 'Summary',
        createdAt: now,
        claimProposals: [
          {
            statement: 'Unsupported claim',
            confidence: 0.7,
            evidenceIds: ['foreign-evidence' as EvidenceId],
          },
        ],
      }),
    ).toThrow(UnsupportedClaimEvidenceError);
  });

  test('rejects empty evidence sets and invalid confidence', () => {
    const builder = new TaskResultBuilder();
    expect(() =>
      builder.build(execution(), taskId, {
        id: 'result-1' as TaskResultId,
        summary: 'Summary',
        createdAt: now,
        claimProposals: [
          { statement: 'Claim', confidence: 0.5, evidenceIds: [] },
        ],
      }),
    ).toThrow(InvalidTaskResultError);

    expect(() =>
      builder.build(execution(), taskId, {
        id: 'result-2' as TaskResultId,
        summary: 'Summary',
        createdAt: now,
        claimProposals: [
          { statement: 'Claim', confidence: 1.1, evidenceIds: [evidenceId] },
        ],
      }),
    ).toThrow(InvalidTaskResultError);
  });

  test('does not expose mutable input arrays', () => {
    const evidenceIds = [evidenceId];
    const result = new TaskResultBuilder().build(execution(), taskId, {
      id: 'result-1' as TaskResultId,
      summary: 'Summary',
      createdAt: now,
      claimProposals: [
        { statement: 'Claim', confidence: 0.8, evidenceIds },
      ],
    });

    evidenceIds.push('later' as EvidenceId);
    expect(result.claimProposals[0]?.evidenceIds).toEqual([evidenceId]);
  });
});
