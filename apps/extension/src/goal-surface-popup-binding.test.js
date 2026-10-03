// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { applyGoalTruthPresentation, syncGoalSurfacePopup } from './goal-surface-popup-binding.js';

function mount() {
  document.body.innerHTML = `
    <span id="mission-state" data-status="idle"></span>
    <section id="living-forge" data-activity="idle"><span class="live-badge"><i></i><span class="live-badge-label">EN VIVO</span></span></section>
    <h2 id="forge-activity-label"></h2>
    <p id="forge-activity-detail"></p>`;
}

const surface = {
  schemaVersion: 'efesto.goal-surface.v1', sourceOfTruth: 'kernel', observedAt: '2026-08-09T18:50:00.000Z',
  goal: {
    id: 'goal:1', title: 'Find a drill', status: 'active', revision: 1,
    createdAt: '2026-08-09T18:00:00.000Z', updatedAt: '2026-08-09T18:10:00.000Z', compatibility: 'legacy_radar',
    policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' },
  },
  mission: {
    id: 'mission:1', status: 'running', executionPhase: 'verifying', workState: 'verifying',
    createdAt: '2026-08-09T18:11:00.000Z', updatedAt: '2026-08-09T18:49:00.000Z', attempt: 1,
  },
};

describe('Shared Goal Truth popup binding', () => {
  it('binds persisted verifying state to mission copy and Living Forge', () => {
    mount();
    const result = applyGoalTruthPresentation(document, {
      focused: { workState: 'verifying', workLabel: 'Efesto is verifying Evidence' },
      forgeActivity: { label: 'Inspecting the piece', detail: 'Efesto is validating returned material inside the local Kernel. Finds still require Kernel SUPPORT.', tone: 'verifying' },
    });
    expect(result).toEqual({ status: 'verifying', text: 'Efesto is verifying Evidence' });
    expect(document.querySelector('#mission-state')?.textContent).toBe('Efesto is verifying Evidence');
    expect(document.querySelector('#mission-state')?.textContent).not.toMatch(/finding/i);
    expect(document.querySelector('#mission-state')?.dataset.status).toBe('verifying');
    expect(document.querySelector('#living-forge')?.dataset.activity).toBe('verifying');
    expect(document.querySelector('.live-badge-label')?.textContent).toBe('EN VIVO');
    expect(document.querySelector('#forge-activity-label')?.textContent).toBe('Inspecting the piece');
  });

  it('does not present completed as forged without persisted forged work state', () => {
    mount();
    const result = applyGoalTruthPresentation(document, {
      focused: { workState: 'completed', workLabel: 'Research ended without Evidence' },
      forgeActivity: {
        label: 'Research ended without Evidence',
        detail: 'The bounded attempt finished. No Kernel-sealed Evidence was forged.',
        tone: 'idle',
      },
    });
    // completed-without-forge must not keep green Completado (data-status=completed)
    // and Living Forge must not keep forge-is-ready Forja lista beside that honesty.
    expect(result).toEqual({ status: 'research_completed', text: 'Research ended without Evidence' });
    expect(document.querySelector('#mission-state')?.dataset.status).toBe('research_completed');
    expect(document.querySelector('#mission-state')?.dataset.status).not.toBe('completed');
    expect(document.querySelector('#mission-state')?.textContent).toBe('Research ended without Evidence');
    expect(document.querySelector('#living-forge')?.dataset.activity).toBe('idle');
    expect(document.querySelector('.live-badge-label')?.textContent).toBe('LISTA');
    expect(document.querySelector('.live-badge-label')?.textContent).not.toMatch(/EN VIVO/i);
    expect(document.querySelector('#forge-activity-label')?.textContent).toBe('Research ended without Evidence');
    expect(document.querySelector('#forge-activity-label')?.textContent).not.toMatch(/forge is ready/i);
  });

  it('reads through the authenticated Shared Goal Truth transport and never needs a writer', async () => {
    mount();
    const storage = { get: vi.fn(async () => ({ kernelBaseUrl: 'http://127.0.0.1:4000', kernelApiToken: 'x'.repeat(40) })) };
    const listGoalSurfacesFn = vi.fn(async () => [surface]);
    await expect(syncGoalSurfacePopup({ document, storage, listGoalSurfacesFn })).resolves.toEqual({ status: 'verifying', text: 'Efesto is verifying Evidence' });
    expect(document.querySelector('#mission-state')?.textContent).not.toMatch(/finding/i);
    expect(listGoalSurfacesFn).toHaveBeenCalledWith({ baseUrl: 'http://127.0.0.1:4000', apiToken: 'x'.repeat(40) });
    expect(document.querySelector('#living-forge')?.dataset.activity).toBe('verifying');
  });


  it('gates #mission-state chrome on GoalSurface findCount — forged without SUPPORT is research_completed', () => {
    mount();
    const zero = applyGoalTruthPresentation(document, {
      focused: { workState: 'forged', workLabel: 'Research completed', findCount: 0 },
      forgeActivity: { label: 'Research completed', detail: 'No Find passed Kernel SUPPORT.', tone: 'idle' },
    });
    expect(zero).toEqual({ status: 'research_completed', text: 'Research completed' });
    expect(document.querySelector('#mission-state')?.dataset.status).toBe('research_completed');
    expect(document.querySelector('#mission-state')?.dataset.status).not.toBe('forged');
    expect(document.querySelector('#living-forge')?.dataset.activity).toBe('idle');

    const missing = applyGoalTruthPresentation(document, {
      focused: { workState: 'forged', workLabel: 'Research completed' },
      forgeActivity: { label: 'Research completed', detail: 'No Find passed Kernel SUPPORT.', tone: 'idle' },
    });
    expect(missing.status).toBe('research_completed');

    const support = applyGoalTruthPresentation(document, {
      focused: { workState: 'forged', workLabel: '1 Find passed Kernel SUPPORT', findCount: 1 },
      forgeActivity: { label: 'A Kernel SUPPORT Find was forged', detail: '1 Find passed Kernel SUPPORT and were forged.', tone: 'success' },
    });
    expect(support).toEqual({ status: 'completed', text: '1 Find passed Kernel SUPPORT' });
    expect(document.querySelector('#mission-state')?.dataset.status).toBe('completed');
    expect(document.querySelector('#living-forge')?.dataset.activity).toBe('success');
  });

  it('fails visually closed when Goal truth cannot be read instead of retaining legacy activity', async () => {
    mount();
    document.querySelector('#mission-state').textContent = 'stale mission-state';
    document.querySelector('#mission-state').dataset.status = 'completed';
    document.querySelector('#living-forge').dataset.activity = 'success';
    const storage = { get: vi.fn(async () => ({ kernelApiToken: 'x'.repeat(40) })) };
    const listGoalSurfacesFn = vi.fn(async () => { throw new Error('offline'); });
    await syncGoalSurfacePopup({ document, storage, listGoalSurfacesFn });
    expect(document.querySelector('#mission-state')?.textContent).toBe('Shared Goal Truth unavailable');
    expect(document.querySelector('#mission-state')?.dataset.status).toBe('idle');
    expect(document.querySelector('#living-forge')?.dataset.activity).toBe('error');
    expect(document.querySelector('#forge-activity-label')?.textContent).toBe('Goal truth unavailable');
  });
});
