const ACTIVE_STATUSES = new Set(['queued', 'running']);
const TERMINAL_STATUSES = new Set(['completed', 'failed']);
const MAX_ATTEMPTS = 3;

export function deriveEfestoOrbState({ enabled = false, kernel = 'offline', services = {}, mission, now = Date.now() } = {}) {
  const kernelReady = kernel === 'ready';
  const hermesReady = services.hermes === 'ready';
  const obsidian = normalizeObsidian(services.obsidian);
  const expired = hasExpiredLease(mission, now);
  const exhausted = Number(mission?.attempt ?? 0) >= MAX_ATTEMPTS && mission?.status !== 'completed';

  if (!kernelReady) return base('offline', 'Kernel offline', 'Start your private Kernel before forging.', { enabled, active: false, smithActive: false, services: { hermesReady, obsidian } });
  if (!enabled) return base('idle', 'START EFESTO', 'The forge is off. Active missions are not invented.', { enabled, active: false, smithActive: false, services: { hermesReady, obsidian } });
  if (!mission) return base('starting', 'Starting the forge', 'Selecting the highest-priority active Goal.', { enabled, active: true, smithActive: false, services: { hermesReady, obsidian } });
  if (mission.status === 'waiting_for_agent') return base('failed', 'Hermes not available', 'Connect Hermes before this Goal can run.', { enabled, active: false, smithActive: false, services: { hermesReady: false, obsidian }, action: 'Retry safely', mission });
  if (mission.status === 'failed' || expired || exhausted) return base('failed', failureTitle(mission, expired, exhausted), cleanFailure(mission?.lastFailure?.reason) ?? 'Research stopped safely.', { enabled, active: false, smithActive: false, services: { hermesReady, obsidian }, action: 'Retry safely', mission });
  if (mission.executionPhase === 'verifying') return base('verifying', 'Efesto verifying', 'Kernel validation is preserving returned findings.', { enabled, active: true, smithActive: true, services: { hermesReady, obsidian }, mission });
  if (mission.executionPhase === 'syncing') return base('syncing', 'Syncing Obsidian', 'Writing only Kernel-confirmed notes to the private vault.', { enabled, active: true, smithActive: true, services: { hermesReady, obsidian }, mission });
  if (mission.status === 'running') return base('researching', 'Hermes researching', 'Hermes holds a live lease for public-source discovery.', { enabled, active: true, smithActive: true, services: { hermesReady, obsidian }, mission });
  if (mission.status === 'queued') return base('queued', 'Preparing mission', 'The Kernel has queued this mission for Hermes.', { enabled, active: true, smithActive: false, services: { hermesReady, obsidian }, mission });
  if (mission.status === 'completed') return base('completed', 'Forge complete', 'A terminal Kernel result is ready to inspect.', { enabled, active: false, smithActive: false, services: { hermesReady, obsidian }, mission, summary: missionSummary(mission), obsidianReceipt: obsidianReceipt(mission, obsidian) });
  if (TERMINAL_STATUSES.has(mission.status) || ACTIVE_STATUSES.has(mission.status)) return base(String(mission.status), String(mission.status), 'Inspect the mission ledger.', { enabled, active: false, smithActive: false, services: { hermesReady, obsidian }, mission });
  return base('idle', 'START EFESTO', 'No active mission is present.', { enabled, active: false, smithActive: false, services: { hermesReady, obsidian } });
}

export function resolveForgePowerIntent({ enabled = false, state = 'idle' } = {}) {
  if (state === 'failed') return { enabled: true, retry: true };
  return { enabled: !enabled, retry: false };
}

export function selectNextGoal(goals = [], completedGoalIds = []) {
  const completed = new Set(completedGoalIds);
  return [...goals]
    .filter((goal) => goal?.status !== 'archived' && !completed.has(goal.id))
    .sort((left, right) => Number(right.priority ?? 0) - Number(left.priority ?? 0) || String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')))[0];
}

export function shouldCreateMission({ enabled = false, mission, goals = [], completedGoalIds = [], kernel = 'offline' } = {}) {
  if (!enabled || kernel !== 'ready') return false;
  if (mission && ['waiting_for_agent', 'queued', 'running'].includes(mission.status)) return false;
  return Boolean(selectNextGoal(goals, completedGoalIds));
}

function base(state, label, detail, extra = {}) {
  return { state, tone: state, label, detail, active: false, smithActive: false, elapsedLabel: elapsed(extra.mission), heartbeatLabel: heartbeat(extra.mission), ...extra };
}
function missionSummary(mission = {}) {
  const summary = mission.resultSummary ?? {};
  return {
    findingsReceived: count(summary.received),
    evidenceCreated: count(summary.evidenceCreated),
    opportunitiesForged: count(summary.opportunitiesPromoted),
    obsidianNotesWritten: count(summary.obsidianNotesWritten),
  };
}
function obsidianReceipt(mission = {}, obsidian) {
  const receipt = mission.obsidianReceipt;
  if (receipt?.status) return { status: receipt.status, notesWritten: count(receipt.notesWritten), vaultRelativePath: receipt.vaultRelativePath, lastSyncedAt: receipt.lastSyncedAt };
  return { status: obsidian === 'configured' ? 'not_confirmed' : 'not_configured', notesWritten: 0 };
}
function normalizeObsidian(value) { return value === 'configured' || value === 'synced' ? 'configured' : 'not_configured'; }
function hasExpiredLease(mission, now) {
  if (mission?.status !== 'running') return false;
  const expires = Date.parse(mission.leaseExpiresAt);
  return Number.isFinite(expires) && expires <= Number(now);
}
function failureTitle(mission, expired, exhausted) {
  if (expired) return 'Lease expired safely';
  if (exhausted) return 'Attempts exhausted';
  return mission?.status === 'failed' ? 'Research stopped safely' : 'Forge stopped';
}
function cleanFailure(value) { return typeof value === 'string' && value.trim() ? value.replace(/[\r\n\t]+/g, ' ').slice(0, 180) : undefined; }
function count(value) { const n = Number(value); return Number.isInteger(n) && n >= 0 && n <= 200 ? n : 0; }
function elapsed(mission) {
  const start = Date.parse(mission?.claimedAt ?? mission?.createdAt ?? '');
  if (!Number.isFinite(start)) return undefined;
  const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}m ${seconds % 60}s elapsed` : `${seconds}s elapsed`;
}
function heartbeat(mission) {
  const at = mission?.verifyingAt ?? mission?.claimedAt ?? mission?.createdAt;
  return typeof at === 'string' && Number.isFinite(Date.parse(at)) ? `Last heartbeat ${new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : undefined;
}
