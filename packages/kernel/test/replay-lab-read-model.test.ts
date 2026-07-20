import { describe, expect, test } from 'vitest';
import type { EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import {
  buildReplayLabCaseView,
} from '../src';
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

const now = '2026-07-20T00:00:00.000Z' as IsoDateTime;
const missionId = 'mission-replay-1' as MissionId;
const taskId = 'task-replay-1' as MissionTaskId;
const evidenceId = 'evidence-replay-1' as EvidenceId;

function execution(): MissionExecutionState {
  return {
    missionId,
    plan: {
      summary: 'Replay Lab plan',
      successCriteria: ['Evidence backed claim'],
      stopConditions: [],
      tasks: [{
        id: taskId,
        title: 'Investigate agent run',
        objective: 'Capture evidence from the run',
        status: 'ready',
        dependsOn: [],
        evidenceRequirements: [{ key: 'source', description: 'Source evidence', required: true }],
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

function taskResult(confidence = 0.9): TaskResult {
  return {
    id: 'result-replay-1' as TaskResultId,
    missionId,
    taskId,
    summary: 'Agent run produced a source-backed claim.',
    evidenceIds: [evidenceId],
    claimProposals: [{
      id: 'proposal-replay-1' as ClaimProposalId,
      missionId,
      taskId,
      statement: 'The agent produced an evidence-backed operational claim.',
      confidence,
      evidenceIds: [evidenceId],
      status: 'proposed',
      createdAt: now,
    }],
    createdAt: now,
  };
}

function acceptedRecord(): CognitivePipelineRecord {
  const result = taskResult();
  const proposal = result.claimProposals[0]!;
  const candidate = {
    id: 'candidate-replay-1',
    proposalId: proposal.id,
    statement: proposal.statement,
    confidence: proposal.confidence,
    evidenceIds: proposal.evidenceIds,
    contradictsClaimIds: [],
    status: 'candidate' as const,
    createdAt: now,
  };
  const contradiction = {
    candidate,
    action: 'admit' as const,
    reasons: [{ code: 'no_conflict' as const, message: 'No conflicting durable claims were found.' }],
    contradictsClaimIds: [],
    evaluatedAt: now,
  };

  return {
    id: 'pipeline-replay-1' as CognitivePipelineRecordId,
    execution: execution(),
    taskResult: result,
    validation: {
      proposal,
      decision: 'accepted',
      reasons: [],
      candidate,
      evaluatedAt: now,
    },
    contradiction,
    admission: {
      decision: 'admitted',
      candidate,
      contradiction,
      claim: {
        id: 'durable-replay-1',
        sourceCandidateId: candidate.id,
        proposalId: proposal.id,
        statement: candidate.statement,
        confidence: candidate.confidence,
        evidenceIds: candidate.evidenceIds,
        contradictsClaimIds: [],
        status: 'active',
        verificationStatus: 'verified',
        admittedAt: now,
      },
      admittedAt: now,
    },
    recordedAt: now,
  };
}

function rejectedRecord(): CognitivePipelineRecord {
  const result = taskResult(0.2);
  const proposal = result.claimProposals[0]!;

  return {
    id: 'pipeline-replay-rejected' as CognitivePipelineRecordId,
    execution: execution(),
    taskResult: result,
    validation: {
      proposal,
      decision: 'rejected',
      reasons: [{ code: 'low_confidence', message: 'Claim confidence is below the acceptance threshold.' }],
      evaluatedAt: now,
    },
    recordedAt: now,
  };
}

function receipt(recordId: CognitivePipelineRecordId): HermesIngestionReceipt {
  return {
    idempotencyKey: 'demo-key-1',
    fingerprint: 'secret-fingerprint-not-for-ui',
    recordId,
    status: 'completed',
    createdAt: now,
    updatedAt: now,
  };
}

describe('Replay Lab read model', () => {
  test('projects an admitted cognitive pipeline record into a case view', () => {
    const view = buildReplayLabCaseView(acceptedRecord());

    expect(view.id).toBe('pipeline-replay-1');
    expect(view.status).toBe('admitted');
    expect(view.missionId).toBe(missionId);
    expect(view.taskId).toBe(taskId);
    expect(view.evidence).toEqual([{
      evidenceId,
      requirementKey: 'source',
      recordedAt: now,
      taskId,
      supportsClaimProposal: true,
    }]);
    expect(view.claimProposal.statement).toContain('evidence-backed');
    expect(view.gates.validation.decision).toBe('accepted');
    expect(view.gates.contradiction?.action).toBe('admit');
    expect(view.gates.admission?.decision).toBe('admitted');
    expect(view.gates.admission?.durableClaimId).toBe('durable-replay-1');
    expect(view.idempotency.status).toBe('not_attached_to_record');
    expect(view.warnings).toEqual([]);
  });

  test('keeps rejected validation visible without inventing downstream gates', () => {
    const view = buildReplayLabCaseView(rejectedRecord());

    expect(view.status).toBe('rejected');
    expect(view.gates.validation.decision).toBe('rejected');
    expect(view.gates.validation.reasons).toEqual(['Claim confidence is below the acceptance threshold.']);
    expect(view.gates.contradiction).toBeUndefined();
    expect(view.gates.admission).toBeUndefined();
    expect(view.warnings).toContain('Downstream contradiction and admission gates did not run because validation did not accept the claim proposal.');
  });

  test('creates a forensic timeline from persisted record timestamps', () => {
    const view = buildReplayLabCaseView(acceptedRecord());

    expect(view.timeline.map((event) => event.type)).toEqual([
      'admission_evaluated',
      'contradiction_evaluated',
      'evidence_recorded',
      'mission_created',
      'result_created',
      'task_completed',
      'task_started',
      'validation_evaluated',
    ]);
    expect(view.timeline.every((event) => event.at === now)).toBe(true);
  });

  test('attaches safe idempotency receipt fields without exposing fingerprints', () => {
    const record = acceptedRecord();
    const view = buildReplayLabCaseView(record, { receipt: receipt(record.id) });

    expect(view.idempotency.status).toBe('attached');
    expect(view.idempotency.idempotencyKey).toBe('demo-key-1');
    expect(view.idempotency.receiptStatus).toBe('completed');
    expect(view.idempotency.recordMatchesReceipt).toBe(true);
    expect(view.idempotency).not.toHaveProperty('fingerprint');
    expect(view.warnings).toEqual([]);
  });

  test('warns when an attached idempotency receipt points to another record', () => {
    const record = acceptedRecord();
    const view = buildReplayLabCaseView(record, {
      receipt: receipt('different-record' as CognitivePipelineRecordId),
    });

    expect(view.idempotency.status).toBe('record_mismatch');
    expect(view.idempotency.recordMatchesReceipt).toBe(false);
    expect(view.idempotency).not.toHaveProperty('fingerprint');
    expect(view.warnings).toContain('Attached Hermes ingestion receipt does not match this cognitive pipeline record.');
  });
});
