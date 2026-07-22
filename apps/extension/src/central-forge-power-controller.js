import { DEFAULT_KERNEL_BASE_URL, getEfestoBootstrapStatus, listAgentMissions, listGoals, startGoalResearch } from './local-transport.js';
import { deriveEfestoOrbState, resolveForgePowerIntent, selectNextGoal, shouldCreateMission } from './efesto-orb-state.js';

const ACTIVE_STATUSES = new Set(['queued', 'running']);
const DEFAULT_POLL_MS = 2000;
const attachedButtons = new WeakSet();

export function createForgePowerController({
  elements,
  storage = globalThis.chrome?.storage?.local,
  transport = { getEfestoBootstrapStatus, listAgentMissions, listGoals, startGoalResearch },
  pollMs = DEFAULT_POLL_MS,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
} = {}) {
  const state = { timer: undefined, cycleRunning: false, pressRunning: false, currentOrbState: 'idle' };

  async function initialize() {
    const stored = await storage.get(['efestoForgeEnabled']);
    const enabled = Boolean(stored.efestoForgeEnabled);
    renderForgePowerView(elements, deriveEfestoOrbState({ enabled, kernel: enabled ? 'ready' : 'offline', services: {} }), enabled ? 'Recovering forge state…' : 'Press once to start forging.');
    state.currentOrbState = elements.powerButton?.dataset.state ?? 'idle';
    if (enabled) void runCycle();
  }

  function attach() {
    const button = elements?.powerButton;
    if (!button || attachedButtons.has(button)) return;
    attachedButtons.add(button);
    button.addEventListener('click', () => { void handlePress(); });
  }

  async function handlePress() {
    const button = elements?.powerButton;
    if (button) {
      button.dataset.clickReceived = 'true';
      button.dataset.state = 'starting';
    }
    if (elements?.powerDetail) elements.powerDetail.textContent = 'Starting the forge';
    if (state.pressRunning || state.cycleRunning) return;
    state.pressRunning = true;
    state.currentOrbState = button?.dataset.previousState ?? state.currentOrbState;
    try {
      const stored = await storage.get(['efestoForgeEnabled']);
      const visibleState = button?.dataset.previousState ?? state.currentOrbState;
      const intent = resolveForgePowerIntent({ enabled: Boolean(stored.efestoForgeEnabled), state: visibleState });
      await storage.set({ efestoForgeEnabled: intent.enabled });
      const immediate = deriveEfestoOrbState({ enabled: intent.enabled, kernel: 'ready', services: {}, mission: undefined });
      renderForgePowerView(elements, immediate, intent.retry ? 'Retrying the failed mission safely.' : intent.enabled ? 'Starting the forge' : 'Active work will finish safely.');
      state.currentOrbState = elements.powerButton?.dataset.state ?? immediate.state;
      if (intent.enabled) void runCycle();
    } finally {
      state.pressRunning = false;
    }
  }

  async function runCycle() {
    if (state.cycleRunning) return;
    state.cycleRunning = true;
    clearTimeoutFn(state.timer);
    try {
      const stored = await storage.get([
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
        renderForgePowerView(elements, deriveEfestoOrbState({ enabled: false, kernel: 'ready', services: {} }), 'Paused. Press once to start forging.');
        state.currentOrbState = elements.powerButton?.dataset.state ?? 'idle';
        return;
      }
      if (!stored.kernelApiToken) {
        renderForgePowerView(elements, deriveEfestoOrbState({ enabled: false, kernel: 'ready', services: {} }), 'Connect the private Kernel before starting.');
        await storage.set({ efestoForgeEnabled: false });
        state.currentOrbState = elements.powerButton?.dataset.state ?? 'idle';
        return;
      }

      const [bootstrap, missions, goals] = await Promise.all([
        transport.getEfestoBootstrapStatus({ baseUrl: options.baseUrl }),
        transport.listAgentMissions(options),
        transport.listGoals(options),
      ]);
      const kernel = bootstrap.kernel === 'ready' ? 'ready' : 'offline';
      const services = {
        hermes: bootstrap.hermes === 'ready' ? 'ready' : 'disabled',
        obsidian: bootstrap.obsidian === 'ready' ? 'configured' : 'not_configured',
      };
      const latest = newest(missions);
      renderForgePowerView(elements, deriveEfestoOrbState({ enabled, kernel, services, mission: latest }));
      state.currentOrbState = elements.powerButton?.dataset.state ?? 'idle';

      if (latest?.status === 'waiting_for_agent' && services.hermes === 'ready') {
        const restartedMission = await transport.startGoalResearch(latest.goalId, options);
        renderForgePowerView(elements, deriveEfestoOrbState({ enabled, kernel, services, mission: restartedMission }));
        state.currentOrbState = elements.powerButton?.dataset.state ?? 'idle';
        schedule(1000);
        return;
      }

      if (latest && ACTIVE_STATUSES.has(latest.status)) {
        schedule();
        return;
      }

      const completed = new Set(Array.isArray(stored.efestoForgeCompletedGoals) ? stored.efestoForgeCompletedGoals : []);
      if (latest?.status === 'completed' && latest.goalId) completed.add(latest.goalId);
      await storage.set({ efestoForgeCompletedGoals: [...completed] });

      if (!shouldCreateMission({ enabled, kernel, goals, completedGoalIds: [...completed], mission: latest })) {
        if (!selectNextGoal(goals, [...completed])) {
          await storage.set({ efestoForgeEnabled: false, efestoForgeCompletedGoals: [] });
          renderForgePowerView(elements, deriveEfestoOrbState({ enabled: false, kernel, services, mission: latest }), goals.length ? 'Forge cycle complete. Results are in Finds and Obsidian receipts when confirmed.' : 'Create a Goal, then start the forge.');
          state.currentOrbState = elements.powerButton?.dataset.state ?? 'idle';
        }
        return;
      }

      const nextGoal = selectNextGoal(goals, [...completed]);
      renderForgePowerView(elements, deriveEfestoOrbState({ enabled, kernel, services, mission: undefined }), `Starting the forge for ${nextGoal.title}`);
      state.currentOrbState = elements.powerButton?.dataset.state ?? 'idle';
      const startedMission = await transport.startGoalResearch(nextGoal.id, options);
      renderForgePowerView(elements, deriveEfestoOrbState({ enabled, kernel, services, mission: startedMission }));
      state.currentOrbState = elements.powerButton?.dataset.state ?? 'idle';
      schedule(1000);
    } catch (error) {
      renderForgePowerView(elements, { state: 'failed', label: 'Forge needs attention', detail: error instanceof Error ? error.message : 'Unable to read Kernel state.', active: false, smithActive: false, action: 'Retry safely', enabled: true });
      state.currentOrbState = 'failed';
      schedule(5000);
    } finally {
      state.cycleRunning = false;
    }
  }

  function schedule(delay = pollMs) {
    clearTimeoutFn(state.timer);
    state.timer = setTimeoutFn(() => void runCycle(), delay);
  }

  function stop() { clearTimeoutFn(state.timer); }

  return { attach, initialize, runCycle, stop, state };
}

export function renderForgePowerView(elements = {}, view, overrideDetail) {
  const { powerButton, powerLabel, powerDetail, livingForge, orbMeta, orbSummary, obsidianReceipt } = elements;
  if (!powerButton || !powerLabel || !powerDetail) return;
  const enabled = Boolean(view.enabled);
  powerButton.dataset.enabled = enabled ? 'true' : 'false';
  powerButton.dataset.previousState = view.state;
  powerButton.dataset.state = view.state;
  powerButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  powerButton.setAttribute('aria-label', enabled ? 'Pause Efesto after current work' : view.action ?? 'Start Efesto');
  powerLabel.textContent = view.action && view.state === 'failed' ? view.action : view.label;
  powerDetail.textContent = overrideDetail ?? view.detail;
  livingForge?.setAttribute?.('data-activity', view.smithActive ? (view.state === 'verifying' ? 'verifying' : 'working') : view.state === 'completed' ? 'success' : view.state === 'failed' ? 'error' : 'idle');
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
  renderObsidianReceipt(obsidianReceipt, view.state === 'completed' ? view.obsidianReceipt : undefined);
}

function renderObsidianReceipt(obsidianReceipt, receipt) {
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
function setText(selector, value) { const node = globalThis.document?.querySelector?.(selector); if (node) node.textContent = value; }
