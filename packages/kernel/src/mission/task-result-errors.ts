import type { MissionTaskId } from './mission-types';

export class InvalidTaskResultError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid task result: ${reason}`);
    this.name = 'InvalidTaskResultError';
  }
}

export class TaskResultTaskStateError extends Error {
  constructor(readonly taskId: MissionTaskId, readonly status: string) {
    super(`Task ${taskId} must be completed before producing a result; current status is ${status}`);
    this.name = 'TaskResultTaskStateError';
  }
}

export class UnsupportedClaimEvidenceError extends Error {
  constructor(readonly taskId: MissionTaskId, readonly evidenceId: string) {
    super(`Claim proposal for task ${taskId} references evidence not recorded by that task: ${evidenceId}`);
    this.name = 'UnsupportedClaimEvidenceError';
  }
}
