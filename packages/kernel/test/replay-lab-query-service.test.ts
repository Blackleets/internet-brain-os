import { describe, expect, test } from 'vitest';
import type { EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import { ReplayLabQueryService } from '../src';
import type {
  ClaimProposalId,
  CognitivePipelineRecord,
  CognitivePipelineRecordId,
  HermesIngestionReceipt,
  MissionExecutionState,
  MissionId,
  MissionTaskId,
  TaskResult,
  TaskResultId,
} from '../src';

const missionId = 'mission-query-1' as MissionId;
const taskId = 'task-query-1' as MissionTaskId;
const evidenceId = 'evidence-query-1' as EvidenceId;
const early = '2026-07-20T00:00:00.000Z' as IsoDateTime;
const late = '2026-07-20T00:05:00.000Z' as IsoDateTime;

function execution(at: IsoDateTime): MissionExecutionState {
  return {
    missionId,
    plan: {
      summary: 'Replay Lab query plan',
      successCriteria: ['Case is visible'],
      stopConditions: [],
      tasks: [{
        id: taskId,
        title: 'Project case',
        objective: 'Expose a safe read model',
        status: 'ready',
        dependsOn: [],
        evidenceRequirements: [{ key: 'source', description: 'Source evidence', required: true }],
      }],
    },
    tasks: [{
      taskId,
      status: 'completed',
      evidence: [{ requirementKey: 'source', evidenceId, recordedAt: at }],
      startedAt: at,
      completedAt: at,
    }],
    createdAt: at,
    updatedAt: at,
  };
}

function taskResult(recordSuffix: string, at: IsoDateTime): TaskResult {
  return {
    id: `result-${recordSuffix}` as TaskResultId,
    missionId,
    taskId,
    summary: `Replay Lab result ${recordSuffix}`,
    evidenceIds: [evidenceId],
    claimProposals: [{
      id: `proposal-${recordSuffix}` as ClaimProposalId,
      missionId,
      taskId,
      statement: `Replay Lab claim ${recordSuffix}`,
      confidence: 0.9,
      evidenceIds: [evidenceId],
      status: 'proposed',
      createdAt: at,
    }],
    createdAt: at,
  };
}

function record(recordId: string, at: IsoDateTime): CognitivePipelineRecord {
  const result = taskResult(recordId, at);
  const proposal = result.claimProposals[0]!;
  const candidate = {
    id: `candidate-${recordId}`,
    proposalId: proposal.id,
    statement: proposal.statement,
    confidence: proposal.confidence,
    evidenceIds: proposal.evidenceIds,
    contradictsClaimIds: [],
    status: 'candidate' as const,
    createdAt: at,
  };
  const contradiction = {
    candidate,
    action: 'admit' as const,
    reasons: [{ code: 'no_conflict' as const, message: 'No conflict.' }],
    contradictsClaimIds: [],
    evaluatedAt: at,
  };

  return {
    id: recordId as CognitivePipelineRecordId,
    execution: execution(at),
    taskResult: result,
    validation: {
      proposal,
      decision: 'accepted',
      reasons: [],
      candidate,
      evaluatedAt: at,
    },
    contradiction,
    admission: {
      decision: 'admitted',
      candidate,
      contradiction,
      claim: {
        id: `claim-${recordId}`,
        sourceCandidateId: candidate.id,
        proposalId: proposal.id,
        statement: candidate.statement,
        confidence: candidate.confidence,
        evidenceIds: candidate.evidenceIds,
        contradictsClaimIds: [],
        status: 'active',
        verificationStatus: 'verified',
        admittedAt: at,
      },
      admittedAt: at,
    },
    recordedAt: at,
  };
}

function receipt(idempotencyKey: string, recordId: CognitivePipelineRecordId, at: IsoDateTime): HermesIngestionReceipt {
  return {
    idempotencyKey,
    fingerprint: `fingerprint-${idempotencyKey}`,
    recordId,
    status: 'completed',
    createdAt: at,
    updatedAt: at,
  };
}

describe('ReplayLabQueryService', () => {
  test('lists cases newest first with matching receipt metadata', async () => {
    const oldRecord = record('pipeline-query-old', early);
    const newRecord = record('pipeline-query-new', late);
    const service = new ReplayLabQueryService({
      records: {
        list: async () => [oldRecord, newRecord],
        get: async () => oldRecord,
      },
      receipts: {
        list: async () => [
          receipt('old-key', oldRecord.id, early),
          receipt('new-key', newRecord.id, late),
        ],
      },
    });

    const cases = await service.listCases();

    expect(cases.map((caseView) => caseView.id)).toEqual(['pipeline-query-new', 'pipeline-query-old']);
    expect(cases[0]?.idempotency.idempotencyKey).toBe('new-key');
    expect(cases[0]?.idempotency.status).toBe('attached');
    expect(cases[0]?.idempotency).not.toHaveProperty('fingerprint');
  });

  test('gets one case by id and does not attach unrelated receipts', async () => {
    const target = record('pipeline-query-target', late);
    const unrelated = record('pipeline-query-other', early);
    const service = new ReplayLabQueryService({
      records: {
        list: async () => [target],
        get: async (id) => {
          expect(id).toBe(target.id);
          return target;
        },
      },
      receipts: {
        list: async () => [receipt('other-key', unrelated.id, early)],
      },
    });

    const caseView = await service.getCase(target.id);

    expect(caseView.id).toBe(target.id);
    expect(caseView.idempotency.status).toBe('not_attached_to_record');
  });

  test('uses the latest receipt when multiple receipts point to the same record', async () => {
    const target = record('pipeline-query-duplicate-receipt', late);
    const service = new ReplayLabQueryService({
      records: {
        list: async () => [target],
        get: async () => target,
      },
      receipts: {
        list: async () => [
          receipt('older-key', target.id, early),
          receipt('latest-key', target.id, late),
        ],
      },
    });

    const cases = await service.listCases();

    expect(cases[0]?.idempotency.idempotencyKey).toBe('latest-key');
  });
});
