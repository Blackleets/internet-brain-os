import { describe, expect, it } from 'vitest';
import * as kernel from '../../packages/kernel/src/index.ts';
import { AutomaticMissionClaimGate } from './automatic-mission-claim-gate.mjs';

function receipt(goalId, revision = 1) {
  return {
    schemaVersion: 'efesto.goal-execution-authorization.v1',
    id: `goal-auth:${goalId}:${revision}`,
    goalId,
    goalRevision: revision,
    decision: 'approved',
    scope: 'read_only_continuation',
    actorType: 'interactive_user',
    decidedBy: 'dashboard-ui',
    decidedAt: '2026-08-09T20:45:00.000Z',
  };
}

function legacyGoal(overrides = {}) {
  return {
    id: 'goal:legacy', title: 'Find public offers', categories: ['offer'], keywords: ['tool'], priority: 2,
    status: 'active', createdAt: '2026-08-09T20:00:00.000Z', ...overrides,
  };
}

function universalGoal(overrides = {}) {
  return {
    contractVersion: 2,
    id: 'goal:v2', title: 'Find public jobs', desiredOutcome: 'Find jobs', successCriteria: ['One useful result'],
    constraints: { allowedCapabilities: ['public_web_research'], allowedDataScopes: ['public_web'] },
    allowedCapabilities: ['public_web_research'], forbiddenCapabilities: [], allowedDataScopes: ['public_web'],
    forbiddenActions: ['purchase', 'submit', 'login', 'outreach', 'download', 'destructive'],
    autonomyLevel: 'assisted', approvalConfig: { policy: 'none' }, notificationConfig: { policy: 'none' }, memoryConfig: { policy: 'none' },
    terminationConditions: [], createdRevision: { revision: 1 }, currentRevision: { revision: 3 }, status: 'active',
    createdAt: '2026-08-09T20:00:00.000Z', updatedAt: '2026-08-09T20:30:00.000Z', ...overrides,
  };
}

describe('automatic Mission claim gate', () => {
  const gate = new AutomaticMissionClaimGate({ kernel });

  it('authorizes legacy discovery only through the real web.search capability gate', async () => {
    await expect(gate.evaluate(legacyGoal(), {
      id: 'mission:1', goalId: 'goal:legacy', authorization: receipt('goal:legacy', 1),
    })).resolves.toEqual({
      allowed: true,
      policyVersion: 'efesto.automatic-read-only-policy.v1',
      authorizationRef: 'goal-auth:goal:legacy:1',
      capabilityIds: ['web.search'],
    });
  });

  it('maps UniversalGoal public_web_research compatibility onto registered web.search', async () => {
    await expect(gate.evaluate(universalGoal(), {
      id: 'mission:2', goalId: 'goal:v2', authorization: receipt('goal:v2', 3),
    })).resolves.toMatchObject({ allowed: true, capabilityIds: ['web.search'] });
  });

  it('fails closed when UniversalGoal does not authorize web.search', async () => {
    const goal = universalGoal({
      allowedCapabilities: ['web.read'],
      constraints: { allowedCapabilities: ['web.read'], allowedDataScopes: ['public_web'] },
    });
    await expect(gate.evaluate(goal, {
      id: 'mission:3', goalId: 'goal:v2', authorization: receipt('goal:v2', 3),
    })).resolves.toEqual({ allowed: false, reason: 'capability_denied:web.search' });
  });

  it('rejects stale revision, inactive Goal, Mission mismatch, and missing receipt', async () => {
    await expect(gate.evaluate(universalGoal(), {
      id: 'mission:4', goalId: 'goal:v2', authorization: receipt('goal:v2', 2),
    })).resolves.toEqual({ allowed: false, reason: 'authorization_revision_mismatch' });
    await expect(gate.evaluate(universalGoal({ status: 'paused' }), {
      id: 'mission:5', goalId: 'goal:v2', authorization: receipt('goal:v2', 3),
    })).resolves.toEqual({ allowed: false, reason: 'goal_not_active' });
    await expect(gate.evaluate(universalGoal(), {
      id: 'mission:6', goalId: 'goal:other', authorization: receipt('goal:other', 3),
    })).resolves.toEqual({ allowed: false, reason: 'mission_goal_mismatch' });
    await expect(gate.evaluate(legacyGoal(), { id: 'mission:7', goalId: 'goal:legacy' }))
      .resolves.toEqual({ allowed: false, reason: 'authorization_missing' });
  });

  it('stops a second search while candidates are awaiting verification', async () => {
    await expect(gate.evaluate(legacyGoal(), {
      id: 'mission:8', goalId: 'goal:legacy', authorization: receipt('goal:legacy', 1), searchCandidates: [{ url: 'https://example.com' }],
    })).resolves.toEqual({ allowed: false, reason: 'verification_pending' });
  });
});
