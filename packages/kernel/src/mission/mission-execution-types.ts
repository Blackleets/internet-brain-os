import type { IsoDateTime } from '@internet-brain-os/shared';
import type { MissionId, MissionPlan, MissionTaskId, MissionTaskStatus } from './mission-types';

export interface MissionTaskEvidenceRef {
  readonly requirementKey: string;
  readonly evidenceId: string;
  readonly recordedAt: IsoDateTime;
}

export interface MissionTaskExecution {
  readonly taskId: MissionTaskId;
  readonly status: MissionTaskStatus;
  readonly evidence: readonly MissionTaskEvidenceRef[];
  readonly startedAt?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
  readonly failedAt?: IsoDateTime;
  readonly failureReason?: string;
}

export interface MissionExecutionState {
  readonly missionId: MissionId;
  readonly plan: MissionPlan;
  readonly tasks: readonly MissionTaskExecution[];
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}
