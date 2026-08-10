import { describe, expect, it } from 'vitest';
import { forgeActivityForGoalSurface, presentGoalSurface, presentGoalSurfaces } from './goal-surface-presentation.js';

function surface(workState = 'investigating', overrides = {}) {
  return {
    schemaVersion: 'efesto.goal-surface.v1',
    sourceOfTruth: 'kernel',
    observedAt: '2026-08-09T18:40:00.000Z',
    goal: {
      id: 'goal:1', title: 'Find a drill', status: 'active', revision: 1,
      createdAt: '2026-08-09T18:00:00.000Z', updatedAt: '2026-08-09T18:10:00.000Z',
      compatibility: 'legacy_radar',
      policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' },
      ...overrides.goal,
    },
    mission: workState === null ? undefined : {
      id: 'mission:1', status: workState === 'failed' ? 'failed' : workState === 'completed' || workState === 'forged' ? 'completed' : 'running',
      executionPhase: ['investigating', 'verifying', 'forged', 'failed'].includes(workState) ? workState : undefined,
      workState,
      createdAt: '2026-08-09T18:11:00.000Z', updatedAt: '2026-08-09T18:39:00.000Z', attempt: 1,
      ...overrides.mission,
    },
  };
}

describe('extension Shared Goal Truth presentation', () => {
  it('preserves Kernel ordering and focuses the first projected Goal', () => {
    const first = surface('verifying');
    const second = { ...surface('queued'), goal: { ...surface('queued').goal, id: 'goal:2', title: 'Second goal' } };
    const view = presentGoalSurfaces([first, second]);
    expect(view.goalCount).toBe(2);
    expect(view.focused).toMatchObject({ id: 'goal:1', workState: 'verifying', workLabel: 'Efesto is verifying findings' });
    expect(view.goals.map((goal) => goal.id)).toEqual(['goal:1', 'goal:2']);
  });

  it('labels legacy compatibility explicitly instead of presenting it as Universal Goal v2', () => {
    expect(presentGoalSurface(surface('idle'))).toMatchObject({
      compatibility: 'legacy_radar', compatibilityLabel: 'Legacy radar · Kernel compatibility', autonomyLabel: 'Assisted',
    });
  });

  it('allows a new research request only when the active Goal has no active persisted work', () => {
    expect(presentGoalSurface(surface(null)).canResearch).toBe(true);
    expect(presentGoalSurface(surface('completed')).canResearch).toBe(true);
    expect(presentGoalSurface(surface('verifying')).canResearch).toBe(false);
    expect(presentGoalSurface(surface('queued')).canResearch).toBe(false);
  });

  it('renders automatic claim denial as visibly blocked and never offers another automatic research click', () => {
    const blocked = surface('failed', {
      mission: {
        status: 'queued',
        executionPhase: 'queued',
        blockedReason: 'runtime_read_only_unverified',
        limitation: 'Automatic read-only continuation blocked: runtime_read_only_unverified',
      },
    });
    expect(presentGoalSurface(blocked)).toMatchObject({
      workState: 'failed',
      workLabel: 'Automatic research blocked safely',
      blockedReason: 'runtime_read_only_unverified',
      canResearch: false,
    });
    expect(forgeActivityForGoalSurface(blocked)).toEqual({
      label: 'Automatic research blocked',
      detail: 'Hermes was not run because its safe search-only runtime could not be certified.',
      tone: 'error',
    });
  });

  it('allows explicit re-authorization when the block is caused by missing or stale authorization', () => {
    const blocked = surface('failed', {
      mission: {
        status: 'queued',
        executionPhase: 'queued',
        blockedReason: 'authorization_revision_mismatch',
      },
    });
    expect(presentGoalSurface(blocked)).toMatchObject({
      workState: 'failed',
      blockedReason: 'authorization_revision_mismatch',
      canResearch: true,
    });
  });

  it('never upgrades completed into forged success without persisted forged work state', () => {
    expect(forgeActivityForGoalSurface(surface('completed'))).toEqual({
      label: 'The forge is ready', detail: 'Create a Goal or analyze a public page.', tone: 'idle',
    });
    expect(forgeActivityForGoalSurface(surface('forged', { mission: { findCount: 2 } }))).toEqual({
      label: 'A useful lead was forged', detail: '2 opportunities passed local checks and were forged.', tone: 'success',
    });
  });

  it.each([
    ['waiting_for_agent', 'Hermes not available', 'error'],
    ['queued', 'Preparing the tools', 'queued'],
    ['investigating', 'Forging new intelligence', 'working'],
    ['verifying', 'Inspecting the piece', 'verifying'],
    ['failed', 'Inspecting a broken piece', 'error'],
  ])('maps persisted %s to truthful forge activity', (workState, label, tone) => {
    expect(forgeActivityForGoalSurface(surface(workState))).toMatchObject({ label, tone });
  });
});
