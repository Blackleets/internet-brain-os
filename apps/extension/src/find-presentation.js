const GENERIC_CAUTION = 'Verify the offer, eligibility, deadline, and source independently before acting.';

export function presentFind(item = {}) {
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
    verificationLabel: 'Unverified lead',
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
