import { v4 as uuidv4 } from 'uuid';
import type { UniversalGoal } from '../goal/goal-contract';
import type { MissionTask, MissionTaskId } from '../mission/mission-types';
import {
  computeProposedPlanHash,
  PROPOSED_PLAN_CONTRACT_VERSION,
  type CreateProposedPlanInput,
  type PlanDependencyCheckpoint,
  type ProposedPlan,
  type RequestedCapability,
  type UpdateProposedPlanInput,
} from './proposed-plan-contract';
import {
  GoalNotFoundForPlanError,
  InvalidProposedPlanInputError,
  ProposedPlanCapabilityDeniedError,
  ProposedPlanDependencyError,
  ProposedPlanNotFoundError,
  ProposedPlanRevisionConflictError,
} from './proposed-plan-errors';

export interface ProposedPlanStore {
  transaction<T>(callback: (plans: ProposedPlan[]) => Promise<T>): Promise<T>;
  write(plans: ProposedPlan[]): Promise<void>;
}

export interface ProposedPlanManagerOptions {
  readonly maxDepth?: number;
  readonly maxTasks?: number;
  readonly now?: () => Date;
  readonly createId?: () => string;
}

export class ProposedPlanManager {
  private readonly maxDepth: number;
  private readonly maxTasks: number;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(
    private readonly store: ProposedPlanStore,
    private readonly getGoal: (goalId: string) => Promise<UniversalGoal | null>,
    options: ProposedPlanManagerOptions | number = {},
    legacyMaxTasks?: number,
  ) {
    if (typeof options === 'number') {
      this.maxDepth = options;
      this.maxTasks = legacyMaxTasks ?? 20;
      this.now = () => new Date();
      this.createId = () => `proposed-plan:${uuidv4()}`;
      return;
    }
    this.maxDepth = options.maxDepth ?? 10;
    this.maxTasks = options.maxTasks ?? 20;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => `proposed-plan:${uuidv4()}`);
  }

  async createProposedPlan(input: CreateProposedPlanInput): Promise<ProposedPlan> {
    const id = cleanRequired(input.id ?? this.createId(), 'id');
    const goalId = cleanRequired(input.goalId, 'goalId');
    const goal = await this.requireGoal(id, goalId);
    const content = this.validateAndCloneContent(id, goal, input);
    const now = this.now().toISOString();
    const changedBy = cleanActor(input.changedBy);
    const revisionNumber = 1;
    const plan = this.buildRevision({
      id,
      goalId,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      revisionNumber,
      previousRevisionId: null,
      changedBy,
      content,
    });

    return this.store.transaction(async (plans) => {
      if (plans.some((candidate) => candidate.id === id)) {
        throw new InvalidProposedPlanInputError('id', id, `Proposed plan already exists: ${id}`);
      }
      await this.store.write([...plans, clonePlan(plan)]);
      return clonePlan(plan);
    });
  }

  async getProposedPlan(id: string): Promise<ProposedPlan | null> {
    return this.store.transaction(async (plans) => {
      const latest = latestRevision(plans.filter((plan) => plan.id === id));
      return latest ? clonePlan(latest) : null;
    });
  }

  async getProposedPlanHistory(id: string): Promise<readonly ProposedPlan[]> {
    return this.store.transaction(async (plans) => plans
      .filter((plan) => plan.id === id)
      .sort((left, right) => left.revisionNumber - right.revisionNumber)
      .map(clonePlan));
  }

  async listProposedPlansForGoal(goalId: string): Promise<ProposedPlan[]> {
    return this.store.transaction(async (plans) => {
      const latestById = new Map<string, ProposedPlan>();
      for (const plan of plans) {
        if (plan.goalId !== goalId) continue;
        const current = latestById.get(plan.id);
        if (!current || plan.revisionNumber > current.revisionNumber) latestById.set(plan.id, plan);
      }
      return [...latestById.values()]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id))
        .map(clonePlan);
    });
  }

  async updateProposedPlan(id: string, updates: UpdateProposedPlanInput): Promise<ProposedPlan> {
    const expectedRevisionId = cleanRequired(updates.expectedRevisionId, 'expectedRevisionId');

    return this.store.transaction(async (plans) => {
      const current = latestRevision(plans.filter((plan) => plan.id === id));
      if (!current) throw new ProposedPlanNotFoundError(id);
      if (current.revisionId !== expectedRevisionId) {
        throw new ProposedPlanRevisionConflictError(id, expectedRevisionId, current.revisionId);
      }

      const goal = await this.requireGoal(id, current.goalId);
      const content = this.validateAndCloneContent(id, goal, {
        planSummary: updates.planSummary ?? current.planSummary,
        planTasks: updates.planTasks ?? current.planTasks,
        requestedCapabilities: updates.requestedCapabilities ?? current.requestedCapabilities,
        expectedEvidence: updates.expectedEvidence ?? current.expectedEvidence,
        approvalCheckpoints: updates.approvalCheckpoints ?? current.approvalCheckpoints,
        completionConditions: updates.completionConditions ?? current.completionConditions,
      });
      const now = this.now().toISOString();
      const next = this.buildRevision({
        id: current.id,
        goalId: current.goalId,
        status: current.status,
        createdAt: current.createdAt,
        updatedAt: now,
        revisionNumber: current.revisionNumber + 1,
        previousRevisionId: current.revisionId,
        changedBy: cleanActor(updates.changedBy),
        content,
        createdRevision: current.createdRevision,
      });

      await this.store.write([...plans, clonePlan(next)]);
      return clonePlan(next);
    });
  }

  private async requireGoal(planId: string, goalId: string): Promise<UniversalGoal> {
    const goal = await this.getGoal(goalId);
    if (!goal) throw new GoalNotFoundForPlanError(planId, goalId);
    return goal;
  }

  private validateAndCloneContent(
    planId: string,
    goal: UniversalGoal,
    input: Pick<CreateProposedPlanInput,
      | 'planSummary'
      | 'planTasks'
      | 'requestedCapabilities'
      | 'expectedEvidence'
      | 'approvalCheckpoints'
      | 'completionConditions'>,
  ) {
    const planSummary = cleanRequired(input.planSummary, 'planSummary');
    if (planSummary.length < 3) {
      throw new InvalidProposedPlanInputError('planSummary', input.planSummary, 'Proposed plan summary must be at least 3 characters');
    }
    if (input.planTasks.length > this.maxTasks) {
      throw new InvalidProposedPlanInputError('planTasks', input.planTasks.length, `Plan exceeds maximum allowed tasks (${this.maxTasks})`);
    }

    const planTasks = input.planTasks.map(cloneTask);
    this.validateTaskGraph(planId, planTasks);
    this.validateCheckpoints(planId, planTasks, input.approvalCheckpoints, 'approvalCheckpoints');
    this.validateCheckpoints(planId, planTasks, input.completionConditions, 'completionConditions');

    const requestedCapabilities = input.requestedCapabilities.map((capability) => ({
      capabilityId: cleanRequired(capability.capabilityId, 'capabilityId'),
      ...(capability.version === undefined ? {} : { version: cleanRequired(capability.version, 'capabilityVersion') }),
    }));
    this.validateRequestedCapabilities(requestedCapabilities, goal, planId);

    const expectedEvidence = input.expectedEvidence.map((evidence) => ({
      key: cleanRequired(evidence.key, 'expectedEvidence.key'),
      description: cleanRequired(evidence.description, 'expectedEvidence.description'),
    }));
    assertUnique(expectedEvidence.map((evidence) => evidence.key), 'expectedEvidence.key');

    return {
      planSummary,
      planTasks,
      requestedCapabilities,
      expectedEvidence,
      approvalCheckpoints: input.approvalCheckpoints.map(cloneCheckpoint),
      completionConditions: input.completionConditions.map(cloneCheckpoint),
    };
  }

  private validateTaskGraph(planId: string, tasks: readonly MissionTask[]): void {
    const taskIds = tasks.map((task) => task.id);
    assertUnique(taskIds.map(String), 'planTasks.id');
    const tasksById = new Map(tasks.map((task) => [task.id, task] as const));

    for (const task of tasks) {
      for (const dependencyId of task.dependsOn) {
        if (!tasksById.has(dependencyId)) {
          throw new ProposedPlanDependencyError(planId, String(task.id), `Unknown dependency ${String(dependencyId)}`);
        }
      }
    }

    const visiting = new Set<MissionTaskId>();
    const visited = new Set<MissionTaskId>();
    const visit = (taskId: MissionTaskId, depth: number): void => {
      if (depth > this.maxDepth) {
        throw new ProposedPlanDependencyError(planId, String(taskId), `Dependency depth exceeds ${this.maxDepth}`);
      }
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        throw new ProposedPlanDependencyError(planId, String(taskId), 'Dependency cycle detected');
      }
      visiting.add(taskId);
      for (const dependencyId of tasksById.get(taskId)?.dependsOn ?? []) visit(dependencyId, depth + 1);
      visiting.delete(taskId);
      visited.add(taskId);
    };
    for (const task of tasks) visit(task.id, 1);
  }

  private validateCheckpoints(
    planId: string,
    tasks: readonly MissionTask[],
    checkpoints: readonly PlanDependencyCheckpoint[],
    field: string,
  ): void {
    const taskIds = new Set(tasks.map((task) => task.id));
    for (const checkpoint of checkpoints) {
      cleanRequired(checkpoint.description, `${field}.description`);
      for (const dependencyId of checkpoint.dependsOn) {
        if (!taskIds.has(dependencyId)) {
          throw new ProposedPlanDependencyError(planId, String(dependencyId), `${field} references an unknown task`);
        }
      }
    }
  }

  private validateRequestedCapabilities(
    requested: readonly RequestedCapability[],
    goal: UniversalGoal,
    planId: string,
  ): void {
    const topLevelAllowed = new Set(goal.allowedCapabilities ?? []);
    const constrainedAllowed = new Set(goal.constraints?.allowedCapabilities ?? []);
    const forbidden = new Set([
      ...(goal.forbiddenCapabilities ?? []),
      ...(goal.constraints?.forbiddenCapabilities ?? []),
    ]);

    for (const request of requested) {
      const allowedByGoal = topLevelAllowed.has(request.capabilityId);
      const allowedByConstraints = constrainedAllowed.size === 0 || constrainedAllowed.has(request.capabilityId);
      if (!allowedByGoal || !allowedByConstraints || forbidden.has(request.capabilityId)) {
        throw new ProposedPlanCapabilityDeniedError(planId, request.capabilityId);
      }
    }
  }

  private buildRevision(input: {
    readonly id: string;
    readonly goalId: string;
    readonly status: ProposedPlan['status'];
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly revisionNumber: number;
    readonly previousRevisionId: string | null;
    readonly changedBy: string;
    readonly content: ReturnType<ProposedPlanManager['validateAndCloneContent']>;
    readonly createdRevision?: ProposedPlan['createdRevision'];
  }): ProposedPlan {
    const revisionId = `${input.id}:rev:${input.revisionNumber}`;
    const revision = {
      revision: input.revisionNumber,
      changedAt: input.updatedAt,
      changedBy: input.changedBy,
      diff: {},
    };
    const hashInput = { goalId: input.goalId, ...input.content };
    return {
      contractVersion: PROPOSED_PLAN_CONTRACT_VERSION,
      id: input.id,
      goalId: input.goalId,
      ...input.content,
      status: input.status,
      revisionNumber: input.revisionNumber,
      previousRevisionId: input.previousRevisionId,
      revisionId,
      contentHash: computeProposedPlanHash(hashInput),
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      createdRevision: input.createdRevision ? cloneRevision(input.createdRevision) : revision,
      currentRevision: revision,
    };
  }
}

function latestRevision(plans: readonly ProposedPlan[]): ProposedPlan | undefined {
  return plans.reduce<ProposedPlan | undefined>((latest, candidate) => (
    !latest || candidate.revisionNumber > latest.revisionNumber ? candidate : latest
  ), undefined);
}

function cleanRequired(value: string, field: string): string {
  if (typeof value !== 'string') throw new InvalidProposedPlanInputError(field, value, `${field} must be a string`);
  const cleaned = value.trim();
  if (!cleaned) throw new InvalidProposedPlanInputError(field, value, `${field} must not be empty`);
  return cleaned;
}

function cleanActor(value: string | undefined): string {
  return value === undefined ? 'system' : cleanRequired(value, 'changedBy');
}

function assertUnique(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) {
    throw new InvalidProposedPlanInputError(field, values, `${field} must contain unique values`);
  }
}

function cloneTask(task: MissionTask): MissionTask {
  return {
    ...task,
    dependsOn: [...task.dependsOn],
    evidenceRequirements: task.evidenceRequirements.map((requirement) => ({ ...requirement })),
  };
}

function cloneCheckpoint(checkpoint: PlanDependencyCheckpoint): PlanDependencyCheckpoint {
  return { description: checkpoint.description.trim(), dependsOn: [...checkpoint.dependsOn] };
}

function cloneRevision(revision: ProposedPlan['createdRevision']): ProposedPlan['createdRevision'] {
  return { ...revision, diff: { ...revision.diff } };
}

function clonePlan(plan: ProposedPlan): ProposedPlan {
  return {
    ...plan,
    planTasks: plan.planTasks.map(cloneTask),
    requestedCapabilities: plan.requestedCapabilities.map((capability) => ({ ...capability })),
    expectedEvidence: plan.expectedEvidence.map((evidence) => ({ ...evidence })),
    approvalCheckpoints: plan.approvalCheckpoints.map(cloneCheckpoint),
    completionConditions: plan.completionConditions.map(cloneCheckpoint),
    createdRevision: cloneRevision(plan.createdRevision),
    currentRevision: cloneRevision(plan.currentRevision),
  };
}
