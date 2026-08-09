import { syncGoalSurfacePopup } from './goal-surface-popup-binding.js';

const ACTIVE_MISSION_STATUSES = new Set(['waiting_for_agent', 'queued', 'running', 'investigating', 'verifying']);
const doc = globalThis.document;
const missionState = doc?.querySelector?.('#mission-state');
const goals = doc?.querySelector?.('#goal-list');
let lastSharedState;
let syncQueued = false;
let syncInFlight = false;

export function applyResearchButtonState(button, status) {
  const active = ACTIVE_MISSION_STATUSES.has(status);
  const failed = status === 'failed';
  const nextText = active ? 'Researching…' : failed ? 'Retry safely' : 'Research';
  const nextBusy = active ? 'true' : 'false';
  if (button.disabled !== active) button.disabled = active;
  if (button.textContent !== nextText) button.textContent = nextText;
  if (button.getAttribute('aria-busy') !== nextBusy) button.setAttribute('aria-busy', nextBusy);
}

function syncResearchActions() {
  const status = missionState?.dataset.status ?? 'idle';
  for (const button of doc?.querySelectorAll?.('.goal-research') ?? []) applyResearchButtonState(button, status);
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
stateObserver?.observe(missionState, { attributes: true, attributeFilter: ['data-status'], childList: true, characterData: true, subtree: true });

const goalObserver = typeof MutationObserver === 'function' && goals
  ? new MutationObserver(syncResearchActions)
  : undefined;
goalObserver?.observe(goals, { childList: true });

doc?.addEventListener?.('visibilitychange', () => {
  if (doc.visibilityState === 'visible') scheduleSharedTruthSync();
});

globalThis.chrome?.storage?.onChanged?.addListener?.((changes, area) => {
  if (area === 'local' && (changes.kernelApiToken || changes.kernelBaseUrl)) scheduleSharedTruthSync();
});

syncResearchActions();
scheduleSharedTruthSync();
