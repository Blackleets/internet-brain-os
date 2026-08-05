import { describe, expect, test, vi } from 'vitest';
import { ProposedPlanManager } from './proposed-plan-manager';
import { PROPOSED_PLAN_CONTRACT_VERSION } from './proposed-plan-contract';
import { UniversalGoal, GOAL_CONTRACT_VERSION } from '../goal/goal-contract';
import { MissionTask, MissionTaskId } from '../mission/mission-types';
import { GoalNotFoundForPlanError, ProposedPlanCapabilityDeniedError, ProposedPlanDependencyError } from './proposed-plan-errors';

// Helper to create a minimal valid UniversalGoal for testing
function createTestGoal(overrides: Partial<UniversalGoal> = {}): UniversalGoal {
  const now = new Date().toISOString();
  const base: UniversalGoal = {
    contractVersion: GOAL_CONTRACT_VERSION,
    id: 'goal:test-id',
    title: 'Test Goal',
    description: 'A test goal',
    desiredOutcome: 'Something good',
    successCriteria: ['Criteria met'],
    constraints: {
      maxBudget: 1000,
      maxDurationMs: 3600000,
      maxMissions: 1,
      maxConcurrentMissions: 1,
      allowedDomains: ['example.com'],
      forbiddenDomains: ['evil.com'],
      allowedCapabilities: ['public_web_research'],
      forbiddenCapabilities: ['purchase'],
      allowedDataScopes: ['public_web'],
      forbiddenDataScopes: ['private'],
      forbiddenActions: ['purchase', 'submit'],
    },
    deadline: undefined,
    budget: undefined,
    frequency: 'once',
    allowedCapabilities: ['public_web_research'],
    forbiddenCapabilities: ['purchase'],
    allowedDataScopes: ['public_web'],
    forbiddenActions: ['purchase', 'submit'],
    autonomyLevel: 'assisted',
    approvalConfig: { policy: 'none' },
    notificationConfig: { policy: 'none' },
    memoryConfig: { policy: 'none' },
    terminationConditions: [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    createdRevision: {
      revision: 1,
      changedAt: now,
      changedBy: 'system',
      diff: {},
    },
    currentRevision: {
      revision: 1,
      changedAt: now,
      changedBy: 'system',
      diff: {},
    },
  };
  return { ...base, ...overrides };
}

// Helper to create a valid MissionTask for testing
function createTestTask(overrides: Partial<MissionTask> = {}): MissionTask {
  const base: MissionTask = {
    id: 'task:test-id' as MissionTaskId,
    title: 'Test Task',
    objective: 'Do something',
    status: 'pending',
    dependsOn: [] as MissionTaskId[],
    evidenceRequirements: [{ key: 'evidence1', description: 'Some evidence', required: true }],
  };
  return { ...base, ...overrides } as MissionTask;
}

describe('ProposedPlanManager', () => {
  // Mock store
  const createMockStore = () => ({
    transaction: vi.fn((callback: (plans: any[]) => Promise<any>) => callback([])),
    write: vi.fn(),
  });

  test('should create a proposed plan', async () => {
    const store = createMockStore();
    const getGoal = vi.fn();
    const manager = new ProposedPlanManager(store as any, getGoal);

    const goalId = 'goal:123';
    const mockGoal = createTestGoal({ id: goalId });

    getGoal.mockResolvedValue(mockGoal);

    const input = {
      goalId,
      planSummary: 'A test plan',
      planTasks: [createTestTask()],
      requestedCapabilities: [{ capabilityId: 'public_web_research' }],
      expectedEvidence: [{ key: 'evidence1', description: 'Some evidence' }],
      approvalCheckpoints: [],
      completionConditions: [
        { description: 'Task 1 completed', dependsOn: ['task:1' as MissionTaskId] },
      ],
    };

    const plan = await manager.createProposedPlan(input);

    expect(plan).toBeDefined();
    expect(plan.id).toBeDefined();
    expect(plan.goalId).toBe(goalId);
    expect(plan.planSummary).toBe('A test plan');
    expect(plan.planTasks.length).toBe(1);
    expect(plan.requestedCapabilities.length).toBe(1);
    expect(plan.expectedEvidence.length).toBe(1);
    expect(plan.approvalCheckpoints.length).toBe(0);
    expect(plan.completionConditions.length).toBe(1);
    expect(plan.revisionNumber).toBe(1);
    expect(plan.status).toBe('draft');
    expect(plan.contractVersion).toBe(PROPOSED_PLAN_CONTRACT_VERSION);
    expect(plan.createdAt).toBeDefined();
    expect(plan.updatedAt).toBeDefined();
    expect(plan.createdRevision).toBeDefined();
    expect(plan.currentRevision).toBeDefined();

    // Check that the store's transaction and write were called
    expect(store.transaction).toHaveBeenCalled();
    expect(store.write).toHaveBeenCalled();
  });

  test('should throw if goal not found', async () => {
    const store = createMockStore();
    const getGoal = vi.fn().mockResolvedValue(null);
    const manager = new ProposedPlanManager(store as any, getGoal);

    const input = {
      goalId: 'goal:999',
      planSummary: 'A test plan',
      planTasks: [],
      requestedCapabilities: [],
      expectedEvidence: [],
      approvalCheckpoints: [],
      completionConditions: [],
    };

    await expect(manager.createProposedPlan(input)).rejects.toThrow(GoalNotFoundForPlanError);
  });

  test('should throw if plan tasks exceed maxTasks', async () => {
    const store = createMockStore();
    const getGoal = vi.fn();
    const manager = new ProposedPlanManager(store as any, getGoal, 10, 2); // maxTasks = 2

    const goalId = 'goal:123';
    const mockGoal = createTestGoal({ id: goalId });

    getGoal.mockResolvedValue(mockGoal);

    const input = {
      goalId,
      planSummary: 'A test plan',
      planTasks: [
        createTestTask({ id: 'task:1' as MissionTaskId }),
        createTestTask({ id: 'task:2' as MissionTaskId }),
        createTestTask({ id: 'task:3' as MissionTaskId }), // 3 tasks > maxTasks (2)
      ],
      requestedCapabilities: [],
      expectedEvidence: [],
      approvalCheckpoints: [],
      completionConditions: [],
    };

    await expect(manager.createProposedPlan(input)).rejects.toThrow(/exceeds maximum allowed tasks/);
  });

  test('should detect cycles in task dependencies', async () => {
    const store = createMockStore();
    const getGoal = vi.fn();
    const manager = new ProposedPlanManager(store as any, getGoal);

    const goalId = 'goal:123';
    const mockGoal = createTestGoal({ id: goalId });

    getGoal.mockResolvedValue(mockGoal);

    const input = {
      goalId,
      planSummary: 'A test plan with a cycle',
      planTasks: [
        createTestTask({ id: 'task:1' as MissionTaskId, dependsOn: ['task:2' as MissionTaskId] }),
        createTestTask({ id: 'task:2' as MissionTaskId, dependsOn: ['task:1' as MissionTaskId] }),
      ],
      requestedCapabilities: [],
      expectedEvidence: [],
      approvalCheckpoints: [],
      completionConditions: [],
    };

    await expect(manager.createProposedPlan(input)).rejects.toThrow(ProposedPlanDependencyError);
  });

  test('should reject a capability not allowed by the goal', async () => {
    const store = createMockStore();
    const getGoal = vi.fn();
    const manager = new ProposedPlanManager(store as any, getGoal);

    const goalId = 'goal:123';
    const mockGoal = createTestGoal({ id: goalId });
    // Override allowedCapabilities: ['allowed_cap'];
    mockGoal.allowedCapabilities = ['allowed_cap'];
    getGoal.mockResolvedValue(mockGoal);

    const input = {
      goalId,
      planSummary: 'A test plan',
      planTasks: [],
      requestedCapabilities: [{ capabilityId: 'not_allowed_cap' }],
      expectedEvidence: [],
      approvalCheckpoints: [],
      completionConditions: [],
    };

    await expect(manager.createProposedPlan(input)).rejects.toThrow(ProposedPlanCapabilityDeniedError);
  });

  test('should allow a capability that is allowed by the goal', async () => {
    const store = createMockStore();
    const getGoal = vi.fn();
    const manager = new ProposedPlanManager(store as any, getGoal);

    const goalId = 'goal:123';
    const mockGoal = createTestGoal({ id: goalId });
    // Ensure the capability is allowed
    mockGoal.allowedCapabilities = ['allowed_cap'];
    mockGoal.constraints.allowedCapabilities = ['allowed_cap'];
    getGoal.mockResolvedValue(mockGoal);

    const input = {
      goalId,
      planSummary: 'A test plan',
      planTasks: [],
      requestedCapabilities: [{ capabilityId: 'allowed_cap' }],
      expectedEvidence: [],
      approvalCheckpoints: [],
      completionConditions: [],
    };

    await expect(manager.createProposedPlan(input)).resolves.toBeDefined();
  });

  test('should list proposed plans for a goal', async () => {
    const store = createMockStore();
    const getGoal = vi.fn();
    const manager = new ProposedPlanManager(store as any, getGoal);

    const goalId = 'goal:123';
    const mockGoal = createTestGoal({ id: goalId });
    getGoal.mockResolvedValue(mockGoal);

    // Mock the store's transaction to return some existing plans when listing.
    store.transaction.mockImplementationOnce((callback: (plans: any[]) => Promise<any>) => {
      return callback([
        {
          id: 'plan:1',
          goalId,
          revisionNumber: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          planSummary: 'Plan 1',
          planTasks: [],
          requestedCapabilities: [],
          expectedEvidence: [],
          approvalCheckpoints: [],
          completionConditions: [],
          status: 'draft',
          contractVersion: PROPOSED_PLAN_CONTRACT_VERSION,
          createdRevision: {
            revision: 1,
            changedAt: new Date().toISOString(),
            changedBy: 'system',
            diff: {},
          },
          currentRevision: {
            revision: 1,
            changedAt: new Date().toISOString(),
            changedBy: 'system',
            diff: {},
          },
        },
        {
          id: 'plan:2',
          goalId,
          revisionNumber: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          planSummary: 'Plan 2',
          planTasks: [],
          requestedCapabilities: [],
          expectedEvidence: [],
          approvalCheckpoints: [],
          completionConditions: [],
          status: 'draft',
          contractVersion: PROPOSED_PLAN_CONTRACT_VERSION,
          createdRevision: {
            revision: 1,
            changedAt: new Date().toISOString(),
            changedBy: 'system',
            diff: {},
          },
          currentRevision: {
            revision: 1,
            changedAt: new Date().toISOString(),
            changedBy: 'system',
            diff: {},
          },
        },
      ]);
    });

    const plans = await manager.listProposedPlansForGoal(goalId);

    expect(plans).toHaveLength(2);
    expect(plans[0].goalId).toBe(goalId);
    expect(plans[1].goalId).toBe(goalId);
    // The manager sorts by revisionNumber descending, then by updatedAt descending.
    // Since we set revisionNumber 2 after revisionNumber 1, and same timestamps, the one with revisionNumber 2 should be first.
    expect(plans[0].revisionNumber).toBe(2);
    expect(plans[1].revisionNumber).toBe(1);
  });
});