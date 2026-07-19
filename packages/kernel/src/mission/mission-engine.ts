import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  InvalidMissionInputError,
  InvalidMissionPlanError,
  InvalidMissionTransitionError,
  MissionTaskDependencyError,
} from './mission-errors';
import type {
  CreateMissionInput,
  Mission,
  MissionConstraint,
  MissionPlan,
  MissionPlanner,
  MissionStatus,
  MissionTask,
  MissionTaskId,
} from './mission-types';

const transitions: Readonly<Record<MissionStatus, readonly MissionStatus[]>> = {
  draft: ['planned', 'cancelled'],
  planned: ['active', 'cancelled'],
  active: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export class MissionEngine {
  constructor(private readonly planner: MissionPlanner) {}

  create(input: CreateMissionInput): Mission {
    return {
      id: input.id,
      title: normalizeRequired('title', input.title),
      objective: normalizeRequired('objective', input.objective),
      status: 'draft',
      constraints: normalizeConstraints(input.constraints),
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    };
  }

  async plan(mission: Mission, updatedAt: IsoDateTime): Promise<Mission> {
    this.assertTransition(mission, 'planned');
    this.assertFresh(mission, updatedAt);
    const plan = await this.planner.plan(cloneMission(mission));
    validatePlan(plan);

    return cloneMission({
      ...mission,
      status: 'planned',
      plan,
      updatedAt,
    });
  }

  start(mission: Mission, updatedAt: IsoDateTime): Mission {
    return this.transition(mission, 'active', updatedAt);
  }

  complete(mission: Mission, updatedAt: IsoDateTime): Mission {
    return this.transition(mission, 'completed', updatedAt);
  }

  fail(mission: Mission, reason: string, updatedAt: IsoDateTime): Mission {
    const normalizedReason = normalizeRequired('failureReason', reason);
    const transitioned = this.transition(mission, 'failed', updatedAt);
    return { ...transitioned, failureReason: normalizedReason };
  }

  cancel(mission: Mission, updatedAt: IsoDateTime): Mission {
    return this.transition(mission, 'cancelled', updatedAt);
  }

  private transition(
    mission: Mission,
    nextStatus: MissionStatus,
    updatedAt: IsoDateTime,
  ): Mission {
    this.assertTransition(mission, nextStatus);
    this.assertFresh(mission, updatedAt);
    return cloneMission({ ...mission, status: nextStatus, updatedAt });
  }

  private assertTransition(mission: Mission, nextStatus: MissionStatus): void {
    if (!transitions[mission.status].includes(nextStatus)) {
      throw new InvalidMissionTransitionError(mission.id, mission.status, nextStatus);
    }
  }

  private assertFresh(mission: Mission, updatedAt: IsoDateTime): void {
    if (updatedAt <= mission.updatedAt) {
      throw new InvalidMissionInputError('updatedAt');
    }
  }
}

function normalizeRequired(field: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new InvalidMissionInputError(field);
  return normalized;
}

function normalizeConstraints(
  constraints: readonly MissionConstraint[] | undefined,
): readonly MissionConstraint[] {
  return (constraints ?? []).map((constraint) => ({
    kind: constraint.kind,
    description: normalizeRequired('constraint.description', constraint.description),
  }));
}

function validatePlan(plan: MissionPlan): void {
  if (!plan.summary.trim()) throw new InvalidMissionPlanError('summary is required');
  if (plan.tasks.length === 0) throw new InvalidMissionPlanError('at least one task is required');
  if (plan.successCriteria.length === 0) {
    throw new InvalidMissionPlanError('at least one success criterion is required');
  }

  const ids = new Set<MissionTaskId>();
  for (const task of plan.tasks) {
    validateTask(task);
    if (ids.has(task.id)) throw new InvalidMissionPlanError(`duplicate task id ${task.id}`);
    ids.add(task.id);
  }

  for (const task of plan.tasks) {
    for (const dependencyId of task.dependsOn) {
      if (!ids.has(dependencyId)) {
        throw new MissionTaskDependencyError(task.id, dependencyId);
      }
      if (dependencyId === task.id) {
        throw new InvalidMissionPlanError(`task ${task.id} cannot depend on itself`);
      }
    }
  }

  assertAcyclic(plan.tasks);
}

function validateTask(task: MissionTask): void {
  if (!task.title.trim()) throw new InvalidMissionPlanError('task title is required');
  if (!task.objective.trim()) throw new InvalidMissionPlanError('task objective is required');
  const keys = new Set<string>();
  for (const requirement of task.evidenceRequirements) {
    const key = requirement.key.trim();
    if (!key || !requirement.description.trim()) {
      throw new InvalidMissionPlanError('evidence requirement key and description are required');
    }
    if (keys.has(key)) {
      throw new InvalidMissionPlanError(`duplicate evidence requirement ${key}`);
    }
    keys.add(key);
  }
}

function assertAcyclic(tasks: readonly MissionTask[]): void {
  const tasksById = new Map(tasks.map((task) => [task.id, task] as const));
  const visiting = new Set<MissionTaskId>();
  const visited = new Set<MissionTaskId>();

  const visit = (taskId: MissionTaskId): void => {
    if (visited.has(taskId)) return;
    if (visiting.has(taskId)) {
      throw new InvalidMissionPlanError(`dependency cycle detected at ${taskId}`);
    }
    visiting.add(taskId);
    for (const dependencyId of tasksById.get(taskId)?.dependsOn ?? []) visit(dependencyId);
    visiting.delete(taskId);
    visited.add(taskId);
  };

  for (const task of tasks) visit(task.id);
}

function cloneMission(mission: Mission): Mission {
  return {
    ...mission,
    constraints: mission.constraints.map((constraint) => ({ ...constraint })),
    plan: mission.plan
      ? {
          ...mission.plan,
          successCriteria: [...mission.plan.successCriteria],
          stopConditions: [...mission.plan.stopConditions],
          tasks: mission.plan.tasks.map((task) => ({
            ...task,
            dependsOn: [...task.dependsOn],
            evidenceRequirements: task.evidenceRequirements.map((item) => ({ ...item })),
          })),
        }
      : undefined,
  };
}
