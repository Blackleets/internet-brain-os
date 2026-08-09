import { describe, expect, it } from 'vitest';
import {
  GOAL_SURFACE_SCHEMA_VERSION,
  GoalSurfaceSnapshotInputError,
  buildGoalSurfaceSnapshot,
  buildGoalSurfaceSnapshots,
  type GoalSurfaceMissionRecord,
} from './goal-surface-snapshot';
import type { LegacyGoal, UniversalGoal } from './goal-contract';

const observedAt = '2026-08-09T16:00:00.000Z';

function universalGoal(overrides: Partial<UniversalGoal> = {}): UniversalGoal {
  return {
    contractVersion: 2,
    id: 'goal:universal',
    title: 'Find a quality drill',
    desiredOutcome: 'Find a quality drill inside budget',
    successCriteria: ['At least one verified fit'],
    constraints: {},
    allowedCapabilities: ['web.search', 'web.read'],
    forbiddenCapabilities: [],
    allowedDataScopes: ['public_web'],
    forbiddenActions: ['purchase'],
    autonomyLevel: 'semi_autonomous',
    approvalConfig: { policy: 'checkpoints' },
    notificationConfig: { policy: 'on_completion' },
    memoryConfig: { policy: 'learn_preferences' },
    terminationConditions: [{ type: 'success_criteria_met' }],
    createdRevision: { revision: 1, changedAt: '2026-08-09T14:00:00.000Z', changedBy: 'user', diff: {} },
    currentRevision: { revision: 3, changedAt: '2026-08-09T15:00:00.000Z', changedBy: 'user', diff: {} },
    status: 'active',
    createdAt: '2026-08-09T14:00:00.000Z',
    updatedAt: '2026-08-09T15:00:00.000Z',
    ...overrides,
  };
}

function legacyGoal(overrides: Partial<LegacyGoal> = {}): LegacyGoal {
  return {
    id: 'goal:legacy',
    title: 'Find freelance work',
    categories: ['job'],
    keywords: ['remote'],
    priority: 3,
    status: 'active',
    createdAt: '2026-08-09T13:00:00.000Z',
    ...overrides,
  };
}

function mission(overrides: Partial<GoalSurfaceMissionRecord> = {}): GoalSurfaceMissionRecord {
  return {
    id: 'mission:1',
    goalId: 'goal:universal',
    status: 'queued',
    createdAt: '2026-08-09T15:10:00.000Z',
    ...overrides,
  };
}

describe('GoalSurfaceSnapshot v1', () => {
  it('projects canonical Goal truth without collapsing Mission execution into Goal lifecycle', () => {
    const snapshot = buildGoalSurfaceSnapshot({
      goal: universalGoal(),
      observedAt,
      missions: [mission({ status: 'running', executionPhase: 'investigating', attempt: 2 })],
    });

    expect(snapshot).toEqual({
      schemaVersion: GOAL_SURFACE_SCHEMA_VERSION,
      sourceOfTruth: 'kernel',
      observedAt,
      goal: {
        id: 'goal:universal',
        title: 'Find a quality drill',
        status: 'active',
        revision: 3,
        createdAt: '2026-08-09T14:00:00.000Z',
        updatedAt: '2026-08-09T15:00:00.000Z',
        compatibility: 'universal_v2',
        policySummary: {
          autonomyLevel: 'semi_autonomous',
          approvalPolicy: 'checkpoints',
          source: 'goal_contract',
        },
      },
      mission: {
        id: 'mission:1',
        status: 'running',
        executionPhase: 'investigating',
        workState: 'investigating',
        createdAt: '2026-08-09T15:10:00.000Z',
        updatedAt: '2026-08-09T15:10:00.000Z',
        attempt: 2,
      },
    });
    expect(snapshot.goal.status).toBe('active');
    expect(snapshot.mission?.workState).toBe('investigating');
  });

  it('marks the radar Goal as an explicit compatibility representation', () => {
    const snapshot = buildGoalSurfaceSnapshot({ goal: legacyGoal(), observedAt });
    expect(snapshot.goal).toMatchObject({
      id: 'goal:legacy',
      status: 'active',
      revision: 1,
      compatibility: 'legacy_radar',
      policySummary: {
        autonomyLevel: 'assisted',
        approvalPolicy: 'none',
        source: 'legacy_compatibility',
      },
    });
    expect(snapshot.mission).toBeUndefined();
  });

  it('selects active work before terminal history and never mixes another Goal mission', () => {
    const snapshot = buildGoalSurfaceSnapshot({
      goal: universalGoal(),
      observedAt,
      missions: [
        mission({ id: 'mission:completed', status: 'completed', executionPhase: 'forged', completedAt: '2026-08-09T15:58:00.000Z' }),
        mission({ id: 'mission:queued', status: 'queued', createdAt: '2026-08-09T15:20:00.000Z' }),
        mission({ id: 'mission:other', goalId: 'goal:other', status: 'running', executionPhase: 'investigating', createdAt: '2026-08-09T15:59:00.000Z' }),
      ],
    });
    expect(snapshot.mission?.id).toBe('mission:queued');
    expect(snapshot.mission?.workState).toBe('queued');
  });

  it('exposes the latest completed Mission outcome and Find count when no active work exists', () => {
    const snapshot = buildGoalSurfaceSnapshot({
      goal: universalGoal({ status: 'completed' }),
      observedAt,
      missions: [mission({
        status: 'completed',
        executionPhase: 'forged',
        verifyingAt: '2026-08-09T15:40:00.000Z',
        completedAt: '2026-08-09T15:45:00.000Z',
        resultSummary: { opportunitiesPromoted: 4 },
      })],
    });
    expect(snapshot.goal.status).toBe('completed');
    expect(snapshot.mission).toMatchObject({
      status: 'completed',
      executionPhase: 'forged',
      workState: 'forged',
      updatedAt: '2026-08-09T15:45:00.000Z',
      findCount: 4,
    });
  });

  it('sorts Goal surfaces deterministically without rewriting lifecycle state', () => {
    const snapshots = buildGoalSurfaceSnapshots({
      observedAt,
      goals: [
        legacyGoal({ id: 'goal:completed', status: 'completed', createdAt: '2026-08-09T15:30:00.000Z' }),
        universalGoal({ id: 'goal:paused', status: 'paused', updatedAt: '2026-08-09T15:50:00.000Z' }),
        universalGoal({ id: 'goal:active', status: 'active', updatedAt: '2026-08-09T15:10:00.000Z' }),
      ],
      missions: [],
    });
    expect(snapshots.map((snapshot) => [snapshot.goal.id, snapshot.goal.status])).toEqual([
      ['goal:active', 'active'],
      ['goal:paused', 'paused'],
      ['goal:completed', 'completed'],
    ]);
  });

  it('fails closed on malformed Goal or Mission runtime input', () => {
    expect(() => buildGoalSurfaceSnapshot(null as never)).toThrowError(GoalSurfaceSnapshotInputError);
    expect(() => buildGoalSurfaceSnapshots({ goals: null, missions: [], observedAt } as never))
      .toThrowError(GoalSurfaceSnapshotInputError);
    expect(() => buildGoalSurfaceSnapshot({
      goal: { ...legacyGoal(), id: 42 } as never,
      observedAt,
    })).toThrowError(GoalSurfaceSnapshotInputError);
    expect(() => buildGoalSurfaceSnapshot({
      goal: universalGoal(),
      observedAt,
      missions: [{ ...mission(), status: 'invented' } as never],
    })).toThrowError(GoalSurfaceSnapshotInputError);
    expect(() => buildGoalSurfaceSnapshot({
      goal: universalGoal(),
      observedAt,
      missions: [{ ...mission(), resultSummary: { opportunitiesPromoted: -1 } }],
    })).toThrowError(GoalSurfaceSnapshotInputError);
  });
});
