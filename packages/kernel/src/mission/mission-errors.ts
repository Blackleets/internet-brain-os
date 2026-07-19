import type { MissionId, MissionStatus, MissionTaskId } from './mission-types';

export class InvalidMissionInputError extends Error {
  constructor(readonly field: string) {
    super(`Invalid mission input: ${field}`);
    this.name = 'InvalidMissionInputError';
  }
}

export class InvalidMissionTransitionError extends Error {
  constructor(
    readonly missionId: MissionId,
    readonly from: MissionStatus,
    readonly to: MissionStatus,
  ) {
    super(`Mission ${missionId} cannot transition from ${from} to ${to}`);
    this.name = 'InvalidMissionTransitionError';
  }
}

export class InvalidMissionPlanError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid mission plan: ${reason}`);
    this.name = 'InvalidMissionPlanError';
  }
}

export class MissionTaskDependencyError extends Error {
  constructor(readonly taskId: MissionTaskId, readonly dependencyId: MissionTaskId) {
    super(`Mission task ${taskId} depends on unknown task ${dependencyId}`);
    this.name = 'MissionTaskDependencyError';
  }
}
