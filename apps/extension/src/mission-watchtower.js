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
 * OS notify + Watchtower Find aviso. Fail-close: Find/opportunity copy only when
 * kernelSupportedFindsForMission (same gate as find-presentation.js).
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
  if (finds.length > 0) {
    return {
      notify: true,
      kind: 'find',
      title: 'Efesto finished forging',
      message: 'A useful lead was forged. Open Efesto to inspect the Evidence.',
    };
  }
  return {
    notify: true,
    kind: 'forged',
    title: 'Efesto finished forging',
    message: 'A local mission finished. Open Efesto to inspect the Evidence.',
  };
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
