const GENERIC_CAUTION = 'Verify the offer, eligibility, deadline, and source independently before acting.';
const UNVERIFIED_LABEL = 'Unverified lead';
const KERNEL_SUPPORT_LABEL = 'Kernel SUPPORT';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasHttpSourceUrl(sourceUrl) {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function missionSupportsEvidence(evidenceId, missions) {
  if (!Array.isArray(missions) || !missions.length || !evidenceId) return false;
  for (const mission of missions) {
    const results = mission?.verificationResults;
    if (!Array.isArray(results)) continue;
    for (const entry of results) {
      if (!entry || typeof entry !== 'object') continue;
      if (text(entry.evidenceId) === evidenceId && entry.supported === true) return true;
    }
  }
  return false;
}

/**
 * Fail-closed Kernel Find gate (mirrors dashboard isKernelSupportedFind).
 * Evidence+URL alone is not SUPPORT. Require item.supported === true or a
 * mission verificationResults entry with matching evidenceId and supported === true.
 */
export function isKernelSupportedFind(item = {}, missions = []) {
  const title = text(item.title);
  const evidenceId = text(item.evidenceId);
  const sourceUrl = text(item.sourceUrl);
  if (!title || !evidenceId || !sourceUrl || item.status === 'dismissed') return false;
  if (!hasHttpSourceUrl(sourceUrl)) return false;
  if (item.supported === true) return true;
  if (missionSupportsEvidence(evidenceId, missions)) return true;
  return false;
}

export function kernelSupportedFinds(items, missions = []) {
  return (Array.isArray(items) ? items : []).filter((item) => isKernelSupportedFind(item, missions));
}

/**
 * Finds proved by this mission only. item.supported on an unrelated opportunity
 * is not this mission's aviso. Fail-close when the mission has no evidenceIds.
 */
export function kernelSupportedFindsForMission(opportunities = [], mission) {
  if (!mission) return [];
  const evidenceIds = new Set();
  for (const entry of Array.isArray(mission.verificationResults) ? mission.verificationResults : []) {
    const id = text(entry?.evidenceId);
    if (id) evidenceIds.add(id);
  }
  if (!evidenceIds.size) return [];
  return kernelSupportedFinds(opportunities, [mission]).filter((item) => evidenceIds.has(text(item.evidenceId)));
}

export function presentFind(item = {}, missions = []) {
  const objectiveRelevance = boundedScore(item.relevance);
  const personalizedRelevance = boundedScore(item.personalizedRelevance ?? item.relevance);
  const goal = item.goalMatches?.[0];
  const reasons = Array.isArray(item.reasons)
    ? item.reasons.filter((reason) => typeof reason === 'string' && reason.trim()).slice(0, 3)
    : [];
  const cautions = [GENERIC_CAUTION];
  if (item.deadlineText) cautions.push('The deadline text was detected automatically and has not been confirmed.');
  if (item.benefitType === 'income' || item.benefitType === 'funding') cautions.push('Never pay upfront or share financial credentials based only on this lead.');

  return {
    objectiveRelevance,
    personalizedRelevance,
    verificationLabel: isKernelSupportedFind(item, missions) ? KERNEL_SUPPORT_LABEL : UNVERIFIED_LABEL,
    reasons,
    goal: goal ? { title: goal.title ?? 'Related Goal', reasons: Array.isArray(goal.reasons) ? goal.reasons.slice(0, 3) : [] } : undefined,
    evidenceId: typeof item.evidenceId === 'string' ? item.evidenceId : undefined,
    sourceHost: item.sourceHost ?? 'Public source',
    cautions,
    nextAction: item.nextAction ?? 'Open the public source and verify the details independently.',
  };
}

function boundedScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(99, Math.round(score))) : 0;
}
