import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const popupUrl = new URL('./popup.js', import.meta.url);
const missionUiUrl = new URL('./one-click-mission-ui.js', import.meta.url);

describe('Shared Goal Truth popup wiring', () => {
  it('uses Shared Goal Truth rather than the legacy Goal list for Goal chips', async () => {
    const source = await readFile(popupUrl, 'utf8');
    expect(source).toContain("import { listGoalSurfaces } from './goal-surface-transport.js';");
    expect(source).toContain("import { renderGoalSurfaceList } from './goal-surface-goal-list.js';");
    expect(source).not.toContain('listGoals');
    expect(source).toContain('surfaces = await listGoalSurfaces(');
    expect(source).toContain('renderGoalSurfaceList({');
    expect(source).toContain("unavailable.textContent = 'Shared Goal Truth unavailable. Reconnect the private Kernel.';");
  });

  it('keeps the existing explicit research authorization and writer boundary', async () => {
    const source = await readFile(popupUrl, 'utf8');
    expect(source).toContain("globalThis.confirm('Authorize Hermes to research this Goal once?')");
    expect(source).toContain('startGoalResearch(goal.id');
    expect(source).toContain('if (!goal.canResearch) return;');
    expect(source).not.toContain("'/api/goal-surfaces', { method: 'POST'");
    expect(source).not.toContain('method: \'POST\'');
  });

  it('refreshes Goal chips only when the observable Mission revision changes', async () => {
    const source = await readFile(popupUrl, 'utf8');
    const revisionBlock = source.slice(source.indexOf('if (nextRevision !== observedRevision)'), source.indexOf('observedRevision = nextRevision'));
    expect(revisionBlock).toContain('await loadGoals(stored);');
    expect(revisionBlock).toContain("if (latest?.status === 'completed') await loadOpportunities(stored);");
  });

  it('keeps the Mission ledger as legacy read-only compatibility while per-Goal controls use Shared state', async () => {
    const source = await readFile(popupUrl, 'utf8');
    const missionUi = await readFile(missionUiUrl, 'utf8');
    expect(source).toContain('listAgentMissions(');
    expect(source).toContain('renderMissionHistory(missions);');
    expect(missionUi).toContain('button.dataset.workState');
    expect(missionUi).toContain('button.dataset.researchAllowed');
    expect(missionUi).toContain('applyResearchButtonState(button, workState, allowed);');
  });
});
