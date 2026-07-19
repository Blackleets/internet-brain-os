import { describe, expect, test } from 'vitest';
import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  HermesCognitiveAdapter,
  HermesExecutionIngestionService,
} from '../src';
import type {
  CognitivePipelineRecord,
  CognitivePipelineRecordId,
  ExistingClaimSnapshot,
  RunCognitivePipelineInput,
  TaskResultId,
} from '../src';

const startedAt = '2026-07-19T21:30:00.000Z' as IsoDateTime;
const completedAt = '2026-07-19T21:31:00.000Z' as IsoDateTime;

function events() {
  return [
    { type: 'run_started', missionId: 'mission-1', taskId: 'task-1', at: startedAt },
    {
      type: 'evidence_recorded',
      evidenceId: 'evidence-1',
      requirementKey: 'source',
      verified: true,
      at: startedAt,
    },
    {
      type: 'claim_proposed',
      proposalId: 'proposal-1',
      statement: 'Supplier A lists the product.',
      confidence: 0.9,
      evidenceIds: ['evidence-1'],
      at: completedAt,
    },
    { type: 'run_completed', summary: 'Research complete', at: completedAt },
  ] as const;
}

describe('HermesExecutionIngestionService', () => {
  test('maps a completed Hermes stream and submits it to the cognitive pipeline', async () => {
    const received: RunCognitivePipelineInput[] = [];
    const pipeline = {
      run: async (input: RunCognitivePipelineInput): Promise<CognitivePipelineRecord> => {
        received.push(structuredClone(input));
        return {
          id: input.recordId,
          execution: input.execution,
          taskResult: input.taskResult,
          validation: {
            proposal: input.proposal,
            decision: 'rejected',
            reasons: [],
            evaluatedAt: input.recordedAt,
          },
          recordedAt: input.recordedAt,
        };
      },
    };

    const service = new HermesExecutionIngestionService(new HermesCognitiveAdapter(pipeline));
    const result = await service.ingest({
      recordId: 'pipeline-1' as CognitivePipelineRecordId,
      resultId: 'result-1' as TaskResultId,
      events: events(),
    }, { existingClaims: [] });

    expect(received).toHaveLength(1);
    expect(received[0]?.execution.missionId).toBe('mission-1');
    expect(received[0]?.taskResult.claimProposals[0]?.id).toBe('proposal-1');
    expect(received[0]?.validationContext.evidence[0]?.verified).toBe(true);
    expect(result.id).toBe('pipeline-1');
  });

  test('passes semantic comparisons only against Kernel-owned claims', async () => {
    const received: RunCognitivePipelineInput[] = [];
    const existingClaim: ExistingClaimSnapshot = {
      id: 'claim-existing',
      statement: 'An older supplier listing exists.',
      confidence: 0.95,
      verificationStatus: 'verified',
    };
    const pipeline = {
      run: async (input: RunCognitivePipelineInput): Promise<CognitivePipelineRecord> => {
        received.push(structuredClone(input));
        return {
          id: input.recordId,
          execution: input.execution,
          taskResult: input.taskResult,
          validation: {
            proposal: input.proposal,
            decision: 'rejected',
            reasons: [],
            evaluatedAt: input.recordedAt,
          },
          recordedAt: input.recordedAt,
        };
      },
    };
    const service = new HermesExecutionIngestionService(new HermesCognitiveAdapter(pipeline));

    await service.ingest({
      recordId: 'pipeline-2' as CognitivePipelineRecordId,
      resultId: 'result-2' as TaskResultId,
      events: events(),
      comparisons: [{
        existingClaimId: existingClaim.id,
        kind: 'possible',
        confidence: 0.6,
        rationale: 'Listings may describe different dates.',
      }],
    }, { existingClaims: [existingClaim] });

    expect(received[0]?.existingClaims).toEqual([existingClaim]);
    expect(received[0]?.comparisons[0]?.existingClaimId).toBe(existingClaim.id);
  });
});
