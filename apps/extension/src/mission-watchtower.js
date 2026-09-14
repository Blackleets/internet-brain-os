import { kernelSupportedFindsForMission } from './find-presentation.js';

const TERMINAL_STATUSES = new Set(['completed', 'failed']);
const MAX_TRACKED_MISSIONS = 100;
const MAX_RESULT_EVENTS = 20;

export function reconcileMissionWatchtower(missions, previous = {}, now = Date.now()) {
  const safeMissions = Array.isArray(missions) ? missions : [];
  const initialized = previous.initialized === true;
  const known = previous.known && typeof previous.known === 'object' ? previous.known : {};
  const existingEvents = Array.isArray(previous.events) ? previous.events : [];
  const transitions = [];
  const ordered = [...safeMissions]
    .filter((mission) => typeof mission?.id === 'string' && typeof mission?.status === 'string')
    .sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')))
    .slice(0, MAX_TRACKED_MISSIONS);
  const nextKnown = {};

  for (const mission of ordered) {
    nextKnown[mission.id] = missionRevision(mission);
    if (!initialized || !TERMINAL_STATUSES.has(mission.status)) continue;
    const prior = known[mission.id];
    if (prior === undefined || prior === nextKnown[mission.id]) continue;
    transitions.push({
      id: `${mission.id}:${mission.status}:${terminalTimestamp(mission)}`,
      missionId: mission.id,
      status: mission.status,
      executionPhase: typeof mission.executionPhase === 'string' ? mission.executionPhase : undefined,
      workState: typeof mission.workState === 'string' ? mission.workState : undefined,
      occurredAt: terminalTimestamp(mission),
      observedAt: new Date(now).toISOString(),
      unread: true,
    });
  }

  const seen = new Set(existingEvents.map((event) => event?.id));
  const events = [...transitions.filter((event) => !seen.has(event.id)), ...existingEvents]
    .filter((event) => event?.id && TERMINAL_STATUSES.has(event.status))
    .slice(0, MAX_RESULT_EVENTS);
  return { state: { initialized: true, known: nextKnown, events }, transitions };
}

export function markWatchtowerEventsRead(state = {}) {
  return { ...state, events: (Array.isArray(state.events) ? state.events : []).map((event) => ({ ...event, unread: false })) };
}

export function unreadWatchtowerCount(state = {}) {
  return (Array.isArray(state.events) ? state.events : []).filter((event) => event?.unread === true).length;
}

function isForgedComplete(record = {}) {
  return record.status === 'completed' && (record.executionPhase === 'forged' || record.workState === 'forged');
}

/**
 * OS notify + Watchtower Find aviso. Fail-close: Find copy when inbox Finds match
 * this mission OR verificationResults prove Kernel SUPPORT (Living Forge gate).
 * listOpportunities catch→[] must not demote SUPPORT missions to kind:forged.
 * Do not notify Completado for unverified (bare completed) leads.
 */
export function presentWatchtowerAviso(transition = {}, opportunities = [], mission) {
  if (transition.status === 'failed') {
    return {
      notify: true,
      kind: 'attention',
      title: 'Efesto needs your attention',
      message: 'A local mission stopped safely. Open Efesto to review the Forge Ledger.',
    };
  }
  const forged = isForgedComplete(transition) || isForgedComplete(mission ?? {});
  if (transition.status !== 'completed' || !forged) {
    return { notify: false, kind: 'silent', title: '', message: '' };
  }
  const finds = kernelSupportedFindsForMission(opportunities, mission);
  // Living Forge / mission-presentation countSupportedFinds is the mission truth.
  // Prefer max(inbox, verificationResults): empty inbox (catch→[]) must not demote
  // to kind:forged, and a partial opportunities page must not understate SUPPORT
  // below Living Forge when verificationResults prove more Finds.
  const n = Math.max(finds.length, countMissionSupportedFinds(mission));
  if (n > 0) {
    // Fail-close Find aviso copy: SUPPORT-gated finds must name Kernel SUPPORT (same honesty as
    // Living Forge / mission-state / Kernel NotificationGateway body) — not bare "useful lead".
    return {
      notify: true,
      kind: 'find',
      title: 'Efesto finished forging',
      message: `${n} ${n === 1 ? 'Find' : 'Finds'} passed Kernel SUPPORT. Open Efesto to inspect the Evidence.`,
    };
  }
  return {
    notify: true,
    kind: 'forged',
    title: 'Efesto finished forging',
    message: 'A local mission finished. Open Efesto to inspect the Evidence.',
  };
}

/** Living Forge gate: verificationResults with supported === true. */
function countMissionSupportedFinds(mission) {
  const results = mission?.verificationResults;
  if (!Array.isArray(results)) return 0;
  let n = 0;
  for (const entry of results) {
    if (entry && typeof entry === 'object' && entry.supported === true) n += 1;
  }
  return n;
}

export function presentWatchtowerBanner(unread, event = {}) {
  const count = Number(unread) || 0;
  if (count <= 0) return '';
  if (event.kind === 'find' || event.kind === 'forged' || isForgedComplete(event)) {
    return `${count} new forge result${count === 1 ? '' : 's'} ready to inspect.`;
  }
  return `${count} mission update${count === 1 ? '' : 's'} needs attention.`;
}

function missionRevision(mission) {
  return [mission.status, mission.executionPhase, terminalTimestamp(mission), mission.lastFailure?.recordedAt]
    .map((value) => String(value ?? ''))
    .join('|');
}

function terminalTimestamp(mission) {
  return mission.forgedAt ?? mission.completedAt ?? mission.lastFailure?.recordedAt ?? mission.createdAt ?? '';
}
