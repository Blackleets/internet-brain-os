const STATUS_COPY = Object.freeze({
  waiting_for_agent: { label: 'Waiting for Hermes', detail: 'The commission is authorized, but no Hermes adapter is connected.' },
  queued: { label: 'Ready for Hermes', detail: 'The commission is queued for a bounded public-source attempt.' },
  running: { label: 'Researching public sources', detail: 'Hermes holds a temporary lease. Efesto will verify every returned candidate locally.' },
  completed: { label: 'Commission forged', detail: 'The bounded attempt finished. Kernel SUPPORT Finds were sealed by the local Kernel.' },
  completedWithoutForge: { label: 'Research ended without Evidence', detail: 'The bounded attempt finished. No Kernel-sealed lead was saved.' },
  failed: { label: 'Research stopped safely', detail: 'Three bounded attempts were exhausted. The Goal and existing Evidence remain intact.' },
});

// Kernel settlement codes (apps/local-kernel/mission-verification-settlement.mjs): the Kernel itself
// settled a single attempt's web.read verification as failed without a Find. Not exhausted retries,
// not a provider error: a page read (HTTP 200 → Evidence) is RETRIEVED only, never Kernel SUPPORT.
export const VERIFIED_WITHOUT_SUPPORT = 'verified_without_support';
export const WEB_READ_FAILED = 'web_read_failed';

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
    // Kernel settlement reasons are the Kernel's own verdict, already stated in statusDetail:
    // never re-label them as "Provider detail".
    failureDetail: kernelSettlementCode(mission) ? undefined : cleanProviderDetail(mission?.lastFailure?.reason),
  };
}

/**
 * Fail-close forged status copy: findings-passed / SUPPORT language only when
 * verificationResults prove Kernel SUPPORT Finds (same gate as countSupportedFinds).
 * Positive path must name Kernel SUPPORT — never bare "findings passed through".
 */
function missionStatusCopy(mission) {
  if (mission?.executionPhase === 'verifying') {
    return { label: 'Verifying returned material', detail: 'Efesto is validating returned candidates inside the local Kernel. Finds still require Kernel SUPPORT.' };
  }
  if (mission?.status === 'completed' && (mission.executionPhase === 'forged' || mission.workState === 'forged')) {
    const finds = countSupportedFinds(mission?.verificationResults);
    // Fail-close positive path: name Kernel SUPPORT Finds (same honesty as #mission-state / Living Forge).
    // Never claim bare "findings passed through" — unsupported verification rows may coexist.
    if (finds > 0) {
      // Fail-close positive label: name Kernel SUPPORT (same honesty as orb / Living Forge).
      // Bare "Commission forged" must not stand in for a sealed SUPPORT Find on mission cards.
      return {
        label: finds === 1
          ? 'A Kernel SUPPORT Find was forged'
          : 'Kernel SUPPORT Finds were forged',
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
  const settlement = kernelSettlementCode(mission);
  if (settlement === VERIFIED_WITHOUT_SUPPORT) {
    const read = countVerifiedReads(mission?.verificationResults);
    const pages = read > 0 ? `${read} ${read === 1 ? 'page' : 'pages'}` : 'the candidate pages';
    return {
      label: 'Read without Kernel SUPPORT',
      detail: `The Kernel read ${pages} as Evidence; none passed Kernel SUPPORT, so no Find was forged. Open Efesto to review that Evidence.`,
    };
  }
  if (settlement === WEB_READ_FAILED) {
    return {
      label: 'Candidate pages could not be read',
      detail: 'The Kernel could not read any candidate page, so no page became Evidence and no Find was forged.',
    };
  }
  return STATUS_COPY[mission?.status] ?? { label: 'Unknown mission state', detail: 'Inspect the persisted mission before taking action.' };
}

export function missionTimeline(mission = {}) {
  const events = [];
  addEvent(events, mission.createdAt, 'Commission authorized', 'Efesto stored the Goal scope after explicit approval.');
  addEvent(events, mission.claimedAt, `Hermes claimed attempt ${boundedCount(mission.attempt) || 1}`, 'A temporary execution lease was issued.');
  addEvent(events, mission.verifyingAt, 'Kernel verification started', 'Returned material entered local validation; no Kernel SUPPORT Find is sealed yet.');
  const finds = countSupportedFinds(mission.verificationResults);
  const settlement = kernelSettlementCode(mission);
  if (settlement === VERIFIED_WITHOUT_SUPPORT || settlement === WEB_READ_FAILED) {
    // Kernel settled the verification itself: no retry is pending and no Find was sealed.
    addEvent(events, mission.lastFailure?.recordedAt, settlement === VERIFIED_WITHOUT_SUPPORT ? 'Kernel verification settled without SUPPORT' : 'Kernel could not read candidate pages',
      `${countVerifiedReads(mission.verificationResults)} read · ${boundedCount(mission.resultSummary?.evidenceCreated)} Evidence · ${finds} Finds`);
  } else {
    addEvent(events, mission.lastFailure?.recordedAt, `Attempt ${boundedCount(mission.lastFailure?.attempt) || 1} failed safely`, 'The failure was recorded and the retry remained bounded.');
  }
  const counts = `${boundedCount(mission.resultSummary?.received)} received · ${boundedCount(mission.resultSummary?.evidenceCreated)} Evidence · ${finds} Finds`;
  const forged = typeof mission.forgedAt === 'string'
    || mission.executionPhase === 'forged'
    || mission.workState === 'forged';
  if (forged) {
    // Fail-close mission-card ledger: zero-SUPPORT forged must not brand Completado-lookalike
    // "Kernel verification completed" while statusLabel is Research completed (Living Forge /
    // Agent Hub / watchtower honesty). SUPPORT path must name Kernel SUPPORT on the seal event.
    const sealLabel = finds > 0
      ? (finds === 1 ? 'Kernel SUPPORT Find sealed' : 'Kernel SUPPORT Finds sealed')
      : 'Research completed';
    addEvent(events, mission.forgedAt ?? mission.completedAt, sealLabel, counts);
  } else if (mission.status === 'completed') {
    addEvent(events, mission.completedAt, 'Research ended without Evidence', counts);
  }
  return events.sort((left, right) => left.at.localeCompare(right.at));
}

export function kernelSettlementCode(mission) {
  if (mission?.status !== 'failed' || countSupportedFinds(mission?.verificationResults) > 0) return undefined;
  const code = mission?.lastFailure?.code;
  return code === VERIFIED_WITHOUT_SUPPORT || code === WEB_READ_FAILED ? code : undefined;
}

/** Pages the Kernel web.read actually fetched (status verified). A read is RETRIEVED, not SUPPORT. */
export function countVerifiedReads(results) {
  if (!Array.isArray(results)) return 0;
  let n = 0;
  for (const entry of results) {
    if (entry && typeof entry === 'object' && entry.status === 'verified') n += 1;
  }
  return boundedCount(n);
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