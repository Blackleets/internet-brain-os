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
    expect(binder).toContain("applyLivingForgeActivity(doc.querySelector?.('#living-forge'), 'error')");
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

  it('keeps mission card Commission forged behind Kernel forged', async () => {
    const presentation = await text('apps/extension/src/mission-presentation.js');
    // STATUS_COPY.completed keeps the forged-gated constant; runtime positive path must name SUPPORT.
    expect(presentation).toContain("label: 'Commission forged'");
    expect(presentation).toContain("mission.executionPhase === 'forged' || mission.workState === 'forged'");
    expect(presentation).toContain('STATUS_COPY.completedWithoutForge');
    expect(presentation).toContain("'A Kernel SUPPORT Find was forged'");
    expect(presentation).toContain("'Kernel SUPPORT Finds were forged'");
    expect(presentation).not.toContain('label: STATUS_COPY.completed.label');
  });

  it('keeps mission timeline Kernel verification completed behind forge', async () => {
    const presentation = await text('apps/extension/src/mission-presentation.js');
    expect(presentation).toContain("addEvent(events, mission.forgedAt ?? mission.completedAt, 'Kernel verification completed'");
    expect(presentation).toContain("addEvent(events, mission.completedAt, 'Research ended without Evidence'");
    expect(presentation).toContain("const forged = typeof mission.forgedAt === 'string'");
    expect(presentation).toContain("mission.executionPhase === 'forged'");
    expect(presentation).toContain("mission.workState === 'forged'");
  });

  it('keeps overview activity Completada off completed-without-forged missions', async () => {
    const overview = await text('apps/dashboard/lib/kernel/overview.ts');
    const feed = await text('apps/dashboard/components/overview/activity-feed.tsx');
    expect(overview).toContain("return 'completed_without_forge'");
    expect(overview).toContain('missionActivityState(mission)');
    expect(overview).toContain("mission.status === 'completed'");
    expect(overview).toContain('countMissionKernelSupportedFinds(mission)');
    expect(overview).toContain("return countMissionKernelSupportedFinds(mission) > 0 ? 'forged' : 'research_completed'");
    expect(overview).not.toContain("if (mission.executionPhase === 'forged') return 'forged';");
    expect(feed).toContain("completed: 'Completada'");
    expect(feed).toContain("completed_without_forge: 'Terminada sin Evidence'");
    expect(feed).toContain("research_completed: 'Investigación terminada'");
  });

  it('keeps GoalsView StatePill Completado off completed-without-forged missions', async () => {
    const views = await text('apps/dashboard/components/efesto-product-views.tsx');
    expect(views).toContain('function missionPillState(mission: MissionSummary)');
    expect(views).toContain("return 'completed_without_forge'");
    expect(views).toContain('countMissionKernelSupportedFinds(mission)');
    expect(views).toContain("return countMissionKernelSupportedFinds(mission) > 0 ? 'forged' : 'research_completed'");
    expect(views).toContain('<StatePill state={mission ? missionPillState(mission) : goal.status} />');
    expect(views).toContain('<StatePill state={missionPillState(mission)} />');
    expect(views).not.toContain('<StatePill state={mission?.executionPhase ?? mission?.status ?? goal.status} />');
    expect(views).not.toContain('<StatePill state={mission.executionPhase ?? mission.status} />');
  });

  it('keeps Agent Hub workspace Completado off completed-without-forged missions', async () => {
    const workspaces = await text('apps/dashboard/components/workspaces/kernel-workspaces.tsx');
    expect(workspaces).toContain('function missionWorkspaceBadge');
    expect(workspaces).toContain("label: 'completed_without_forge'");
    expect(workspaces).toContain('<StatusBadge state={badge.state} label={badge.label} />');
    expect(workspaces).not.toContain("mission.status === 'completed' ? 'healthy'");
  });

  it('keeps Agent Hub workspace healthy forged off zero-SUPPORT forged missions', async () => {
    const workspaces = await text('apps/dashboard/components/workspaces/kernel-workspaces.tsx');
    expect(workspaces).toContain('countMissionKernelSupportedFinds(mission)');
    expect(workspaces).toContain("label: 'research_completed'");
    expect(workspaces).toContain("label: 'forged'");
    expect(workspaces).not.toContain("if (mission.executionPhase === 'forged') return { state: 'healthy', label: 'forged' };");
  });

  it('keeps extension #mission-progress Forged stage behind Kernel SUPPORT', async () => {
    const journey = await text('apps/extension/src/product-journey.js');
    expect(journey).toContain('forgedWithSupport');
    expect(journey).toContain('countMissionSupportedFinds(mission)');
    expect(journey).toContain('forgedWithSupport ? 3 : 2');
    expect(journey).not.toContain('completed: forged ? 3 : 2');
  });

  it('keeps mobile-width support separate from remote Kernel authority', async () => {
    const designContract = await text('docs/product-design/goal-first-cross-surface-g0.md');
    expect(designContract).toContain('390×844');
    expect(designContract).toContain('does not imply');
    expect(designContract).toContain('remote');
  });
});