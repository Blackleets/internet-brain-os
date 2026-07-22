const ACTIVE_STATUSES = new Set(['queued', 'running']);
const DEFAULT_KERNEL_BASE_URL = 'http://127.0.0.1:4000';
const missionState = document.querySelector('#mission-state');
let stopped = false;

void tick();
window.addEventListener('pagehide', () => { stopped = true; }, { once: true });

async function tick() {
  if (stopped) return;
  try {
    const stored = await chrome.storage.local.get(['kernelBaseUrl', 'kernelApiToken']);
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
  if (!missionState || !mission || !ACTIVE_STATUSES.has(mission.status)) return;
  const startedAt = mission.claimedAt ?? mission.createdAt;
  const startedMs = Date.parse(startedAt);
  if (!Number.isFinite(startedMs)) return;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
  const elapsed = formatDuration(elapsedSeconds);
  const phase = mission.status === 'queued' ? 'Starting Hermes' : 'Hermes is researching';
  const next = `${phase} · ${elapsed} elapsed · live`;
  if (missionState.textContent !== next) missionState.textContent = next;
  missionState.dataset.status = mission.status;
  missionState.title = 'Efesto checks the local mission state every second. Deep research may take several minutes.';
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}

function schedule(delay) {
  if (!stopped) setTimeout(tick, delay);
}
