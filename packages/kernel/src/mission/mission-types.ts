import type { IsoDateTime } from '@internet-brain-os/shared';

export type MissionId = string & { readonly __brand: 'MissionId' };
export type MissionTaskId = string & { readonly __brand: 'MissionTaskId' };

export type MissionStatus =
  | 'draft'
  | 'planned'
  | 'active'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type MissionTaskStatus = 'pending' | 'ready' | 'active' | 'completed' | 'failed';

export interface MissionConstraint {
  readonly kind: 'required' | 'forbidden' | 'limit';
  readonly description: string;
}

export interface EvidenceRequirement {
  readonly key: string;
  readonly description: string;
  readonly required: boolean;
}

export interface MissionTask {
  readonly id: MissionTaskId;
  readonly title: string;
  readonly objective: string;
  readonly status: MissionTaskStatus;
  readonly dependsOn: readonly MissionTaskId[];
  readonly evidenceRequirements: readonly EvidenceRequirement[];
}

export interface MissionPlan {
  readonly summary: string;
  readonly tasks: readonly MissionTask[];
  readonly successCriteria: readonly string[];
  readonly stopConditions: readonly string[];
}

export interface Mission {
  readonly id: MissionId;
  readonly title: string;
  readonly objective: string;
  readonly status: MissionStatus;
  readonly constraints: readonly MissionConstraint[];
  readonly plan?: MissionPlan;
  readonly failureReason?: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface CreateMissionInput {
  readonly id: MissionId;
  readonly title: string;
  readonly objective: string;
  readonly constraints?: readonly MissionConstraint[];
  readonly createdAt: IsoDateTime;
}

export interface MissionPlanner {
  plan(mission: Mission): Promise<MissionPlan>;
}
