const STATUS_COPY = Object.freeze({
  waiting_for_agent: { label: 'Waiting for Hermes', detail: 'The commission is authorized, but no Hermes adapter is connected.' },
  queued: { label: 'Ready for Hermes', detail: 'The commission is queued for a bounded public-source attempt.' },
  running: { label: 'Researching public sources', detail: 'Hermes holds a temporary lease. Efesto will verify every returned finding locally.' },
  completed: { label: 'Commission forged', detail: 'The bounded attempt finished. Kernel SUPPORT Finds were sealed by the local Kernel.' },
  completedWithoutForge: { label: 'Research ended without Evidence', detail: 'The bounded attempt finished. No Kernel-sealed lead was saved.' },
  failed: { label: 'Research stopped safely', detail: 'Three bounded attempts were exhausted. The Goal and existing Evidence remain intact.' },
});

export function presentMission(mission) {
  const status = missionStatusCopy(mission);
  const summary = mission?.resultSummary ?? {};
  // Fail-closed Finds: opportunitiesPromoted alone is not a Find. Count Kernel SUPPORT only.
  const finds = countSupportedFinds(mission?.verificationResults);
  return {
    title: String(mission?.goalTitle ?? 'Untitled commission'), status: String(mission?.status ?? 'unknown'),
    statusLabel: status.label, statusDetail: status.detail,
    attemptLabel: `${Math.min(Math.max(Number(mission?.attempt ?? 0), 0), 3)} of 3 attempts`,
    received: boundedCount(summary.received), evidenceCreated: boundedCount(summary.evidenceCreated),
    opportunitiesPromoted: finds, timeline: missionTimeline(mission),
    failureDetail: cleanProviderDetail(mission?.lastFailure?.reason),
  };
}

/**
 * Fail-close forged status copy: findings-passed / SUPPORT language only when
 * verificationResults prove Kernel SUPPORT Finds (same gate as countSupportedFinds).
 * Positive path must name Kernel SUPPORT — never bare "findings passed through".
 */
function missionStatusCopy(mission) {
  if (mission?.executionPhase === 'verifying') {
    return { label: 'Verifying returned findings', detail: 'Efesto is validating and preserving the returned material inside the local Kernel.' };
  }
  if (mission?.status === 'completed' && (mission.executionPhase === 'forged' || mission.workState === 'forged')) {
    const finds = countSupportedFinds(mission?.verificationResults);
    // Fail-close positive path: name Kernel SUPPORT Finds (same honesty as #mission-state / Living Forge).
    // Never claim bare "findings passed through" — unsupported verification rows may coexist.
    if (finds > 0) {
      return {
        label: STATUS_COPY.completed.label,
        detail: finds === 1
          ? 'The bounded attempt finished. 1 Find passed Kernel SUPPORT.'
          : `The bounded attempt finished. ${finds} Finds passed Kernel SUPPORT.`,
      };
    }
    return {
      label: 'Research completed',
      detail: 'The bounded attempt finished. No Find passed Kernel SUPPORT.',
    };
  }
  if (mission?.status === 'completed') return STATUS_COPY.completedWithoutForge;
  return STATUS_COPY[mission?.status] ?? { label: 'Unknown mission state', detail: 'Inspect the persisted mission before taking action.' };
}

export function missionTimeline(mission = {}) {
  const events = [];
  addEvent(events, mission.createdAt, 'Commission authorized', 'Efesto stored the Goal scope after explicit approval.');
  addEvent(events, mission.claimedAt, `Hermes claimed attempt ${boundedCount(mission.attempt) || 1}`, 'A temporary execution lease was issued.');
  addEvent(events, mission.verifyingAt, 'Kernel verification started', 'Returned material entered local validation; no Kernel SUPPORT Find is sealed yet.');
  addEvent(events, mission.lastFailure?.recordedAt, `Attempt ${boundedCount(mission.lastFailure?.attempt) || 1} failed safely`, 'The failure was recorded and the retry remained bounded.');
  const finds = countSupportedFinds(mission.verificationResults);
  const counts = `${boundedCount(mission.resultSummary?.received)} received · ${boundedCount(mission.resultSummary?.evidenceCreated)} Evidence · ${finds} Finds`;
  const forged = typeof mission.forgedAt === 'string'
    || mission.executionPhase === 'forged'
    || mission.workState === 'forged';
  if (forged) {
    addEvent(events, mission.forgedAt ?? mission.completedAt, 'Kernel verification completed', counts);
  } else if (mission.status === 'completed') {
    addEvent(events, mission.completedAt, 'Research ended without Evidence', counts);
  }
  return events.sort((left, right) => left.at.localeCompare(right.at));
}

/** Count verificationResults with supported === true. opportunitiesPromoted is ignored. */
function countSupportedFinds(results) {
  if (!Array.isArray(results)) return 0;
  let n = 0;
  for (const entry of results) {
    if (entry && typeof entry === 'object' && entry.supported === true) n += 1;
  }
  return boundedCount(n);
}

function addEvent(events, at, label, detail) { if (typeof at === 'string' && Number.isFinite(Date.parse(at))) events.push({ at, label, detail }); }
function boundedCount(value) { const number = Number(value); return Number.isInteger(number) && number >= 0 && number <= 20 ? number : 0; }
function cleanProviderDetail(value) {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, 160) : undefined;
}
