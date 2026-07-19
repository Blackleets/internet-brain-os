import type { EvidenceId } from '@internet-brain-os/shared';
import type { MissionExecutionState, MissionTaskExecution } from './mission-execution-types';
import {
  InvalidTaskResultError,
  TaskResultTaskStateError,
  UnsupportedClaimEvidenceError,
} from './task-result-errors';
import type {
  ClaimProposal,
  ClaimProposalDraft,
  ClaimProposalId,
  CreateTaskResultInput,
  TaskResult,
} from './task-result-types';
import type { MissionTaskId } from './mission-types';

export class TaskResultBuilder {
  build(
    execution: MissionExecutionState,
    taskId: MissionTaskId,
    input: CreateTaskResultInput,
  ): TaskResult {
    const task = requireTask(execution, taskId);
    if (task.status !== 'completed') {
      throw new TaskResultTaskStateError(taskId, task.status);
    }

    const summary = normalizeRequired('summary', input.summary);
    const recordedEvidenceIds = dedupe(task.evidence.map((item) => item.evidenceId as EvidenceId));
    const allowedEvidence = new Set<string>(recordedEvidenceIds);
    const claimProposals = (input.claimProposals ?? []).map((draft, index) =>
      buildClaimProposal(execution, taskId, draft, index, allowedEvidence, input.createdAt),
    );

    return {
      id: input.id,
      missionId: execution.missionId,
      taskId,
      summary,
      evidenceIds: recordedEvidenceIds,
      claimProposals,
      createdAt: input.createdAt,
    };
  }
}

function requireTask(
  execution: MissionExecutionState,
  taskId: MissionTaskId,
): MissionTaskExecution {
  const task = execution.tasks.find((candidate) => candidate.taskId === taskId);
  if (!task) throw new InvalidTaskResultError(`unknown task ${taskId}`);
  return task;
}

function buildClaimProposal(
  execution: MissionExecutionState,
  taskId: MissionTaskId,
  draft: ClaimProposalDraft,
  index: number,
  allowedEvidence: ReadonlySet<string>,
  createdAt: CreateTaskResultInput['createdAt'],
): ClaimProposal {
  const statement = normalizeRequired('claim statement', draft.statement);
  if (!Number.isFinite(draft.confidence) || draft.confidence < 0 || draft.confidence > 1) {
    throw new InvalidTaskResultError('claim confidence must be between 0 and 1');
  }

  const evidenceIds = dedupe(draft.evidenceIds);
  if (evidenceIds.length === 0) {
    throw new InvalidTaskResultError('claim proposal requires at least one evidence reference');
  }
  for (const evidenceId of evidenceIds) {
    if (!allowedEvidence.has(evidenceId)) {
      throw new UnsupportedClaimEvidenceError(taskId, evidenceId);
    }
  }

  return {
    id: `${execution.missionId}:${taskId}:claim:${index + 1}` as ClaimProposalId,
    missionId: execution.missionId,
    taskId,
    statement,
    confidence: draft.confidence,
    evidenceIds,
    rationale: normalizeOptional(draft.rationale),
    status: 'proposed',
    createdAt,
  };
}

function normalizeRequired(field: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new InvalidTaskResultError(`${field} is required`);
  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function dedupe<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}
