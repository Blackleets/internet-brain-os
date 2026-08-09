import { syncGoalSurfacePopup } from './goal-surface-popup-binding.js';

const ACTIVE_MISSION_STATUSES = new Set(['waiting_for_agent', 'queued', 'running', 'investigating', 'verifying']);
const doc = globalThis.document;
const missionState = doc?.querySelector?.('#mission-state');
const goals = doc?.querySelector?.('#goal-list');
let lastSharedState;
let syncQueued = false;
let syncInFlight = false;

export function applyResearchButtonState(button, status, allowed = true) {
  const active = ACTIVE_MISSION_STATUSES.has(status);
  const failed = status === 'failed';
  const available = allowed !== false;
  const nextText = active ? 'Researching…' : !available ? 'Unavailable' : failed ? 'Retry safely' : 'Research';
  const nextBusy = active ? 'true' : 'false';
  const nextDisabled = active || !available;
  if (button.disabled !== nextDisabled) button.disabled = nextDisabled;
  if (button.textContent !== nextText) button.textContent = nextText;
  if (button.getAttribute('aria-busy') !== nextBusy) button.setAttribute('aria-busy', nextBusy);
}

function syncResearchActions() {
  const fallbackStatus = missionState?.dataset.status ?? 'idle';
  for (const button of doc?.querySelectorAll?.('.goal-research') ?? []) {
    const workState = button.dataset.workState ?? fallbackStatus;
    const allowed = button.dataset.researchAllowed === undefined ? true : button.dataset.researchAllowed === 'true';
    applyResearchButtonState(button, workState, allowed);
  }
}

async function syncSharedTruth() {
  if (syncInFlight) return;
  syncInFlight = true;
  try {
    lastSharedState = await syncGoalSurfacePopup();
    syncResearchActions();
  } finally {
    syncInFlight = false;
  }
}

function scheduleSharedTruthSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    void syncSharedTruth();
  });
}

function legacyStateOverrodeSharedTruth() {
  if (!lastSharedState || !missionState) return false;
  return missionState.dataset.status !== lastSharedState.status || missionState.textContent !== lastSharedState.text;
}

const stateObserver = typeof MutationObserver === 'function' && missionState
  ? new MutationObserver(() => {
      syncResearchActions();
      if (!syncInFlight && legacyStateOverrodeSharedTruth()) scheduleSharedTruthSync();
    })
  : undefined;
if (stateObserver) stateObserver.observe(missionState, { attributes: true, attributeFilter: ['data-status'], childList: true });

const goalObserver = typeof MutationObserver === 'function' && goals
  ? new MutationObserver(syncResearchActions)
  : undefined;
if (goalObserver) goalObserver.observe(goals, { childList: true });

doc?.addEventListener?.('visibilitychange', () => {
  if (doc.visibilityState === 'visible') scheduleSharedTruthSync();
});

globalThis.chrome?.storage?.onChanged?.addListener?.((changes, area) => {
  if (area === 'local' && (changes.kernelApiToken || changes.kernelBaseUrl)) scheduleSharedTruthSync();
});

syncResearchActions();
scheduleSharedTruthSync();
