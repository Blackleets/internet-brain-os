import type { Mission, MissionPlan, MissionPlanner, MissionTask, MissionTaskId } from './mission-types';
import { InvalidMissionPlanError } from './mission-errors';

export interface MissionTaskDraft {
  readonly key: string;
  readonly title: string;
  readonly objective: string;
  readonly dependsOn?: readonly string[];
  readonly evidenceRequirements: readonly {
    readonly key: string;
    readonly description: string;
    readonly required?: boolean;
  }[];
}

export interface MissionPlanningDraft {
  readonly summary: string;
  readonly tasks: readonly MissionTaskDraft[];
  readonly successCriteria: readonly string[];
  readonly stopConditions?: readonly string[];
}

export interface MissionTaskDecomposer {
  decompose(mission: Mission): Promise<MissionPlanningDraft>;
}

export interface EvidenceAwarePlannerPolicy {
  readonly requireEvidenceForEveryTask: boolean;
  readonly minimumSuccessCriteria: number;
  readonly defaultStopConditions: readonly string[];
}

const defaultPolicy: EvidenceAwarePlannerPolicy = {
  requireEvidenceForEveryTask: true,
  minimumSuccessCriteria: 1,
  defaultStopConditions: ['Required evidence cannot be obtained reliably'],
};

export class EvidenceAwareMissionPlanner implements MissionPlanner {
  private readonly policy: EvidenceAwarePlannerPolicy;

  constructor(
    private readonly decomposer: MissionTaskDecomposer,
    policy: Partial<EvidenceAwarePlannerPolicy> = {},
  ) {
    this.policy = {
      ...defaultPolicy,
      ...policy,
      defaultStopConditions:
        policy.defaultStopConditions ?? defaultPolicy.defaultStopConditions,
    };
  }

  async plan(mission: Mission): Promise<MissionPlan> {
    const draft = await this.decomposer.decompose(cloneMission(mission));
    const summary = required('summary', draft.summary);
    const successCriteria = normalizeList('successCriteria', draft.successCriteria);

    if (successCriteria.length < this.policy.minimumSuccessCriteria) {
      throw new InvalidMissionPlanError(
        `at least ${this.policy.minimumSuccessCriteria} success criteria are required`,
      );
    }

    const taskIds = new Map<string, MissionTaskId>();
    draft.tasks.forEach((task, index) => {
      const key = required('task.key', task.key);
      if (taskIds.has(key)) {
        throw new InvalidMissionPlanError(`duplicate task key ${key}`);
      }
      taskIds.set(key, `${mission.id}:${slug(key)}:${index + 1}` as MissionTaskId);
    });

    const tasks: MissionTask[] = draft.tasks.map((task) => {
      const taskId = taskIds.get(task.key.trim());
      if (!taskId) throw new InvalidMissionPlanError(`missing task id for ${task.key}`);

      const dependsOn = (task.dependsOn ?? []).map((dependencyKey) => {
        const normalizedKey = required('task.dependsOn', dependencyKey);
        const dependencyId = taskIds.get(normalizedKey);
        if (!dependencyId) {
          throw new InvalidMissionPlanError(
            `task ${task.key} depends on unknown task key ${normalizedKey}`,
          );
        }
        return dependencyId;
      });

      const evidenceRequirements = task.evidenceRequirements.map((requirement) => ({
        key: required('evidenceRequirement.key', requirement.key),
        description: required('evidenceRequirement.description', requirement.description),
        required: requirement.required ?? true,
      }));

      if (this.policy.requireEvidenceForEveryTask && evidenceRequirements.length === 0) {
        throw new InvalidMissionPlanError(`task ${task.key} has no evidence requirements`);
      }

      return {
        id: taskId,
        title: required('task.title', task.title),
        objective: required('task.objective', task.objective),
        status: dependsOn.length === 0 ? 'ready' : 'pending',
        dependsOn,
        evidenceRequirements,
      };
    });

    const stopConditions = normalizeList(
      'stopConditions',
      draft.stopConditions?.length
        ? draft.stopConditions
        : this.policy.defaultStopConditions,
    );

    return {
      summary,
      tasks,
      successCriteria,
      stopConditions,
    };
  }
}

function required(field: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new InvalidMissionPlanError(`${field} is required`);
  return normalized;
}

function normalizeList(field: string, values: readonly string[]): readonly string[] {
  const normalized = values.map((value) => required(field, value));
  return [...new Set(normalized)];
}

function slug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized) throw new InvalidMissionPlanError('task key must contain letters or numbers');
  return normalized;
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
