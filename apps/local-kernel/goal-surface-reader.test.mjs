import { describe, expect, it, vi } from 'vitest';
import { GoalSurfaceReader, GoalSurfaceReaderError, createGoalSurfaceReader } from './goal-surface-reader.mjs';

const now = new Date('2026-08-09T16:30:00.000Z');

function snapshot(goalId = 'goal:1') {
  return {
    schemaVersion: 'efesto.goal-surface.v1',
    sourceOfTruth: 'kernel',
    observedAt: now.toISOString(),
    goal: {
      id: goalId,
      title: 'Goal',
      status: 'active',
      revision: 1,
      createdAt: '2026-08-09T16:00:00.000Z',
      updatedAt: '2026-08-09T16:00:00.000Z',
      compatibility: 'legacy_radar',
      policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' },
    },
  };
}

describe('GoalSurfaceReader', () => {
  it('reads Goals and Missions once and delegates semantics to the Kernel projector', async () => {
    const data = {
      goals: [{ id: 'goal:1', title: 'Goal' }],
      agentMissions: [{ id: 'mission:1', goalId: 'goal:1' }],
    };
    const store = {
      read: vi.fn(async () => data),
      project: vi.fn(() => { throw new Error('write path must not be used'); }),
      write: vi.fn(() => { throw new Error('write path must not be used'); }),
    };
    const buildSnapshots = vi.fn(() => [snapshot()]);
    const reader = new GoalSurfaceReader(store, buildSnapshots, { now: () => now });

    await expect(reader.list()).resolves.toEqual([snapshot()]);
    expect(store.read).toHaveBeenCalledTimes(1);
    expect(store.project).not.toHaveBeenCalled();
    expect(store.write).not.toHaveBeenCalled();
    expect(buildSnapshots).toHaveBeenCalledWith({
      goals: data.goals,
      missions: data.agentMissions,
      observedAt: now.toISOString(),
    });
  });

  it('normalizes missing arrays to empty read inputs without mutating storage', async () => {
    const store = { read: vi.fn(async () => ({})) };
    const buildSnapshots = vi.fn(() => []);
    const reader = new GoalSurfaceReader(store, buildSnapshots, { now: () => now });
    await expect(reader.list()).resolves.toEqual([]);
    expect(buildSnapshots).toHaveBeenCalledWith({ goals: [], missions: [], observedAt: now.toISOString() });
  });

  it('validates goal identity before reading and returns only the matching Kernel snapshot', async () => {
    const store = { read: vi.fn(async () => ({ goals: [], agentMissions: [] })) };
    const buildSnapshots = vi.fn(() => [snapshot('goal:1'), snapshot('goal:2')]);
    const reader = new GoalSurfaceReader(store, buildSnapshots, { now: () => now });

    await expect(reader.get(' goal:2 ')).resolves.toMatchObject({ goal: { id: 'goal:2' } });
    expect(store.read).toHaveBeenCalledTimes(1);

    store.read.mockClear();
    await expect(reader.get(42)).rejects.toThrowError(GoalSurfaceReaderError);
    expect(store.read).not.toHaveBeenCalled();
  });

  it('returns undefined for an unknown Goal without inventing state', async () => {
    const store = { read: vi.fn(async () => ({ goals: [], agentMissions: [] })) };
    const reader = new GoalSurfaceReader(store, () => [snapshot('goal:known')], { now: () => now });
    await expect(reader.get('goal:missing')).resolves.toBeUndefined();
  });

  it('production factory uses the Kernel-owned projector supplied by the built package boundary', async () => {
    const project = vi.fn(() => [snapshot()]);
    const store = { read: vi.fn(async () => ({ goals: [], agentMissions: [] })) };
    const reader = await createGoalSurfaceReader(store, {
      kernel: { buildGoalSurfaceSnapshots: project },
      now: () => now,
    });
    await reader.list();
    expect(project).toHaveBeenCalledTimes(1);
  });

  it('fails closed when its required read or Kernel projection boundary is unavailable', async () => {
    expect(() => new GoalSurfaceReader({}, () => [], { now: () => now })).toThrowError(GoalSurfaceReaderError);
    expect(() => new GoalSurfaceReader({ read: async () => ({}) }, undefined, { now: () => now })).toThrowError(GoalSurfaceReaderError);
    await expect(createGoalSurfaceReader({ read: async () => ({}) }, { kernel: {} }))
      .rejects.toThrowError(GoalSurfaceReaderError);
  });
});
