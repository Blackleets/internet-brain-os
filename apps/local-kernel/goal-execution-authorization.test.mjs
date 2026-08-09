import { describe, expect, it } from 'vitest';
import {
  GOAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION,
  createGoalExecutionAuthorizationReceipt,
  currentGoalRevision,
} from './goal-execution-authorization.mjs';

const interactiveUser = { actorType: 'interactive_user', decidedBy: 'dashboard-ui' };

describe('Goal execution authorization receipt', () => {
  it('creates a deterministic interactive-user read-only receipt for a legacy Goal', () => {
    const goal = { id: 'goal:legacy', status: 'active', title: 'Find useful work' };
    const at = new Date('2026-08-09T20:00:00.000Z');
    const first = createGoalExecutionAuthorizationReceipt(goal, at, interactiveUser);
    const replay = createGoalExecutionAuthorizationReceipt(goal, at, interactiveUser);
    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      schemaVersion: GOAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION,
      goalId: 'goal:legacy',
      goalRevision: 1,
      decision: 'approved',
      scope: 'read_only_continuation',
      actorType: 'interactive_user',
      decidedBy: 'dashboard-ui',
      decidedAt: '2026-08-09T20:00:00.000Z',
    });
    expect(first.id).toMatch(/^goal-auth:[a-f0-9]{64}$/);
  });

  it('binds UniversalGoal authorization to its exact current revision', () => {
    const goal = { id: 'goal:v2', contractVersion: 2, currentRevision: { revision: 7 } };
    expect(currentGoalRevision(goal)).toBe(7);
    expect(createGoalExecutionAuthorizationReceipt(goal, '2026-08-09T20:01:00.000Z', interactiveUser)).toMatchObject({ goalRevision: 7 });
  });

  it('supports an explicitly trusted founder actor without accepting agent/system actors', () => {
    expect(createGoalExecutionAuthorizationReceipt({ id: 'goal:1' }, '2026-08-09T20:02:00.000Z', { actorType: 'founder', decidedBy: 'founder:local' }))
      .toMatchObject({ actorType: 'founder', decidedBy: 'founder:local' });
    expect(() => createGoalExecutionAuthorizationReceipt({ id: 'goal:1' }, '2026-08-09T20:02:00.000Z', { actorType: 'agent', decidedBy: 'hermes' }))
      .toThrow('not trusted');
    expect(() => createGoalExecutionAuthorizationReceipt({ id: 'goal:1' }, '2026-08-09T20:02:00.000Z', { actorType: 'system', decidedBy: 'scheduler' }))
      .toThrow('not trusted');
  });

  it('fails closed on missing identity, actor, invalid revision, or invalid time', () => {
    expect(() => createGoalExecutionAuthorizationReceipt({}, new Date(), interactiveUser)).toThrow('Goal id');
    expect(() => createGoalExecutionAuthorizationReceipt({ id: 'goal:1' }, new Date(), undefined)).toThrow('actor');
    expect(() => currentGoalRevision({ id: 'goal:v2', contractVersion: 2, currentRevision: { revision: 0 } })).toThrow('revision');
    expect(() => createGoalExecutionAuthorizationReceipt({ id: 'goal:1' }, 'not-a-date', interactiveUser)).toThrow('time');
  });
});
