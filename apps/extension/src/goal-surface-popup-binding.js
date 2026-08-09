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

export function applyGoalTruthPresentation(doc, presentation) {
  const focused = presentation?.focused;
  const activity = presentation?.forgeActivity ?? {
    label: 'The forge is ready', detail: 'Create a Goal or analyze a public page.', tone: 'idle',
  };
  const status = focused?.workState ?? 'idle';
  const text = focused?.workLabel ?? 'No research mission yet';
  setText(doc.querySelector?.('#mission-state'), text);
  setDataset(doc.querySelector?.('#mission-state'), 'status', status);
  setDataset(doc.querySelector?.('#living-forge'), 'activity', activity.tone);
  setText(doc.querySelector?.('#forge-activity-label'), activity.label);
  setText(doc.querySelector?.('#forge-activity-detail'), activity.detail);
  return { status, text };
}

function applyUnavailable(doc, detail) {
  const status = 'idle';
  const text = 'Shared Goal Truth unavailable';
  setText(doc.querySelector?.('#mission-state'), text);
  setDataset(doc.querySelector?.('#mission-state'), 'status', status);
  setDataset(doc.querySelector?.('#living-forge'), 'activity', 'error');
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
