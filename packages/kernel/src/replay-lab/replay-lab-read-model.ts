import type { IsoDateTime } from '@internet-brain-os/shared';
import type {
  ClaimProposal,
  ClaimValidationDecision,
  ContradictionAction,
  KnowledgeAdmissionDecision,
  MissionId,
  MissionTaskId,
} from '../mission';
import type {
  CognitivePipelineRecord,
  CognitivePipelineRecordId,
  HermesIngestionReceipt,
  HermesIngestionReceiptStatus,
} from '../storage';

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

export type ReplayLabIdempotencyStatus = 'not_attached_to_record' | 'attached' | 'record_mismatch';

export interface ReplayLabIdempotencyView {
  readonly status: ReplayLabIdempotencyStatus;
  readonly explanation: string;
  readonly idempotencyKey?: string;
  readonly receiptStatus?: HermesIngestionReceiptStatus;
  readonly createdAt?: IsoDateTime;
  readonly updatedAt?: IsoDateTime;
  readonly failure?: string;
  readonly recordMatchesReceipt?: boolean;
}

export interface ReplayLabAuthorityBoundaryView {
  readonly status: 'enforced_before_ingestion';
  readonly forbiddenFields: readonly string[];
  readonly observedAttempt: 'not_persisted';
  readonly explanation: string;
}

export type ReplayLabCausalityNodeType =
  | 'evidence'
  | 'claim_proposal'
  | 'validation_gate'
  | 'existing_claim'
  | 'contradiction_gate'
  | 'admission_gate'
  | 'durable_claim';

export type ReplayLabCausalityEdgeType =
  | 'supports'
  | 'evaluated_by'
  | 'contradicts'
  | 'checked_by'
  | 'decided_by'
  | 'produced';

export interface ReplayLabCausalityNode {
  readonly id: string;
  readonly type: ReplayLabCausalityNodeType;
  readonly label: string;
  readonly sourceId?: string;
  readonly status?: string;
}

export interface ReplayLabCausalityEdge {
  readonly from: string;
  readonly to: string;
  readonly type: ReplayLabCausalityEdgeType;
  readonly basis: 'persisted_record';
}

export interface ReplayLabCausalityView {
  readonly nodes: readonly ReplayLabCausalityNode[];
  readonly edges: readonly ReplayLabCausalityEdge[];
  readonly explanation: string;
}

export type ReplayLabAutopsyOutcome = 'no_failure_observed' | 'task_failed' | 'validation_rejected' | 'contradiction_blocked' | 'human_review_required' | 'pipeline_incomplete' | 'receipt_record_mismatch';
export interface ReplayLabObservedFact { readonly source: 'execution' | 'validation' | 'contradiction' | 'admission' | 'ingestion_receipt'; readonly sourceId: string; readonly statement: string; }
export interface ReplayLabAutopsyView { readonly outcome: ReplayLabAutopsyOutcome; readonly summary: string; readonly observedFacts: readonly ReplayLabObservedFact[]; readonly interpretation?: string; readonly basis: 'deterministic_projection'; readonly limitation: string; }
export interface ReplayLabPreventionRuleProposal { readonly id: string; readonly status: 'proposed_not_enforced'; readonly trigger: string; readonly action: string; readonly sourceOutcome: Exclude<ReplayLabAutopsyOutcome, 'no_failure_observed'>; readonly basis: 'deterministic_projection'; readonly requiresHumanApproval: true; }
export interface ReplayLabPreventionView { readonly proposals: readonly ReplayLabPreventionRuleProposal[]; readonly explanation: string; }

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
  readonly authorityBoundary: ReplayLabAuthorityBoundaryView;
  readonly causality: ReplayLabCausalityView;
  readonly autopsy: ReplayLabAutopsyView;
  readonly prevention: ReplayLabPreventionView;
  readonly warnings: readonly string[];
}

export interface BuildReplayLabCaseViewOptions {
  readonly receipt?: HermesIngestionReceipt;
}

export function buildReplayLabCaseView(
  record: CognitivePipelineRecord,
  options: BuildReplayLabCaseViewOptions = {},
): ReplayLabCaseView {
  const proposal = record.validation.proposal;
  const task = record.execution.tasks.find((candidate) => candidate.taskId === record.taskResult.taskId);
  const evidence = (task?.evidence ?? []).map((evidenceRef): ReplayLabEvidenceRefView => ({
    evidenceId: evidenceRef.evidenceId,
    requirementKey: evidenceRef.requirementKey,
    recordedAt: evidenceRef.recordedAt,
    taskId: task?.taskId ?? record.taskResult.taskId,
    supportsClaimProposal: proposal.evidenceIds.some((candidate) => candidate === evidenceRef.evidenceId),
  }));
  const idempotency = buildIdempotencyView(record, options.receipt);
  const autopsyView = buildAutopsyView(record, idempotency);

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
    idempotency,
    authorityBoundary: {
      status: 'enforced_before_ingestion',
      forbiddenFields: [
        'candidate',
        'validation',
        'contradiction',
        'admission',
        'claimValidation',
        'durableClaim',
        'knowledgeAdmission',
      ],
      observedAttempt: 'not_persisted',
      explanation: 'Hermes authority fields are rejected before transport or Kernel processing. Rejected payload contents are intentionally not persisted or attributed to this accepted case.',
    },
    causality: buildCausalityView(record, evidence),
    autopsy: autopsyView,
    prevention: buildPreventionView(record, autopsyView),
    warnings: deriveWarnings(record, idempotency),
  };
}

function buildAutopsyView(record: CognitivePipelineRecord, idempotency: ReplayLabIdempotencyView): ReplayLabAutopsyView {
  const limitation = 'This finding explains recorded state transitions only; it does not infer hidden agent intent or an unrecorded root cause.';
  const make = (outcome: ReplayLabAutopsyOutcome, summary: string, observedFacts: readonly ReplayLabObservedFact[], interpretation?: string): ReplayLabAutopsyView => ({ outcome, summary, observedFacts, ...(interpretation ? { interpretation } : {}), basis: 'deterministic_projection', limitation });
  const failedTask = record.execution.tasks.find((task) => task.status === 'failed');
  if (idempotency.status === 'record_mismatch') return make('receipt_record_mismatch', 'The attached ingestion receipt points to a different cognitive record.', [{ source: 'ingestion_receipt', sourceId: idempotency.idempotencyKey ?? 'unknown', statement: idempotency.explanation }], 'The receipt-to-record association is inconsistent and must not be trusted for replay status.');
  if (failedTask) return make('task_failed', 'A mission task recorded a failure before the cognitive pipeline completed.', [{ source: 'execution', sourceId: failedTask.taskId, statement: failedTask.failureReason ?? 'Task failed without a recorded reason.' }], 'The recorded task failure prevented a complete evidence-to-memory path.');
  if (record.validation.decision === 'rejected') return make('validation_rejected', 'The Kernel rejected the claim proposal during validation.', record.validation.reasons.map((reason) => ({ source: 'validation', sourceId: record.validation.proposal.id, statement: reason.message })), 'The proposal did not satisfy the recorded validation requirements, so downstream gates did not run.');
  if (record.validation.decision === 'needs_review') return make('human_review_required', 'Claim validation requires human review.', record.validation.reasons.map((reason) => ({ source: 'validation', sourceId: record.validation.proposal.id, statement: reason.message })), 'The Kernel did not accept enough evidence to continue automatically.');
  if (record.contradiction?.action === 'block') return make('contradiction_blocked', 'The contradiction gate blocked knowledge admission.', record.contradiction.reasons.map((reason) => ({ source: 'contradiction', sourceId: record.validation.proposal.id, statement: reason.message })), 'A recorded material contradiction prevented the proposal from becoming durable knowledge.');
  if (record.contradiction?.action === 'review' || record.admission?.decision === 'review') return make('human_review_required', 'The recorded contradiction or admission decision requires human review.', (record.contradiction?.reasons ?? []).map((reason) => ({ source: 'contradiction', sourceId: record.validation.proposal.id, statement: reason.message })), 'The Kernel stopped automatic admission at an explicit review gate.');
  if (!record.contradiction || !record.admission) return make('pipeline_incomplete', 'The persisted cognitive pipeline ends before all required gates completed.', [{ source: 'validation', sourceId: record.validation.proposal.id, statement: !record.contradiction ? 'No contradiction assessment is attached.' : 'No knowledge admission result is attached.' }], 'The record is incomplete and cannot prove a final durable-memory outcome.');
  return make('no_failure_observed', 'No failure or block is recorded in the completed cognitive pipeline.', [{ source: 'admission', sourceId: record.admission.claim?.id ?? record.validation.proposal.id, statement: `Knowledge admission decision: ${record.admission.decision}.` }]);
}

function buildPreventionView(record: CognitivePipelineRecord, autopsy: ReplayLabAutopsyView): ReplayLabPreventionView {
  if (autopsy.outcome === 'no_failure_observed') return { proposals: [], explanation: 'No prevention rule is proposed because the persisted pipeline records no failure or block.' };
  const actions: Record<Exclude<ReplayLabAutopsyOutcome, 'no_failure_observed'>, string> = {
    task_failed: 'Require the task to complete successfully with a recorded failure reason before claim validation.',
    validation_rejected: 'Keep the proposal out of downstream gates until the recorded validation reasons are resolved.',
    contradiction_blocked: 'Quarantine the proposal and require review of the recorded contradictory claims before admission.',
    human_review_required: 'Require explicit human approval before continuing to knowledge admission.',
    pipeline_incomplete: 'Do not treat the case as complete until contradiction and admission results are durably recorded.',
    receipt_record_mismatch: 'Block replay trust and require receipt-to-record reconciliation before further processing.',
  };
  return { proposals: [{ id: `prevention:${record.id}:${autopsy.outcome}`, status: 'proposed_not_enforced', trigger: autopsy.summary, action: actions[autopsy.outcome], sourceOutcome: autopsy.outcome, basis: 'deterministic_projection', requiresHumanApproval: true }], explanation: 'Proposals are derived from the recorded autopsy outcome. They are read-only and are not active Kernel policy.' };
}

function buildCausalityView(
  record: CognitivePipelineRecord,
  evidence: readonly ReplayLabEvidenceRefView[],
): ReplayLabCausalityView {
  const proposal = record.validation.proposal;
  const proposalNodeId = `proposal:${proposal.id}`;
  const validationNodeId = `validation:${proposal.id}`;
  const nodes: ReplayLabCausalityNode[] = evidence.map((item) => ({
    id: `evidence:${item.evidenceId}`,
    type: 'evidence',
    label: `Evidence ${item.requirementKey}`,
    sourceId: item.evidenceId,
  }));
  const edges: ReplayLabCausalityEdge[] = evidence
    .filter((item) => item.supportsClaimProposal)
    .map((item) => ({
      from: `evidence:${item.evidenceId}`,
      to: proposalNodeId,
      type: 'supports',
      basis: 'persisted_record',
    }));

  nodes.push(
    { id: proposalNodeId, type: 'claim_proposal', label: proposal.statement, sourceId: proposal.id, status: proposal.status },
    { id: validationNodeId, type: 'validation_gate', label: 'Claim validation', status: record.validation.decision },
  );
  edges.push({ from: proposalNodeId, to: validationNodeId, type: 'evaluated_by', basis: 'persisted_record' });

  if (record.contradiction) {
    const contradictionNodeId = `contradiction:${proposal.id}`;
    nodes.push({
      id: contradictionNodeId,
      type: 'contradiction_gate',
      label: 'Contradiction check',
      status: record.contradiction.action,
    });
    edges.push({ from: validationNodeId, to: contradictionNodeId, type: 'checked_by', basis: 'persisted_record' });

    for (const claimId of record.contradiction.contradictsClaimIds) {
      const claimNodeId = `existing-claim:${claimId}`;
      nodes.push({ id: claimNodeId, type: 'existing_claim', label: 'Existing claim', sourceId: claimId });
      edges.push({ from: proposalNodeId, to: claimNodeId, type: 'contradicts', basis: 'persisted_record' });
    }

    if (record.admission) {
      const admissionNodeId = `admission:${proposal.id}`;
      nodes.push({
        id: admissionNodeId,
        type: 'admission_gate',
        label: 'Knowledge admission',
        status: record.admission.decision,
      });
      edges.push({ from: contradictionNodeId, to: admissionNodeId, type: 'decided_by', basis: 'persisted_record' });

      if (record.admission.claim) {
        const durableClaimNodeId = `durable-claim:${record.admission.claim.id}`;
        nodes.push({
          id: durableClaimNodeId,
          type: 'durable_claim',
          label: record.admission.claim.statement,
          sourceId: record.admission.claim.id,
          status: record.admission.claim.status,
        });
        edges.push({ from: admissionNodeId, to: durableClaimNodeId, type: 'produced', basis: 'persisted_record' });
      }
    }
  }

  return {
    nodes,
    edges,
    explanation: 'This map contains only links stated by the persisted cognitive pipeline record; it does not infer hidden causes.',
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

function buildIdempotencyView(
  record: CognitivePipelineRecord,
  receipt: HermesIngestionReceipt | undefined,
): ReplayLabIdempotencyView {
  if (!receipt) {
    return {
      status: 'not_attached_to_record',
      explanation: 'No Hermes ingestion receipt was attached to this Replay Lab projection.',
    };
  }

  const recordMatchesReceipt = receipt.recordId === record.id;
  const base = {
    idempotencyKey: receipt.idempotencyKey,
    receiptStatus: receipt.status,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
    recordMatchesReceipt,
    ...(receipt.failure ? { failure: receipt.failure } : {}),
  };

  if (!recordMatchesReceipt) {
    return {
      ...base,
      status: 'record_mismatch',
      explanation: 'Attached Hermes ingestion receipt points to a different cognitive pipeline record and must not be trusted for replay status.',
    };
  }

  return {
    ...base,
    status: 'attached',
    explanation: 'Hermes ingestion receipt is attached by record id. Fingerprints are intentionally not exposed in Replay Lab views.',
  };
}

function deriveWarnings(
  record: CognitivePipelineRecord,
  idempotency: ReplayLabIdempotencyView,
): readonly string[] {
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

  if (idempotency.status === 'record_mismatch') {
    warnings.push('Attached Hermes ingestion receipt does not match this cognitive pipeline record.');
  }

  return warnings;
}
