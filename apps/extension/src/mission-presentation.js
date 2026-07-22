const STATUS_COPY = Object.freeze({
  waiting_for_agent: { label: 'Waiting for Hermes', detail: 'The commission is authorized, but no Hermes adapter is connected.' },
  queued: { label: 'Ready for Hermes', detail: 'The commission is queued for a bounded public-source attempt.' },
  running: { label: 'Researching public sources', detail: 'Hermes holds a temporary lease. Efesto will verify every returned finding locally.' },
  completed: { label: 'Commission forged', detail: 'The bounded attempt finished and its findings passed through the local Kernel.' },
  failed: { label: 'Research stopped safely', detail: 'Three bounded attempts were exhausted. The Goal and existing Evidence remain intact.' },
});

export function presentMission(mission) {
  const status = mission?.executionPhase === 'verifying'
    ? { label: 'Verifying returned findings', detail: 'Efesto is validating and preserving the returned material inside the local Kernel.' }
    : STATUS_COPY[mission?.status] ?? { label: 'Unknown mission state', detail: 'Inspect the persisted mission before taking action.' };
  const summary = mission?.resultSummary ?? {};
  return {
    title: String(mission?.goalTitle ?? 'Untitled commission'), status: String(mission?.status ?? 'unknown'),
    statusLabel: status.label, statusDetail: status.detail,
    attemptLabel: `${Math.min(Math.max(Number(mission?.attempt ?? 0), 0), 3)} of 3 attempts`,
    received: boundedCount(summary.received), evidenceCreated: boundedCount(summary.evidenceCreated),
    opportunitiesPromoted: boundedCount(summary.opportunitiesPromoted), timeline: missionTimeline(mission),
    failureDetail: cleanProviderDetail(mission?.lastFailure?.reason),
  };
}

export function missionTimeline(mission = {}) {
  const events = [];
  addEvent(events, mission.createdAt, 'Commission authorized', 'Efesto stored the Goal scope after explicit approval.');
  addEvent(events, mission.claimedAt, `Hermes claimed attempt ${boundedCount(mission.attempt) || 1}`, 'A temporary execution lease was issued.');
  addEvent(events, mission.verifyingAt, 'Kernel verification started', 'Returned findings entered local validation; no opportunity is accepted yet.');
  addEvent(events, mission.lastFailure?.recordedAt, `Attempt ${boundedCount(mission.lastFailure?.attempt) || 1} failed safely`, 'The failure was recorded and the retry remained bounded.');
  addEvent(events, mission.forgedAt ?? mission.completedAt, 'Kernel verification completed', `${boundedCount(mission.resultSummary?.received)} received · ${boundedCount(mission.resultSummary?.evidenceCreated)} Evidence · ${boundedCount(mission.resultSummary?.opportunitiesPromoted)} promoted`);
  return events.sort((left, right) => left.at.localeCompare(right.at));
}

function addEvent(events, at, label, detail) { if (typeof at === 'string' && Number.isFinite(Date.parse(at))) events.push({ at, label, detail }); }
function boundedCount(value) { const number = Number(value); return Number.isInteger(number) && number >= 0 && number <= 20 ? number : 0; }
function cleanProviderDetail(value) {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, 160) : undefined;
}
