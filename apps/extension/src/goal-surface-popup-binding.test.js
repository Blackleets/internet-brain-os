// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { applyGoalTruthPresentation, syncGoalSurfacePopup } from './goal-surface-popup-binding.js';

function mount() {
  document.body.innerHTML = `
    <span id="mission-state" data-status="idle"></span>
    <section id="living-forge" data-activity="idle"></section>
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
      focused: { workState: 'verifying', workLabel: 'Efesto is verifying findings' },
      forgeActivity: { label: 'Inspecting the piece', detail: 'Efesto is validating returned findings inside the local Kernel.', tone: 'verifying' },
    });
    expect(result).toEqual({ status: 'verifying', text: 'Efesto is verifying findings' });
    expect(document.querySelector('#mission-state')?.textContent).toBe('Efesto is verifying findings');
    expect(document.querySelector('#mission-state')?.dataset.status).toBe('verifying');
    expect(document.querySelector('#living-forge')?.dataset.activity).toBe('verifying');
    expect(document.querySelector('#forge-activity-label')?.textContent).toBe('Inspecting the piece');
  });

  it('does not present completed as forged without persisted forged work state', () => {
    mount();
    applyGoalTruthPresentation(document, {
      focused: { workState: 'completed', workLabel: 'Research completed' },
      forgeActivity: { label: 'The forge is ready', detail: 'Create a Goal or analyze a public page.', tone: 'idle' },
    });
    expect(document.querySelector('#living-forge')?.dataset.activity).toBe('idle');
    expect(document.querySelector('#forge-activity-label')?.textContent).toBe('The forge is ready');
  });

  it('reads through the authenticated Shared Goal Truth transport and never needs a writer', async () => {
    mount();
    const storage = { get: vi.fn(async () => ({ kernelBaseUrl: 'http://127.0.0.1:4000', kernelApiToken: 'x'.repeat(40) })) };
    const listGoalSurfacesFn = vi.fn(async () => [surface]);
    await expect(syncGoalSurfacePopup({ document, storage, listGoalSurfacesFn })).resolves.toEqual({ status: 'verifying', text: 'Efesto is verifying findings' });
    expect(listGoalSurfacesFn).toHaveBeenCalledWith({ baseUrl: 'http://127.0.0.1:4000', apiToken: 'x'.repeat(40) });
    expect(document.querySelector('#living-forge')?.dataset.activity).toBe('verifying');
  });

  it('fails visually closed when Goal truth cannot be read instead of retaining legacy activity', async () => {
    mount();
    document.querySelector('#mission-state').textContent = '3 opportunities found';
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
