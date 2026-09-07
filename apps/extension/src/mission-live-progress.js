const ACTIVE_STATUSES = new Set(['queued', 'running']);
const DEFAULT_KERNEL_BASE_URL = 'http://127.0.0.1:4000';

/**
 * Fail-close live #mission-state elapsed copy.
 * Kernel verifying (status still running + executionPhase/workState verifying) is NOT
 * live Hermes research — do not keep branding Shared Goal Truth as
 * "Hermes is researching · live" every second while loadAgentHub / syncGoalSurfacePopup
 * own the verifying label.
 */
export function presentMissionLiveProgress(mission, now = Date.now()) {
  if (!mission || !ACTIVE_STATUSES.has(mission.status)) return null;
  if (mission.executionPhase === 'verifying' || mission.workState === 'verifying') {
    return {
      text: 'Efesto is verifying findings',
      status: 'verifying',
      title: 'The local Kernel is validating Evidence. Hermes research is no longer the live phase.',
    };
  }
  const startedAt = mission.status === 'queued' ? mission.createdAt : (mission.claimedAt ?? mission.createdAt);
  const startedMs = Date.parse(startedAt);
  if (!Number.isFinite(startedMs)) return null;
  const elapsedSeconds = Math.max(0, Math.floor((now - startedMs) / 1000));
  const elapsed = formatDuration(elapsedSeconds);
  const phase = mission.status === 'queued' ? 'Queued for Hermes' : 'Hermes is researching';
  const suffix = mission.status === 'queued' ? 'waiting' : 'live';
  return {
    text: `${phase} · ${elapsed} elapsed · ${suffix}`,
    status: mission.status,
    title: mission.status === 'queued'
      ? 'The mission is authorized and queued; no research lease is active yet.'
      : 'Efesto checks the local mission state every second. Deep research may take several minutes.',
  };
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}

function bootMountedLiveProgress() {
  const doc = globalThis.document;
  const missionState = doc?.querySelector?.('#mission-state');
  if (!missionState || !globalThis.chrome?.storage?.local) return;

  let stopped = false;

  void tick();
  globalThis.window?.addEventListener?.('pagehide', () => { stopped = true; }, { once: true });

  async function tick() {
    if (stopped) return;
    try {
      const stored = await globalThis.chrome.storage.local.get(['kernelBaseUrl', 'kernelApiToken']);
      if (!stored.kernelApiToken) return schedule(5000);
      const response = await fetch(`${stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL}/api/agent-missions`, {
        headers: { 'x-hephaestus-token': stored.kernelApiToken },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      const latest = Array.isArray(payload.missions)
        ? [...payload.missions].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0]
        : undefined;
      render(latest);
    } catch {
      // The primary popup refresher owns error reporting. This helper remains silent.
    }
    schedule(1000);
  }

  function render(mission) {
    const view = presentMissionLiveProgress(mission);
    if (!view) return;
    if (missionState.textContent !== view.text) missionState.textContent = view.text;
    if (missionState.dataset.status !== view.status) missionState.dataset.status = view.status;
    if (missionState.title !== view.title) missionState.title = view.title;
  }

  function schedule(delay) {
    if (!stopped) setTimeout(tick, delay);
  }
}

bootMountedLiveProgress();
