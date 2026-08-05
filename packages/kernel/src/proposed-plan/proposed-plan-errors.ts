import { InvalidGoalError } from '../goal/goal-errors';

export class ProposedPlanNotFoundError extends Error {
  readonly planId: string;
  constructor(planId: string) {
    super(`Proposed plan not found: ${planId}`);
    this.name = 'ProposedPlanNotFoundError';
    this.planId = planId;
  }
}

export class GoalNotFoundForPlanError extends Error {
  readonly planId: string;
  readonly goalId: string;
  constructor(planId: string, goalId: string) {
    super(`Goal not found: ${goalId}`);
    this.name = 'GoalNotFoundForPlanError';
    this.planId = planId;
    this.goalId = goalId;
  }
}

export class InvalidProposedPlanInputError extends Error {
  readonly field: string;
  readonly value: unknown;
  constructor(field: string, value: unknown, message?: string) {
    super(message || `Invalid proposed plan input for field '${field}': ${JSON.stringify(value)}`);
    this.name = 'InvalidProposedPlanInputError';
    this.field = field;
    this.value = value;
  }
}

export class ProposedPlanCapabilityDeniedError extends Error {
  readonly planId: string;
  readonly capabilityId: string;
  constructor(planId: string, capabilityId: string) {
    super(`Capability ${capabilityId} is not allowed by the goal`);
    this.name = 'ProposedPlanCapabilityDeniedError';
    this.planId = planId;
    this.capabilityId = capabilityId;
  }
}

export class ProposedPlanDependencyError extends Error {
  readonly planId: string;
  readonly taskId: string;
  constructor(planId: string, taskId: string, message: string) {
    super(message);
    this.name = 'ProposedPlanDependencyError';
    this.planId = planId;
    this.taskId = taskId;
  }
}

export class ProposedPlanRevisionConflictError extends Error {
  readonly planId: string;
  readonly expectedRevisionId: string;
  readonly currentRevisionId: string;
  constructor(planId: string, expectedRevisionId: string, currentRevisionId: string) {
    super(`Revision conflict for plan ${planId}: expected revision ${expectedRevisionId}, but current is ${currentRevisionId}`);
    this.name = 'ProposedPlanRevisionConflictError';
    this.planId = planId;
    this.expectedRevisionId = expectedRevisionId;
    this.currentRevisionId = currentRevisionId;
  }
}

export class ProposedPlanPersistenceError extends Error {
  constructor(message: string, cause?: unknown) {
    super(`Proposed plan persistence error: ${message}`);
    this.name = 'ProposedPlanPersistenceError';
    if (cause) {
      // eslint-disable-next-line no-constructor-return
      Object.setPrototypeOf(this, new.target.prototype);
    }
  }
}

export class CorruptProposedPlanStoreError extends ProposedPlanPersistenceError {
  constructor(filePath: string, cause?: unknown) {
    super(`Corrupt proposed plan store at ${filePath}`, cause);
    this.name = 'CorruptProposedPlanStoreError';
  }
}