import { describe, expect, test } from 'vitest';
import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  HermesExecutionMapper,
  InvalidHermesExecutionEventError,
} from '../src';
import type { CognitivePipelineRecordId, TaskResultId } from '../src';

const startedAt = '2026-07-19T21:10:00.000Z' as IsoDateTime;
const completedAt = '2026-07-19T21:11:00.000Z' as IsoDateTime;

describe('HermesExecutionMapper', () => {
  test('maps an ordered Hermes event stream into a cognitive submission', () => {
    const result = new HermesExecutionMapper().map({
      recordId: 'pipeline:hermes-1' as CognitivePipelineRecordId,
      resultId: 'result:hermes-1' as TaskResultId,
      events: [
        { type: 'run_started', missionId: 'mission-1', taskId: 'task-1', at: startedAt },
        { type: 'evidence_recorded', evidenceId: 'evidence-1', requirementKey: 'source', verified: true, at: startedAt },
        { type: 'claim_proposed', proposalId: 'proposal-1', statement: 'Supplier A lists the product.', confidence: 0.9, evidenceIds: ['evidence-1'], at: completedAt },
        { type: 'run_completed', summary: 'Research completed', at: completedAt },
      ],
    });

    expect(result.execution.tasks[0]?.status).toBe('completed');
    expect(result.taskResult.claimProposals[0]?.statement).toBe('Supplier A lists the product.');
    expect(result.evidence).toEqual([{ evidenceId: 'evidence-1', exists: true, verified: true }]);
    expect(result.comparisons).toEqual([]);
  });

  test('rejects claims that cite evidence absent from the event stream', () => {
    expect(() => new HermesExecutionMapper().map({
      recordId: 'pipeline:hermes-2' as CognitivePipelineRecordId,
      resultId: 'result:hermes-2' as TaskResultId,
      events: [
        { type: 'run_started', missionId: 'mission-1', taskId: 'task-1', at: startedAt },
        { type: 'claim_proposed', proposalId: 'proposal-1', statement: 'Unsupported claim', confidence: 0.9, evidenceIds: ['missing'], at: completedAt },
        { type: 'run_completed', summary: 'Research completed', at: completedAt },
      ],
    })).toThrow(InvalidHermesExecutionEventError);
  });
});
