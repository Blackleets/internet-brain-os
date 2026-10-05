/**
 * How a Mission's Kernel web.read verification settles when it forges no Find.
 *
 * Before: a batch read without Kernel SUPPORT (or with every read failed) stayed `running/verifying`
 * with no lease and no process behind it. Nothing ever moved it on, so the Mission looked like work
 * in progress forever (run 6, the budcar/ryder Goal). It now settles explicitly, and never as
 * `completed`: Completado stays reserved for Kernel SUPPORT on fetched page content.
 *
 *   read ≥1 page, none supports the Goal → failed/failed, lastFailure.code 'verified_without_support'
 *   every web.read failed                → failed/failed, lastFailure.code 'web_read_failed'
 *
 * Evidence already written stays as it is. "Buscar más" (a fresh interactive decision) starts a new
 * attempt and keeps this one in priorAttempts.
 */
export const VERIFIED_WITHOUT_SUPPORT = 'verified_without_support';
export const WEB_READ_FAILED = 'web_read_failed';

export function settleVerificationWithoutFind(mission, verificationResults, nowIso) {
  const read = verificationResults.filter((item) => item?.status === 'verified').length;
  const code = read > 0 ? VERIFIED_WITHOUT_SUPPORT : WEB_READ_FAILED;
  const reason = read > 0
    ? `Kernel web.read read ${read} ${read === 1 ? 'page' : 'pages'}; none supports the Goal (no Kernel SUPPORT, no Find)`
    : 'Kernel web.read could not read any candidate page';
  const next = {
    ...mission,
    status: 'failed',
    executionPhase: 'failed',
    failedAt: nowIso,
    lastFailure: { code, reason, recordedAt: nowIso, attempt: Number(mission.attempt ?? 0) },
    limitation: read > 0
      ? 'Kernel web.read verification finished: pages read became Evidence, none supports the Goal, so no Find was forged'
      : 'Kernel web.read verification finished without reading any page; Buscar más can try again',
  };
  delete next.leaseId;
  delete next.leaseExpiresAt;
  delete next.verificationBlock;
  return next;
}

/** A settled verification (forged, or failed without a Find): replays must not read again. */
export function isSettledVerification(mission) {
  return Boolean(mission?.verificationDigest) && (mission.status === 'completed' || mission.status === 'failed');
}

/**
 * Missions stranded by the old behaviour: `running/verifying`, no live lease, a verification row for
 * every candidate, none supported, no policy block. Settled on the next Mission list; anything else
 * (verification still to run, a supported row, a block) is returned unchanged.
 */
export function settleStrandedVerification(mission, now) {
  if (mission?.status !== 'running' || mission.executionPhase !== 'verifying' || mission.verificationBlock) return mission;
  const lease = Date.parse(mission.leaseExpiresAt);
  if (Number.isFinite(lease) && lease > now.getTime()) return mission;
  const candidates = Array.isArray(mission.searchCandidates) ? mission.searchCandidates : [];
  const results = Array.isArray(mission.verificationResults) ? mission.verificationResults : [];
  if (!candidates.length || !results.length) return mission;
  if (results.some((item) => item?.supported === true)) return mission;
  const settledIds = new Set(results.map((item) => item?.candidateId));
  if (!candidates.every((candidate) => settledIds.has(candidate.id))) return mission;
  return settleVerificationWithoutFind(mission, results, now.toISOString());
}
