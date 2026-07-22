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

function missionRevision(mission) {
  return [mission.status, mission.executionPhase, terminalTimestamp(mission), mission.lastFailure?.recordedAt]
    .map((value) => String(value ?? ''))
    .join('|');
}

function terminalTimestamp(mission) {
  return mission.forgedAt ?? mission.completedAt ?? mission.lastFailure?.recordedAt ?? mission.createdAt ?? '';
}
