import './unsupported-page-guard.js';
import { DEFAULT_KERNEL_BASE_URL, listAgentMissions, listGoals, startGoalResearch } from './local-transport.js';

const ACTIVE_STATUSES = new Set(['waiting_for_agent', 'queued', 'running']);
const POLL_MS = 2000;
const powerButton = document.querySelector('#forge-power');
const powerLabel = document.querySelector('#forge-power-label');
const powerDetail = document.querySelector('#forge-power-detail');
const livingForge = document.querySelector('#living-forge');
let timer;
let cycleRunning = false;

void initializePower();

powerButton?.addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['efestoForgeEnabled']);
  const enabled = !Boolean(stored.efestoForgeEnabled);
  await chrome.storage.local.set({ efestoForgeEnabled: enabled });
  renderPower(enabled, enabled ? 'Starting the forge…' : 'Paused. Active work will finish safely.');
  if (enabled) void runCycle();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void runCycle();
});

window.addEventListener('pagehide', () => clearTimeout(timer), { once: true });

async function initializePower() {
  const stored = await chrome.storage.local.get(['efestoForgeEnabled']);
  const enabled = Boolean(stored.efestoForgeEnabled);
  renderPower(enabled, enabled ? 'Efesto is watching your authorized Goals.' : 'Press once to start forging.');
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
    if (!stored.efestoForgeEnabled) {
      renderPower(false, 'Paused. Press once to start forging.');
      return;
    }
    if (!stored.kernelApiToken) {
      renderPower(false, 'Connect the private Kernel before starting.');
      await chrome.storage.local.set({ efestoForgeEnabled: false });
      return;
    }

    const options = {
      baseUrl: stored.kernelBaseUrl ?? DEFAULT_KERNEL_BASE_URL,
      apiToken: stored.kernelApiToken,
    };
    const [missions, goals] = await Promise.all([listAgentMissions(options), listGoals(options)]);
    const latest = [...missions].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0];

    if (latest && ACTIVE_STATUSES.has(latest.status)) {
      const startedAt = Date.parse(latest.claimedAt ?? latest.createdAt);
      const elapsed = Number.isFinite(startedAt) ? formatElapsed(Date.now() - startedAt) : 'starting';
      renderPower(true, `Efesto is forging · ${elapsed}`);
      livingForge?.setAttribute('data-activity', latest.executionPhase === 'verifying' ? 'verifying' : 'working');
      schedule();
      return;
    }

    const completed = new Set(Array.isArray(stored.efestoForgeCompletedGoals) ? stored.efestoForgeCompletedGoals : []);
    if (latest?.status === 'completed' && latest.goalId) completed.add(latest.goalId);
    const orderedGoals = [...goals].sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0));
    const nextGoal = orderedGoals.find((goal) => !completed.has(goal.id));

    if (!nextGoal) {
      await chrome.storage.local.set({ efestoForgeEnabled: false, efestoForgeCompletedGoals: [] });
      renderPower(false, goals.length ? 'Forge cycle complete. Results are in Finds and Obsidian.' : 'Create a Goal, then start the forge.');
      livingForge?.setAttribute('data-activity', goals.length ? 'success' : 'idle');
      return;
    }

    await chrome.storage.local.set({ efestoForgeCompletedGoals: [...completed] });
    renderPower(true, `Starting: ${nextGoal.title}`);
    livingForge?.setAttribute('data-activity', 'queued');
    await startGoalResearch(nextGoal.id, options);
    schedule(1000);
  } catch (error) {
    renderPower(true, error instanceof Error ? error.message : 'The forge needs attention.');
    livingForge?.setAttribute('data-activity', 'error');
    schedule(5000);
  } finally {
    cycleRunning = false;
  }
}

function schedule(delay = POLL_MS) {
  clearTimeout(timer);
  timer = setTimeout(() => void runCycle(), delay);
}

function renderPower(enabled, detail) {
  if (!powerButton || !powerLabel || !powerDetail) return;
  powerButton.dataset.enabled = enabled ? 'true' : 'false';
  powerButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  powerButton.setAttribute('aria-label', enabled ? 'Pause Efesto after current work' : 'Start Efesto');
  powerLabel.textContent = enabled ? 'EFESTO ON' : 'START EFESTO';
  powerDetail.textContent = detail;
}

function formatElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}
