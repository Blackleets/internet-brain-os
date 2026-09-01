// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderGoalSurfaceList } from './goal-surface-goal-list.js';

function surface(id, workState, status = 'active') {
  return {
    schemaVersion: 'efesto.goal-surface.v1', sourceOfTruth: 'kernel', observedAt: '2026-08-09T19:00:00.000Z',
    goal: {
      id, title: `Goal ${id}`, status, revision: 1,
      createdAt: '2026-08-09T18:00:00.000Z', updatedAt: '2026-08-09T18:10:00.000Z', compatibility: 'legacy_radar',
      policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' },
    },
    mission: workState === 'idle' ? undefined : {
      id: `mission:${id}`, status: workState === 'failed' ? 'failed' : workState === 'completed' || workState === 'forged' ? 'completed' : 'running',
      executionPhase: ['investigating', 'verifying', 'forged', 'failed'].includes(workState) ? workState : undefined,
      workState, createdAt: '2026-08-09T18:11:00.000Z', updatedAt: '2026-08-09T18:59:00.000Z', attempt: 1,
    },
  };
}

beforeEach(() => { document.body.innerHTML = '<div id="goals"></div>'; });

describe('Shared Goal Truth Goal-list renderer', () => {
  it('preserves Kernel ordering and marks every rendered chip as Shared Goal Truth', () => {
    const list = document.querySelector('#goals');
    renderGoalSurfaceList({ document, list, surfaces: [surface('goal:2', 'queued'), surface('goal:1', 'idle')] });
    expect([...list.querySelectorAll('.goal-chip')].map((node) => node.dataset.goalId)).toEqual(['goal:2', 'goal:1']);
    expect([...list.querySelectorAll('.goal-chip')].every((node) => node.dataset.goalSource === 'shared-truth')).toBe(true);
    expect(list.textContent).toContain('Legacy radar · Kernel compatibility');
  });

  it('encodes per-Goal work state and makes the idle click visibly the authorization act', () => {
    const list = document.querySelector('#goals');
    renderGoalSurfaceList({ document, list, surfaces: [surface('goal:active', 'verifying'), surface('goal:idle', 'idle')] });
    const buttons = [...list.querySelectorAll('.goal-research')];
    expect(buttons[0]).toMatchObject({ disabled: true, textContent: 'Researching…' });
    expect(buttons[0].dataset).toMatchObject({ workState: 'verifying', researchAllowed: 'false' });
    expect(buttons[1]).toMatchObject({ disabled: false, textContent: 'Authorize research' });
    expect(buttons[1].dataset).toMatchObject({ workState: 'idle', researchAllowed: 'true' });
  });

  it('keeps paused Goals unavailable even when they have no active Mission', () => {
    const list = document.querySelector('#goals');
    renderGoalSurfaceList({ document, list, surfaces: [surface('goal:paused', 'idle', 'paused')] });
    const button = list.querySelector('.goal-research');
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Unavailable');
    expect(button.dataset.researchAllowed).toBe('false');
  });

  it('delegates an explicitly clicked authorization action without owning the writer', () => {
    const list = document.querySelector('#goals');
    const onResearch = vi.fn();
    renderGoalSurfaceList({ document, list, surfaces: [surface('goal:1', 'idle')], onResearch });
    list.querySelector('.goal-research').click();
    expect(onResearch).toHaveBeenCalledTimes(1);
    expect(onResearch.mock.calls[0][0]).toMatchObject({ id: 'goal:1', canResearch: true });
  });

  it('does not present completed-without-forged as Completado on Goal chips', () => {
    const list = document.querySelector('#goals');
    renderGoalSurfaceList({ document, list, surfaces: [surface('goal:1', 'completed')] });
    expect(list.textContent).not.toMatch(/completado|forged|Forge complete|Research completed/i);
    expect(list.querySelector('.goal-research').dataset.workState).toBe('completed');
  });
});
