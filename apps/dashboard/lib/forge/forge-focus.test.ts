import { describe, expect, it } from 'vitest';
import type { GoalSurface, GoalSurfaceWorkState } from '../kernel/goal-surfaces';
import { focusGoalSurface } from './forge-focus';

// Kernel-shaped TEST FIXTURES (not product data).
const surface = (id: string, workState?: GoalSurfaceWorkState): GoalSurface => ({
  schemaVersion: 'efesto.goal-surface.v1', sourceOfTruth: 'kernel', observedAt: '2026-10-03T10:00:00.000Z',
  goal: { id, title: id, status: 'active', revision: 1, createdAt: '2026-10-03T09:00:00.000Z', updatedAt: '2026-10-03T09:00:00.000Z', compatibility: 'legacy_radar', policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' } },
  ...(workState ? { mission: { id: `m-${id}`, status: 'running', workState, createdAt: '2026-10-03T09:00:00.000Z', updatedAt: '2026-10-03T09:00:00.000Z' } } : {}),
});

describe('focusGoalSurface', () => {
  it('focuses the mission the agent is working on over newer queued Goals', () => {
    expect(focusGoalSurface([surface('new', 'queued'), surface('other', 'queued'), surface('busy', 'verifying'), surface('done', 'forged')])?.goal.id).toBe('busy');
    expect(focusGoalSurface([surface('new', 'queued'), surface('busy', 'investigating')])?.goal.id).toBe('busy');
  });

  it('keeps the Kernel order when nothing is in progress', () => {
    expect(focusGoalSurface([surface('new', 'queued'), surface('done', 'forged')])?.goal.id).toBe('new');
    expect(focusGoalSurface([surface('bare'), surface('done', 'forged')])?.goal.id).toBe('bare');
    expect(focusGoalSurface([])).toBeUndefined();
  });
});
