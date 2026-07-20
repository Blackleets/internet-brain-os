import type { IsoDateTime } from '@internet-brain-os/shared';
import type {
  ClaimProposal,
  ClaimValidationDecision,
  CognitivePipelineRecord,
  CognitivePipelineRecordId,
  ContradictionAction,
  KnowledgeAdmissionDecision,
  MissionId,
  MissionTaskId,
} from '..';

export type ReplayLabCaseStatus =
  | 'admitted'
  | 'blocked'
  | 'review'
  | 'accepted'
  | 'needs_review'
  | 'rejected';

export type ReplayLabTimelineEventType =
  | 'mission_created'
  | 'task_started'
  | 'evidence_recorded'
  | 'task_completed'
  | 'task_failed'
  | 'result_created'
  | 'validation_evaluated'
  | 'contradiction_evaluated'
  | 'admission_evaluated';

export interface ReplayLabTimelineEvent {
  readonly type: ReplayLabTimelineEventType;
  readonly at: IsoDateTime;
  readonly label: string;
  readonly taskId?: MissionTaskId;
  readonly evidenceId?: string;
  readonly decision?: ClaimValidationDecision | KnowledgeAdmissionDecision;
  readonly action?: ContradictionAction;
}

export interface ReplayLabEvidenceRefView {
  readonly evidenceId: string;
  readonly requirementKey: string;
  readonly recordedAt: IsoDateTime;
  readonly taskId: MissionTaskId;
  readonly supportsClaimProposal: boolean;
}

export interface ReplayLabClaimProposalView {
  readonly id: string;
  readonly statement: string;
  readonly confidence: number;
  readonly evidenceIds: readonly string[];
  readonly status: ClaimProposal['status'];
  readonly createdAt: IsoDateTime;
}

export interface ReplayLabGateView {
  readonly validation: {
    readonly decision: ClaimValidationDecision;
    readonly reasons: readonly string[];
    readonly evaluatedAt: IsoDateTime;
  };
  readonly contradiction?: {
    readonly action: ContradictionAction;
    readonly reasons: readonly string[];
    readonly contradictsClaimIds: readonly string[];
    readonly evaluatedAt: IsoDateTime;
  };
  readonly admission?: {
    readonly decision: KnowledgeAdmissionDecision;
    readonly durableClaimId?: string;
    readonly admittedAt: IsoDateTime;
  };
}

export interface ReplayLabIdempotencyView {
  readonly status: 'not_attached_to_record';
  readonly explanation: string;
}

export interface ReplayLabCaseView {
  readonly id: CognitivePipelineRecordId;
  readonly missionId: MissionId;
  readonly taskId: MissionTaskId;
  readonly recordedAt: IsoDateTime;
  readonly status: ReplayLabCaseStatus;
  readonly timeline: readonly ReplayLabTimelineEvent[];
  readonly evidence: readonly ReplayLabEvidenceRefView[];
  readonly claimProposal: ReplayLabClaimProposalView;
  readonly gates: ReplayLabGateView;
  readonly idempotency: ReplayLabIdempotencyView;
  readonly warnings: readonly string[];
}

export function buildReplayLabCaseView(record: CognitivePipelineRecord): ReplayLabCaseView {
  const proposal = record.validation.proposal;
  const task = record.execution.tasks.find((candidate) => candidate.taskId === record.taskResult.taskId);
  const evidence = (task?.evidence ?? []).map((evidenceRef): ReplayLabEvidenceRefView => ({
    evidenceId: evidenceRef.evidenceId,
    requirementKey: evidenceRef.requirementKey,
    recordedAt: evidenceRef.recordedAt,
    taskId: task?.taskId ?? record.taskResult.taskId,
    supportsClaimProposal: proposal.evidenceIds.includes(evidenceRef.evidenceId),
  }));

  return {
    id: record.id,
    missionId: record.execution.missionId,
    taskId: record.taskResult.taskId,
    recordedAt: record.recordedAt,
    status: deriveStatus(record),
    timeline: buildTimeline(record),
    evidence,
    claimProposal: {
      id: proposal.id,
      statement: proposal.statement,
      confidence: proposal.confidence,
      evidenceIds: [...proposal.evidenceIds],
      status: proposal.status,
      createdAt: proposal.createdAt,
    },
    gates: {
      validation: {
        decision: record.validation.decision,
        reasons: record.validation.reasons.map((reason) => reason.message),
        evaluatedAt: record.validation.evaluatedAt,
      },
      contradiction: record.contradiction
        ? {
            action: record.contradiction.action,
            reasons: record.contradiction.reasons.map((reason) => reason.message),
            contradictsClaimIds: [...record.contradiction.contradictsClaimIds],
            evaluatedAt: record.contradiction.evaluatedAt,
          }
        : undefined,
      admission: record.admission
        ? {
            decision: record.admission.decision,
            durableClaimId: record.admission.claim?.id,
            admittedAt: record.admission.admittedAt,
          }
        : undefined,
    },
    idempotency: {
      status: 'not_attached_to_record',
      explanation: 'Replay Lab case views are projected from cognitive pipeline records only. Ingestion receipts must be joined by a dedicated read model before UI display.',
    },
    warnings: deriveWarnings(record),
  };
}

function deriveStatus(record: CognitivePipelineRecord): ReplayLabCaseStatus {
  if (record.admission) return record.admission.decision;
  if (record.contradiction?.action === 'block') return 'blocked';
  if (record.contradiction?.action === 'review') return 'review';
  return record.validation.decision;
}

function buildTimeline(record: CognitivePipelineRecord): readonly ReplayLabTimelineEvent[] {
  const events: ReplayLabTimelineEvent[] = [{
    type: 'mission_created',
    at: record.execution.createdAt,
    label: 'Mission execution created',
  }];

  for (const task of record.execution.tasks) {
    if (task.startedAt) {
      events.push({ type: 'task_started', at: task.startedAt, label: 'Task started', taskId: task.taskId });
    }

    for (const evidence of task.evidence) {
      events.push({
        type: 'evidence_recorded',
        at: evidence.recordedAt,
        label: `Evidence recorded for ${evidence.requirementKey}`,
        taskId: task.taskId,
        evidenceId: evidence.evidenceId,
      });
    }

    if (task.completedAt) {
      events.push({ type: 'task_completed', at: task.completedAt, label: 'Task completed', taskId: task.taskId });
    }

    if (task.failedAt) {
      events.push({ type: 'task_failed', at: task.failedAt, label: task.failureReason ?? 'Task failed', taskId: task.taskId });
    }
  }

  events.push(
    { type: 'result_created', at: record.taskResult.createdAt, label: 'Task result created', taskId: record.taskResult.taskId },
    {
      type: 'validation_evaluated',
      at: record.validation.evaluatedAt,
      label: `Validation ${record.validation.decision}`,
      taskId: record.taskResult.taskId,
      decision: record.validation.decision,
    },
  );

  if (record.contradiction) {
    events.push({
      type: 'contradiction_evaluated',
      at: record.contradiction.evaluatedAt,
      label: `Contradiction action ${record.contradiction.action}`,
      taskId: record.taskResult.taskId,
      action: record.contradiction.action,
    });
  }

  if (record.admission) {
    events.push({
      type: 'admission_evaluated',
      at: record.admission.admittedAt,
      label: `Admission ${record.admission.decision}`,
      taskId: record.taskResult.taskId,
      decision: record.admission.decision,
    });
  }

  return events.sort((a, b) => a.at.localeCompare(b.at) || a.type.localeCompare(b.type));
}

function deriveWarnings(record: CognitivePipelineRecord): readonly string[] {
  const warnings: string[] = [];

  if (record.validation.decision !== 'accepted') {
    warnings.push('Downstream contradiction and admission gates did not run because validation did not accept the claim proposal.');
  }

  if (!record.contradiction && record.validation.decision === 'accepted') {
    warnings.push('Validation accepted the proposal, but no contradiction assessment is attached to this record.');
  }

  if (record.contradiction && !record.admission) {
    warnings.push('Contradiction assessment exists, but no knowledge admission result is attached to this record.');
  }

  return warnings;
}
