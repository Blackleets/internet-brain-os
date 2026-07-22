import './unsupported-page-guard.js';
import { DEFAULT_KERNEL_BASE_URL, getKernelStatus, listAgentMissions, listGoals, startGoalResearch } from './local-transport.js';
import { deriveEfestoOrbState, resolveForgePowerIntent, selectNextGoal, shouldCreateMission } from './efesto-orb-state.js';

const ACTIVE_STATUSES = new Set(['queued', 'running']);
const POLL_MS = 2000;
const powerButton = document.querySelector('#forge-power');
const powerLabel = document.querySelector('#forge-power-label');
const powerDetail = document.querySelector('#forge-power-detail');
const livingForge = document.querySelector('#living-forge');
const orbMeta = document.querySelector('#forge-orb-meta');
const orbSummary = document.querySelector('#forge-orb-summary');
const obsidianReceipt = document.querySelector('#forge-obsidian-receipt');
let timer;
let cycleRunning = false;
let currentOrbState = 'idle';

void initializePower();

powerButton?.addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['efestoForgeEnabled']);
  const intent = resolveForgePowerIntent({ enabled: Boolean(stored.efestoForgeEnabled), state: currentOrbState });
  await chrome.storage.local.set({ efestoForgeEnabled: intent.enabled });
  renderOrb(
    deriveEfestoOrbState({ enabled: intent.enabled, kernel: 'ready', services: {}, mission: undefined }),
    intent.retry ? 'Retrying the failed mission safely.' : intent.enabled ? 'Starting the forge' : 'Active work will finish safely.',
  );
  if (intent.enabled) void runCycle();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void runCycle();
});

window.addEventListener('pagehide', () => clearTimeout(timer), { once: true });

async function initializePower() {
  const stored = await chrome.storage.local.get(['efestoForgeEnabled']);
  const enabled = Boolean(stored.efestoForgeEnabled);
  renderOrb(deriveEfestoOrbState({ enabled, kernel: enabled ? 'ready' : 'offline', services: {} }), enabled ? 'Recovering forge state…' : 'Press once to start forging.');
  if (enabled) void runCycle();
}

async function runCycle() {
  if (cycleRunning) return;
  cycleRunning = true;
  clearTimeout(timer);
  try {
    const stored = await chrome.storage.local.get([
      'efestoForgeEnabled',
      'efestoForgeCompletedGoals',
      'kernelApiToken',
      'kernelBaseUrl',
    ]);
    const options = {
      baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL,
      apiToken: stored.kernelApiToken,
    };
    const enabled = Boolean(stored.efestoForgeEnabled);
    if (!enabled) {
      renderOrb(deriveEfestoOrbState({ enabled: false, kernel: 'ready', services: {} }), 'Paused. Press once to start forging.');
      return;
    }
    if (!stored.kernelApiToken) {
      renderOrb(deriveEfestoOrbState({ enabled: false, kernel: 'ready', services: {} }), 'Connect the private Kernel before starting.');
      await chrome.storage.local.set({ efestoForgeEnabled: false });
      return;
    }

    const readiness = await getKernelStatus({ baseUrl: options.baseUrl });
    const services = { hermes: readiness.hermes, obsidian: readiness.obsidian };
    const [missions, goals] = await Promise.all([listAgentMissions(options), listGoals(options)]);
    const latest = newest(missions);
    renderOrb(deriveEfestoOrbState({ enabled, kernel: 'ready', services, mission: latest }));

    if (latest && ACTIVE_STATUSES.has(latest.status)) {
      schedule();
      return;
    }

    const completed = new Set(Array.isArray(stored.efestoForgeCompletedGoals) ? stored.efestoForgeCompletedGoals : []);
    if (latest?.status === 'completed' && latest.goalId) completed.add(latest.goalId);
    await chrome.storage.local.set({ efestoForgeCompletedGoals: [...completed] });

    if (!shouldCreateMission({ enabled, kernel: 'ready', goals, completedGoalIds: [...completed], mission: latest })) {
      if (!selectNextGoal(goals, [...completed])) {
        await chrome.storage.local.set({ efestoForgeEnabled: false, efestoForgeCompletedGoals: [] });
        renderOrb(deriveEfestoOrbState({ enabled: false, kernel: 'ready', services, mission: latest }), goals.length ? 'Forge cycle complete. Results are in Finds and Obsidian receipts when confirmed.' : 'Create a Goal, then start the forge.');
      }
      return;
    }

    const nextGoal = selectNextGoal(goals, [...completed]);
    renderOrb(deriveEfestoOrbState({ enabled, kernel: 'ready', services, mission: undefined }), `Starting the forge for ${nextGoal.title}`);
    const startedMission = await startGoalResearch(nextGoal.id, options);
    renderOrb(deriveEfestoOrbState({ enabled, kernel: 'ready', services, mission: startedMission }));
    schedule(1000);
  } catch (error) {
    renderOrb({ state: 'failed', label: 'Forge needs attention', detail: error instanceof Error ? error.message : 'Unable to read Kernel state.', active: false, smithActive: false, action: 'Retry safely', enabled: true });
    schedule(5000);
  } finally {
    cycleRunning = false;
  }
}

function schedule(delay = POLL_MS) {
  clearTimeout(timer);
  timer = setTimeout(() => void runCycle(), delay);
}

function renderOrb(view, overrideDetail) {
  if (!powerButton || !powerLabel || !powerDetail) return;
  currentOrbState = view.state;
  const enabled = Boolean(view.enabled);
  powerButton.dataset.enabled = enabled ? 'true' : 'false';
  powerButton.dataset.state = view.state;
  powerButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  powerButton.setAttribute('aria-label', enabled ? 'Pause Efesto after current work' : view.action ?? 'Start Efesto');
  powerLabel.textContent = view.action && view.state === 'failed' ? view.action : view.label;
  powerDetail.textContent = overrideDetail ?? view.detail;
  livingForge?.setAttribute('data-activity', view.smithActive ? (view.state === 'verifying' ? 'verifying' : 'working') : view.state === 'completed' ? 'success' : view.state === 'failed' ? 'error' : 'idle');
  setText('#forge-orb-elapsed', view.elapsedLabel ?? 'No active mission');
  setText('#forge-orb-heartbeat', view.heartbeatLabel ?? 'No heartbeat yet');
  if (orbMeta) orbMeta.hidden = !view.active;
  if (orbSummary) orbSummary.hidden = view.state !== 'completed';
  if (view.summary) {
    setText('#forge-summary-findings', String(view.summary.findingsReceived));
    setText('#forge-summary-evidence', String(view.summary.evidenceCreated));
    setText('#forge-summary-opportunities', String(view.summary.opportunitiesForged));
    setText('#forge-summary-obsidian', String(view.summary.obsidianNotesWritten));
  }
  renderObsidianReceipt(view.state === 'completed' ? view.obsidianReceipt : undefined);
}

function renderObsidianReceipt(receipt) {
  if (!obsidianReceipt) return;
  obsidianReceipt.hidden = !receipt;
  if (!receipt) return;
  const status = receipt.status ?? 'not_confirmed';
  const copy = {
    synced: `synced · ${receipt.notesWritten ?? 0} notes`,
    partial: `partial · ${receipt.notesWritten ?? 0} notes`,
    failed: 'failed',
    not_configured: 'not configured',
    not_confirmed: 'not confirmed',
  }[status] ?? status;
  setText('#forge-obsidian-state', `Obsidian ${copy}`);
  setText('#forge-obsidian-detail', receipt.lastSyncedAt ? `${receipt.vaultRelativePath ?? 'vault path unavailable'} · ${new Date(receipt.lastSyncedAt).toLocaleString()}` : 'The Kernel has not returned a sync receipt.');
}

function newest(missions = []) { return [...missions].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0]; }
function setText(selector, value) { const node = document.querySelector(selector); if (node) node.textContent = value; }
