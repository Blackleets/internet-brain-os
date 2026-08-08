import { describe, expect, test } from 'vitest';
import type { UniversalGoal } from '../goal/goal-contract';
import { GOAL_CONTRACT_VERSION } from '../goal/goal-contract';
import type { MissionTaskId } from '../mission/mission-types';
import { ProposedPlanManager, type ProposedPlanStore } from '../proposed-plan/proposed-plan-manager';
import type { ProposedPlan } from '../proposed-plan/proposed-plan-contract';
import { CapabilityGatedProposedPlanService } from './capability-gated-proposed-plan-service';
import { CapabilityRegistry } from './capability-registry';
import { CapabilityNotFoundError, CapabilityUnavailableError } from './capability-errors';

function goal(): UniversalGoal {
  const now = '2026-08-08T14:00:00.000Z';
  return {
    contractVersion: GOAL_CONTRACT_VERSION,
    id: 'goal:research',
    title: 'Find a drill',
    desiredOutcome: 'Find a suitable drill',
    successCriteria: ['Candidate verified'],
    constraints: { allowedCapabilities: ['web.search'], allowedDataScopes: ['public_web'] },
    allowedCapabilities: ['web.search'],
    forbiddenCapabilities: [],
    allowedDataScopes: ['public_web'],
    forbiddenActions: ['purchase'],
    autonomyLevel: 'assisted',
    approvalConfig: { policy: 'none' },
    notificationConfig: { policy: 'none' },
    memoryConfig: { policy: 'none' },
    terminationConditions: [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    createdRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
    currentRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
  };
}

function store(): ProposedPlanStore {
  let state: ProposedPlan[] = [];
  return {
    transaction: async (callback) => callback(state),
    write: async (plans) => { state = [...plans]; },
  };
}

const input = {
  id: 'plan:research',
  goalId: 'goal:research',
  planSummary: 'Search public sources',
  planTasks: [{
    id: 'task:search' as MissionTaskId,
    title: 'Search',
    objective: 'Search public web',
    status: 'pending' as const,
    dependsOn: [],
    evidenceRequirements: [],
  }],
  requestedCapabilities: [{ capabilityId: 'web.search', version: '1' }],
  expectedEvidence: [],
  approvalCheckpoints: [],
  completionConditions: [{ description: 'Search complete', dependsOn: ['task:search' as MissionTaskId] }],
  changedBy: 'system',
};

describe('CapabilityGatedProposedPlanService', () => {
  test('creates a plan only when the Registry and Goal both authorize the capability', async () => {
    const currentGoal = goal();
    const manager = new ProposedPlanManager(store(), async () => currentGoal, { createId: () => 'plan:research' });
    const registry = new CapabilityRegistry([{
      id: 'web.search', version: '1', provider: 'browser-research', riskLevel: 'r0_observe', consentPolicy: 'none',
      allowedDataScopes: ['public_web'], credentialScopes: [], health: 'available',
    }]);
    const service = new CapabilityGatedProposedPlanService(manager, registry, async () => currentGoal);

    await expect(service.create(input)).resolves.toMatchObject({ id: 'plan:research', requestedCapabilities: [{ capabilityId: 'web.search', version: '1' }] });
  });

  test('fails closed before persistence when the requested capability is not registered', async () => {
    const currentGoal = goal();
    const manager = new ProposedPlanManager(store(), async () => currentGoal);
    const service = new CapabilityGatedProposedPlanService(manager, new CapabilityRegistry(), async () => currentGoal);

    await expect(service.create(input)).rejects.toThrow(CapabilityNotFoundError);
    await expect(manager.getProposedPlan('plan:research')).resolves.toBeNull();
  });

  test('fails closed before persistence when the capability becomes unavailable', async () => {
    const currentGoal = goal();
    const manager = new ProposedPlanManager(store(), async () => currentGoal);
    const registry = new CapabilityRegistry([{
      id: 'web.search', version: '1', provider: 'browser-research', riskLevel: 'r0_observe', consentPolicy: 'none',
      allowedDataScopes: ['public_web'], credentialScopes: [], health: 'unavailable',
    }]);
    const service = new CapabilityGatedProposedPlanService(manager, registry, async () => currentGoal);

    await expect(service.create(input)).rejects.toThrow(CapabilityUnavailableError);
    await expect(manager.getProposedPlan('plan:research')).resolves.toBeNull();
  });
});
