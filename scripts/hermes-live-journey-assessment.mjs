export const LIVE_PUBLIC_WEB_CHECK_IDS = Object.freeze(['L3', 'L4', 'L5', 'L6', 'L7']);

export function assessLivePublicWebJourney({ goalId, mission, opportunities = [], caseDetails = [], surface }) {
  const candidates = Array.isArray(mission?.searchCandidates) ? mission.searchCandidates : [];
  const verificationResults = Array.isArray(mission?.verificationResults) ? mission.verificationResults : [];
  const received = numberOrZero(mission?.resultSummary?.received);
  const evidenceCreated = numberOrZero(mission?.resultSummary?.evidenceCreated);
  const opportunitiesPromoted = numberOrZero(mission?.resultSummary?.opportunitiesPromoted);
  const verifiedResults = verificationResults.filter((item) => item?.status === 'verified' && validId(item?.evidenceId));
  const candidateIds = new Set(candidates.filter((item) => validId(item?.id)).map((item) => item.id));
  const linkedFinds = opportunities.filter((item) => findMatchesGoal(item, goalId));
  const evidence = caseDetails.flatMap((detail) => Array.isArray(detail?.evidence) ? detail.evidence : []);
  const evidenceById = new Map(evidence.filter((item) => validId(item?.id)).map((item) => [item.id, item]));
  const provenancePairs = linkedFinds.flatMap((find) => {
    const record = validId(find?.evidenceId) ? evidenceById.get(find.evidenceId) : undefined;
    return record ? [{ find, evidence: record }] : [];
  });
  const fullyVerifiedPairs = provenancePairs.filter(({ find, evidence: record }) =>
    validId(find?.caseId)
    && record.caseId === find.caseId
    && record.missionId === mission?.id
    && candidateIds.has(record.candidateId)
    && record.extractionMethod === 'kernel-web-read-v1'
    && typeof record.sourceReceiptId === 'string'
    && record.sourceReceiptId.startsWith('web-read:')
    && typeof record.rawText === 'string'
    && record.rawText.trim().length > 0
    && /^[a-f0-9]{64}$/i.test(String(record.contentHash ?? ''))
    && samePublicUrl(record.sourceUrl, find.sourceUrl));

  return [
    check(
      'L3',
      'Authentic Hermes discovery persisted bounded search candidates before verification',
      received > 0 && candidates.length > 0 && received >= candidates.length && candidates.every(validCandidate),
      `received=${received} candidates=${candidates.length}`,
    ),
    check(
      'L4',
      'Kernel web.read verification created Evidence from at least one candidate',
      evidenceCreated > 0 && verifiedResults.length > 0 && verifiedResults.every((item) => candidateIds.has(item.candidateId)),
      `evidenceCreated=${evidenceCreated} verified=${verifiedResults.length}`,
    ),
    check(
      'L5',
      'At least one Evidence-backed Find was promoted for the tested Goal',
      opportunitiesPromoted > 0 && linkedFinds.length > 0,
      `opportunitiesPromoted=${opportunitiesPromoted} goalLinkedFinds=${linkedFinds.length}`,
    ),
    check(
      'L6',
      'Find provenance resolves to Kernel-fetched Evidence rather than agent text',
      fullyVerifiedPairs.length > 0,
      `resolvedEvidenceBackedFinds=${fullyVerifiedPairs.length}`,
    ),
    check(
      'L7',
      'Shared Goal Truth converged on the forged Mission from the same Kernel state',
      surface?.schemaVersion === 'efesto.goal-surface.v1'
        && surface?.sourceOfTruth === 'kernel'
        && surface?.goal?.id === goalId
        && surface?.mission?.id === mission?.id
        && surface?.mission?.workState === 'forged',
      `source=${surface?.sourceOfTruth ?? 'none'} workState=${surface?.mission?.workState ?? 'none'}`,
    ),
  ];
}

function validCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || !validId(candidate.id)) return false;
  if (!candidate.id.startsWith('search-candidate:')) return false;
  if (!['verified', 'verification_failed'].includes(candidate.status)) return false;
  return isPublicHttpUrl(candidate.url);
}

function findMatchesGoal(find, goalId) {
  return Array.isArray(find?.goalMatches) && find.goalMatches.some((match) => match?.goalId === goalId);
}

function samePublicUrl(left, right) {
  try {
    const first = new URL(left);
    const second = new URL(right);
    return ['http:', 'https:'].includes(first.protocol)
      && ['http:', 'https:'].includes(second.protocol)
      && first.href === second.href;
  } catch {
    return false;
  }
}

function isPublicHttpUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function check(id, name, passed, detail) {
  return { id, name, passed: Boolean(passed), detail };
}
