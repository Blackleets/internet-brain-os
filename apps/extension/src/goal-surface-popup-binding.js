import { applyLivingForgeActivity } from './forge-activity.js';
import { presentGoalSurfaces } from './goal-surface-presentation.js';
import { listGoalSurfaces } from './goal-surface-transport.js';
import { DEFAULT_KERNEL_BASE_URL } from './local-transport.js';

export async function syncGoalSurfacePopup(options = {}) {
  const doc = options.document ?? globalThis.document;
  const storage = options.storage ?? globalThis.chrome?.storage?.local;
  const list = options.listGoalSurfacesFn ?? listGoalSurfaces;
  if (!doc || !storage) return { status: 'idle', text: 'Shared Goal Truth unavailable' };

  const stored = await storage.get(['kernelBaseUrl', 'kernelApiToken']);
  if (!stored.kernelApiToken) return applyUnavailable(doc, 'Pair the private Kernel to load Goal truth.');

  try {
    const surfaces = await list({
      baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL,
      apiToken: stored.kernelApiToken,
    });
    return applyGoalTruthPresentation(doc, presentGoalSurfaces(surfaces));
  } catch {
    return applyUnavailable(doc, 'Reconnect the private Kernel to restore Goal truth.');
  }
}

/**
 * Fail-close #mission-state chrome for Shared Goal Truth sync.
 * Raw workState=forged must not overwrite loadAgentHub's SUPPORT-gated
 * completed / research_completed — one-click-mission-ui MutationObserver
 * re-applies Shared Truth whenever legacy diverges, so ungated forged
 * permanently undoes Agent Hub Completado honesty.
 * forged + findCount>0 → completed (green); zero/missing SUPPORT → research_completed.
 * workState=completed (Kernel completed-without-forge) must not keep data-status=completed
 * green Completado — mission-card / Living Forge already use research_completed / idle.
 */
function chromeStatusForGoalSurfaceWork(workState, findCount) {
  if (workState === 'forged') {
    const found = Number.isSafeInteger(findCount) ? findCount : undefined;
    return found !== undefined && found > 0 ? 'completed' : 'research_completed';
  }
  if (workState === 'completed') return 'research_completed';
  return workState ?? 'idle';
}

export function applyGoalTruthPresentation(doc, presentation) {
  const focused = presentation?.focused;
  const activity = presentation?.forgeActivity ?? {
    label: 'The forge is ready', detail: 'Create a Goal or analyze a public page.', tone: 'idle',
  };
  const status = chromeStatusForGoalSurfaceWork(focused?.workState, focused?.findCount);
  const text = focused?.workLabel ?? 'No research mission yet';
  setText(doc.querySelector?.('#mission-state'), text);
  setDataset(doc.querySelector?.('#mission-state'), 'status', status);
  applyLivingForgeActivity(doc.querySelector?.('#living-forge'), activity.tone);
  setText(doc.querySelector?.('#forge-activity-label'), activity.label);
  setText(doc.querySelector?.('#forge-activity-detail'), activity.detail);
  return { status, text };
}

function applyUnavailable(doc, detail) {
  const status = 'idle';
  const text = 'Shared Goal Truth unavailable';
  setText(doc.querySelector?.('#mission-state'), text);
  setDataset(doc.querySelector?.('#mission-state'), 'status', status);
  applyLivingForgeActivity(doc.querySelector?.('#living-forge'), 'error');
  setText(doc.querySelector?.('#forge-activity-label'), 'Goal truth unavailable');
  setText(doc.querySelector?.('#forge-activity-detail'), detail);
  return { status, text };
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function setDataset(node, key, value) {
  if (node?.dataset && node.dataset[key] !== value) node.dataset[key] = value;
}
