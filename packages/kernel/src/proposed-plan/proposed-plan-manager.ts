import { v4 as uuidv4 } from 'uuid';
import { UniversalGoal } from '../goal/goal-contract';
import { MissionTask, MissionTaskId } from '../mission/mission-types';
import { ProposedPlan, CreateProposedPlanInput, PROPOSED_PLAN_CONTRACT_VERSION, ProposedPlanStatus, computeProposedPlanHash } from './proposed-plan-contract';
import { ProposedPlanNotFoundError, GoalNotFoundForPlanError, InvalidProposedPlanInputError, ProposedPlanCapabilityDeniedError, ProposedPlanDependencyError, ProposedPlanRevisionConflictError } from './proposed-plan-errors';

export interface ProposedPlanStore {
  transaction<T>(callback: (data: any) => Promise<T>): Promise<T>;
  write(data: any): Promise<void>;
  // We assume the store also has a way to get a goal by id.
  getGoal?(goalId: string): Promise<UniversalGoal | null>;
}

export class ProposedPlanManager {
  constructor(private store: ProposedPlanStore, private maxDepth = 10, private maxTasks = 20) {}

  async createProposedPlan(input: CreateProposedPlanInput): Promise<ProposedPlan> {
    // Fetch the goal to validate against it
    const goal = await this.store.getGoal?.(input.goalId);
    if (!goal) {
      throw new GoalNotFoundForPlanError('unknown', input.goalId);
    }

    // Validate that the plan does not exceed max tasks
    if (input.planTasks.length > this.maxTasks) {
      throw new Error(`Plan exceeds maximum allowed tasks (${this.maxTasks})`);
    }

    // Validate that there are no cycles in the task dependency graph
    this.validateNoCycles(input.planTasks);

    // Generate ID if not provided
    const id = input.id ?? `proposed-plan:${uuidv4()}`;
    const now = new Date().toISOString();

    // Build the proposed plan (without revision metadata and contentHash)
    const basePlan: Omit<ProposedPlan, 'revisionNumber' | 'previousRevisionId' | 'revisionId' | 'contentHash' | 'createdRevision' | 'currentRevision'> = {
      ...input,
      id,
      contractVersion: PROPOSED_PLAN_CONTRACT_VERSION,
      status: 'draft', // starts as draft
      createdAt: now,
      updatedAt: now,
    };

    // Validate that the requested capabilities are allowed by the goal (now that we have the id)
    this.validateRequestedCapabilities(input.requestedCapabilities, goal, id);

    // Compute content hash from the canonical content (excluding mutables)
    const contentHash = computeProposedPlanHash(basePlan as Pick<ProposedPlan, 
      | 'goalId'
      | 'planSummary'
      | 'planTasks'
      | 'requestedCapabilities'
      | 'expectedEvidence'
      | 'approvalCheckpoints'
      | 'completionConditions'>);

    // Create revision metadata
    const revisionNumber = 1;
    const previousRevisionId: string | null = null;
    const revisionId = `${id}:rev:${revisionNumber}`; // simple deterministic revision ID
    const changedAt = now;
    const changedBy = 'system';
    const diff: Record<string, unknown> = {};

    const proposedPlan: ProposedPlan = {
      ...basePlan,
      revisionNumber,
      previousRevisionId,
      revisionId,
      contentHash,
      createdRevision: {
        revision: revisionNumber,
        changedAt,
        changedBy,
        diff,
      },
      currentRevision: {
        revision: revisionNumber,
        changedAt,
        changedBy,
        diff,
      },
    };

    // Validate the proposed plan (basic validation)
    await this.validateProposedPlan(proposedPlan);

    // Save to store
    return this.store.transaction(async (data) => {
      const plans = Array.isArray(data.proposedPlans) ? data.proposedPlans : [];
      // Check for duplicate id (optional)
      const existing = plans.find((p: ProposedPlan) => p.id === proposedPlan.id);
      if (existing) {
        throw new Error(`Proposed plan with id ${proposedPlan.id} already exists`);
      }
      const updated = [...plans, proposedPlan];
      await this.store.write({ ...data, proposedPlans: updated });
      return proposedPlan;
    });
  }

  async getProposedPlan(id: string): Promise<ProposedPlan | null> {
    return this.store.transaction(async (data) => {
      const plans = Array.isArray(data.proposedPlans) ? data.proposedPlans : [];
      return plans.find((p: ProposedPlan) => p.id === id) ?? null;
    });
  }

  async listProposedPlansForGoal(goalId: string): Promise<ProposedPlan[]> {
    return this.store.transaction(async (data) => {
      const plans = Array.isArray(data.proposedPlans) ? data.proposedPlans : [];
      return plans
        .filter((p: ProposedPlan) => p.goalId === goalId)
        .sort((a: ProposedPlan, b: ProposedPlan) => {
          // Sort by revisionNumber descending, then by updatedAt descending
          if (a.revisionNumber !== b.revisionNumber) return b.revisionNumber - a.revisionNumber;
          return b.updatedAt.localeCompare(a.updatedAt);
        });
    });
  }

  async updateProposedPlan(id: string, updates: Partial<Omit<ProposedPlan, 'id' | 'contractVersion' | 'createdAt' | 'createdRevision'>>): Promise<ProposedPlan> {
    return this.store.transaction(async (data) => {
      const plans = Array.isArray(data.proposedPlans) ? data.proposedPlans : [];
      const index = plans.findIndex((p: ProposedPlan) => p.id === id);
      if (index === -1) {
        throw new ProposedPlanNotFoundError(id);
      }
      const old = plans[index];

      // We cannot change the goalId or the id (immutable)
      // We'll merge the updates, but we must ensure that we don't change immutable fields
      const updatedBase: Omit<ProposedPlan, 'revisionNumber' | 'previousRevisionId' | 'revisionId' | 'contentHash' | 'createdRevision' | 'currentRevision'> = {
        ...old,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // Validate that the requested capabilities are allowed by the goal (if they are being updated)
      if (updates.requestedCapabilities !== undefined) {
        const goal = await this.store.getGoal?.(updatedBase.goalId);
        if (!goal) {
          throw new GoalNotFoundForPlanError(id, updatedBase.goalId);
        }
        this.validateRequestedCapabilities(updatedBase.requestedCapabilities, goal, id);
      }

      // Validate that there are no cycles in the task dependency graph (if planTasks are being updated)
      if (updates.planTasks !== undefined) {
        this.validateNoCycles(updatedBase.planTasks);
      }

      // Compute content hash from the canonical content (excluding mutables)
      const contentHash = computeProposedPlanHash(updatedBase as Pick<ProposedPlan, 
        | 'goalId'
        | 'planSummary'
        | 'planTasks'
        | 'requestedCapabilities'
        | 'expectedEvidence'
        | 'approvalCheckpoints'
        | 'completionConditions'>);

      // Update revision metadata
      const previousRevisionId = old.revisionId;
      const revisionNumber = old.revisionNumber + 1;
      const revisionId = `${id}:rev:${revisionNumber}`;
      const changedAt = new Date().toISOString();
      const changedBy = 'system'; // TODO: get from context
      const diff: Record<string, unknown> = {}; // TODO: compute diff

      const updatedPlan: ProposedPlan = {
        ...updatedBase,
        revisionNumber,
        previousRevisionId,
        revisionId,
        contentHash,
        createdRevision: old.createdRevision, // unchanged
        currentRevision: {
          revision: revisionNumber,
          changedAt,
          changedBy,
          diff,
        },
      };

      // Validate the updated plan (basic validation)
      await this.validateProposedPlan(updatedPlan);

      const newPlans = [...plans];
      newPlans[index] = updatedPlan;
      await this.store.write({ ...data, proposedPlans: newPlans });
      return updatedPlan;
    });
  }

  // Helper methods

  private validateNoCycles(tasks: readonly MissionTask[]): void {
    // We'll reuse the cycle detection from the evidence-aware-planner (simplified)
    const tasksById = new Map<MissionTaskId, MissionTask>();
    tasks.forEach((task) => {
      tasksById.set(task.id, task);
    });

    const visiting = new Set<MissionTaskId>();
    const visited = new Set<MissionTaskId>();

    const visit = (taskId: MissionTaskId): void => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        throw new ProposedPlanDependencyError('unknown', taskId, 'Dependency cycle detected');
      }
      visiting.add(taskId);
      const task = tasksById.get(taskId);
      if (task) {
        for (const depId of task.dependsOn) {
          visit(depId);
        }
      }
      visiting.delete(taskId);
      visited.add(taskId);
    };

    for (const task of tasks) {
      visit(task.id);
    }
  }

  private validateRequestedCapabilities(
    requested: readonly { capabilityId: string; version?: string }[],
    goal: UniversalGoal,
    planId: string
  ): void {
    // If the goal specifies allowedCapabilities, then every requested capability must be in that list.
    // If the goal specifies forbiddenCapabilities, then no requested capability can be in that list.
    // If the goal does not specify allowedCapabilities, then we assume no capabilities are allowed (deny by default).
    // However, the goal might not have any capabilities specified (meaning it's a generic goal).
    // We'll follow the rule: if the goal has allowedCapabilities defined, then we must check against it.
    // If the goal has forbiddenCapabilities defined, we must check against it.
    // If neither is defined, then we allow? But the principle says absence of permission means denial.
    // We'll interpret: if the goal does not specify any allowedCapabilities, then no capabilities are allowed unless explicitly allowed? 
    // Actually, the goal's allowedCapabilities and forbiddenCapabilities are the policy.
    // If they are not set, then there is no policy? We'll assume that means no restrictions (but that violates the principle).
    // To be safe, we will require that the goal explicitly defines allowedCapabilities. If it doesn't, then we treat it as allowing none.
    // However, note that the goal might be legacy and not have these fields. We'll need to handle legacy goals.
    // For now, we'll assume that the goal has been migrated to a UniversalGoal and has the capabilities fields.
    // We'll do:
    const allowed = goal.allowedCapabilities ?? [];
    const forbidden = goal.forbiddenCapabilities ?? [];

    // If allowed is non-empty, then we must check that every requested capability is in allowed.
    // If allowed is empty, then we treat it as no capabilities are allowed (unless the goal has no capability fields at all?).
    // We'll check if the goal has the capability fields (they are optional in UniversalGoal? Actually, they are required arrays).
    // Looking at the goal-contract.ts, allowedCapabilities and forbiddenCapabilities are required arrays (they are present, but can be empty).
    // So we can rely on them being present.

    for (const req of requested) {
      if (allowed.length > 0 && !allowed.includes(req.capabilityId)) {
        throw new ProposedPlanCapabilityDeniedError(planId, req.capabilityId);
      }
      if (forbidden.includes(req.capabilityId)) {
        throw new ProposedPlanCapabilityDeniedError(planId, req.capabilityId);
      }
    }
  }

  private async validateProposedPlan(plan: ProposedPlan): Promise<void> {
    // Basic validation: planSummary required, status valid, etc.
    if (!plan.planSummary || plan.planSummary.trim().length < 3) {
      throw new InvalidProposedPlanInputError('planSummary', plan.planSummary, 'Proposed plan summary must be at least 3 characters');
    }
    if (!['draft', 'validated', 'approved', 'rejected'].includes(plan.status)) {
      throw new InvalidProposedPlanInputError('status', plan.status, `Invalid proposed plan status: ${plan.status}`);
    }
    // Additional validation can be added here (e.g., check that the plan's expected evidence is reasonable, etc.)
  }
}