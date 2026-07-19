import type { MissionTaskId, MissionTaskStatus } from './mission-types';

export class MissionExecutionInvariantError extends Error {
  constructor(readonly reason: string) {
    super(`Mission execution invariant violated: ${reason}`);
    this.name = 'MissionExecutionInvariantError';
  }
}

export class MissionTaskNotFoundError extends Error {
  constructor(readonly taskId: MissionTaskId) {
    super(`Mission task ${taskId} was not found`);
    this.name = 'MissionTaskNotFoundError';
  }
}

export class InvalidMissionTaskTransitionError extends Error {
  constructor(
    readonly taskId: MissionTaskId,
    readonly from: MissionTaskStatus,
    readonly to: MissionTaskStatus,
  ) {
    super(`Mission task ${taskId} cannot transition from ${from} to ${to}`);
    this.name = 'InvalidMissionTaskTransitionError';
  }
}

export class MissionTaskBlockedError extends Error {
  constructor(readonly taskId: MissionTaskId) {
    super(`Mission task ${taskId} is blocked by incomplete dependencies`);
    this.name = 'MissionTaskBlockedError';
  }
}

export class MissingMissionTaskEvidenceError extends Error {
  constructor(readonly taskId: MissionTaskId, readonly missingKeys: readonly string[]) {
    super(`Mission task ${taskId} is missing required evidence: ${missingKeys.join(', ')}`);
    this.name = 'MissingMissionTaskEvidenceError';
  }
}
