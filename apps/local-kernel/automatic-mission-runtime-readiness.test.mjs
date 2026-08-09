import { describe, expect, it, vi } from 'vitest';
import * as kernel from '../../packages/kernel/src/index.ts';
import { AutomaticMissionClaimGate } from './automatic-mission-claim-gate.mjs';

const goal = {
  id: 'goal:runtime', title: 'Find public offers', categories: ['offer'], keywords: ['tool'], priority: 2,
  status: 'active', createdAt: '2026-08-09T21:00:00.000Z',
};
const authorization = {
  schemaVersion: 'efesto.goal-execution-authorization.v1', id: 'goal-auth:runtime',
  goalId: goal.id, goalRevision: 1, decision: 'approved', scope: 'read_only_continuation',
  actorType: 'interactive_user', decidedBy: 'dashboard-ui', decidedAt: '2026-08-09T21:01:00.000Z',
};
const mission = { id: 'mission:runtime', goalId: goal.id, authorization };

describe('automatic Mission runtime readiness gate', () => {
  it('fails closed before Kernel loading when the read-only runtime is not certified', async () => {
    const loadKernel = vi.fn(async () => kernel);
    const gate = new AutomaticMissionClaimGate({
      loadKernel,
      enforceRuntimeReadiness: true,
      readOnlyRuntimeReady: () => false,
    });

    await expect(gate.evaluate(goal, mission)).resolves.toEqual({
      allowed: false,
      reason: 'runtime_read_only_unverified',
    });
    expect(loadKernel).not.toHaveBeenCalled();
  });

  it('continues through CapabilityRegistry and policy only after runtime certification', async () => {
    const loadKernel = vi.fn(async () => kernel);
    const gate = new AutomaticMissionClaimGate({
      loadKernel,
      enforceRuntimeReadiness: true,
      readOnlyRuntimeReady: () => true,
    });

    await expect(gate.evaluate(goal, mission)).resolves.toMatchObject({
      allowed: true,
      capabilityIds: ['web.search'],
      authorizationRef: authorization.id,
    });
    expect(loadKernel).toHaveBeenCalledTimes(1);
  });
});
