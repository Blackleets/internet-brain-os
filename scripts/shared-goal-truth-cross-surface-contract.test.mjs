import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const text = (path) => readFile(new URL(path, root), 'utf8');

describe('Shared Goal Truth cross-surface freeze', () => {
  it('keeps the responsive Control Center on Kernel-owned Goal surfaces', async () => {
    const shell = await text('apps/dashboard/components/efesto-product-shell.tsx');
    const client = await text('apps/dashboard/lib/kernel/goal-surfaces.ts');
    expect(client).toContain("GOAL_SURFACE_SCHEMA_VERSION = 'efesto.goal-surface.v1'");
    expect(client).toContain("sourceOfTruth: 'kernel'");
    expect(shell).toContain('loadGoalSurfaces(client)');
    expect(shell).toContain('brainPhaseFromWorkState(mission?.workState)');
    expect(shell).toContain("if (workState === 'forged') return 'forged'");
  });

  it('keeps extension Goal chips and Living Forge on the same read-only projection', async () => {
    const popup = await text('apps/extension/src/popup.js');
    const binder = await text('apps/extension/src/goal-surface-popup-binding.js');
    const transport = await text('apps/extension/src/goal-surface-transport.js');
    expect(popup).toContain('listGoalSurfaces(');
    expect(popup).toContain('renderGoalSurfaceList({');
    expect(popup).not.toContain('listGoals');
    expect(binder).toContain('syncGoalSurfacePopup');
    expect(transport).toContain("readSharedGoalTruth('/api/goal-surfaces'");
    expect(transport).toContain("method: 'GET'");
    expect(transport).not.toContain("method: 'POST'");
    const presentation = await text('apps/extension/src/goal-surface-presentation.js');
    expect(presentation).not.toContain("completed: 'Research completed'");
  });

  it('preserves explicit Research authorization and per-Goal projected controls', async () => {
    const popup = await text('apps/extension/src/popup.js');
    const renderer = await text('apps/extension/src/goal-surface-goal-list.js');
    const missionUi = await text('apps/extension/src/one-click-mission-ui.js');
    expect(popup).toContain("globalThis.confirm('Authorize Hermes to research this Goal once?')");
    expect(popup).toContain('startGoalResearch(goal.id');
    expect(renderer).toContain("research.dataset.workState = goal.workState");
    expect(renderer).toContain("research.dataset.researchAllowed = String(goal.canResearch)");
    expect(missionUi).toContain('button.dataset.workState');
    expect(missionUi).toContain('button.dataset.researchAllowed');
  });

  it('keeps failures truthful and continuous motion removable', async () => {
    const binder = await text('apps/extension/src/goal-surface-popup-binding.js');
    const extensionCss = await text('apps/extension/src/central-forge-power.css');
    const dashboardAcceptance = await text('apps/dashboard/e2e/overview.spec.ts');
    expect(binder).toContain("text = 'Shared Goal Truth unavailable'");
    expect(binder).toContain("setDataset(doc.querySelector?.('#living-forge'), 'activity', 'error')");
    expect(extensionCss).toContain('@media (prefers-reduced-motion:reduce)');
    expect(extensionCss).toContain('animation:none!important');
    expect(dashboardAcceptance).toContain("viewport: { width: 390, height: 844 }");
    expect(dashboardAcceptance).toContain("page.emulateMedia({ reducedMotion: 'reduce' })");
  });

  it('keeps dashboard StatePill Completado lookalike off completed-without-forged', async () => {
    const views = await text('apps/dashboard/components/efesto-product-views.tsx');
    expect(views).toContain("['ready', 'forged', 'available', 'new']");
    expect(views).not.toContain("['ready', 'completed', 'forged', 'available', 'new']");
  });

  it('keeps mobile-width support separate from remote Kernel authority', async () => {
    const designContract = await text('docs/product-design/goal-first-cross-surface-g0.md');
    expect(designContract).toContain('390×844');
    expect(designContract).toContain('does not imply');
    expect(designContract).toContain('remote');
  });
});
