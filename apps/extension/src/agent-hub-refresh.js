const ACTIVE_REFRESH_MS = 1000;
const QUEUED_REFRESH_MS = 3000;
const IDLE_REFRESH_MS = 10000;
// Same rule as the dashboard: one blip is a restart, two consecutive failures mean offline.
const UNREACHABLE_AFTER_FAILURES = 2;

export function agentHubRefreshDelay(missions = []) {
  const latest = newestByCreation(missions);
  if (latest?.status === 'running' || latest?.executionPhase === 'verifying') return ACTIVE_REFRESH_MS;
  if (latest?.status === 'queued' || latest?.status === 'waiting_for_agent') return QUEUED_REFRESH_MS;
  return IDLE_REFRESH_MS;
}

export function missionRevision(missions = []) {
  const latest = newestByCreation(missions);
  if (!latest) return 'none';
  return [latest.id, latest.status, latest.executionPhase, latest.attempt, latest.verifyingAt, latest.forgedAt, latest.lastFailure?.recordedAt]
    .map((value) => String(value ?? ''))
    .join('|');
}

export function createAgentHubRefresher(options) {
  const refresh = options.refresh;
  const isVisible = options.isVisible ?? (() => true);
  const scheduleTimer = options.setTimer ?? setTimeout;
  const cancelTimer = options.clearTimer ?? clearTimeout;
  const onKernelReachability = options.onKernelReachability ?? (() => {});
  let timer;
  let consecutiveFailures = 0;
  let unreachable = false;
  let stopped = true;
  let refreshing = false;
  let missions = [];

  function cancelScheduled() {
    if (timer !== undefined) cancelTimer(timer);
    timer = undefined;
  }

  function schedule() {
    cancelScheduled();
    if (stopped || !isVisible()) return;
    timer = scheduleTimer(run, unreachable ? IDLE_REFRESH_MS : agentHubRefreshDelay(missions));
  }

  async function run() {
    timer = undefined;
    if (stopped || !isVisible() || refreshing) return;
    refreshing = true;
    try {
      const next = await refresh();
      if (Array.isArray(next)) missions = next;
      consecutiveFailures = 0;
      if (unreachable) {
        unreachable = false;
        notify(true);
      }
    } catch {
      // Preserve the last observable state and retry; after repeated failures say so and back off.
      consecutiveFailures += 1;
      if (!unreachable && consecutiveFailures >= UNREACHABLE_AFTER_FAILURES) {
        unreachable = true;
        notify(false);
      }
    } finally {
      refreshing = false;
      schedule();
    }
  }

  function notify(online) {
    try { onKernelReachability(online); } catch { /* UI callback must not stop the refresh loop */ }
  }

  return {
    start(initialMissions = []) {
      missions = Array.isArray(initialMissions) ? initialMissions : [];
      stopped = false;
      schedule();
    },
    stop() {
      stopped = true;
      cancelScheduled();
    },
    visibilityChanged() {
      cancelScheduled();
      if (!stopped && isVisible()) void run();
    },
  };
}

function newestByCreation(missions) {
  return [...missions].sort((left, right) => String(right?.createdAt ?? '').localeCompare(String(left?.createdAt ?? '')))[0];
}
