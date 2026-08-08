export function rankOpportunity(opportunity, { goalMatches = [], learnedAdjustment = 0, now = new Date().toISOString() } = {}) {
  const relevance = clamp(Number(opportunity?.relevance) || 0);
  const goalFit = clamp(Number(goalMatches?.[0]?.score) || 0);
  const evidenceStrength = provenanceScore(opportunity);
  const freshness = freshnessScore(opportunity?.detectedAt, now);
  const preference = clamp(50 + boundedAdjustment(learnedAdjustment));
  const riskPenalty = provenanceRiskPenalty(opportunity);
  const score = clamp(Math.round(
    (relevance * 0.30)
    + (goalFit * 0.25)
    + (evidenceStrength * 0.20)
    + (freshness * 0.15)
    + (preference * 0.10)
    - riskPenalty,
  ));

  const reasons = [];
  if (goalFit >= 60) reasons.push('Strong Goal fit');
  if (evidenceStrength >= 90) reasons.push('Case and Evidence provenance available');
  if (freshness >= 85) reasons.push('Recently detected');
  if (learnedAdjustment > 0) reasons.push('Boosted by explicit useful/saved feedback');
  if (learnedAdjustment < 0) reasons.push('Reduced by explicit dismiss/not-interested feedback');
  if (riskPenalty > 0) reasons.push('Reduced because provenance is incomplete');

  return {
    score,
    components: { relevance, goalFit, evidenceStrength, freshness, preference, riskPenalty },
    reasons,
  };
}

function provenanceScore(opportunity) {
  if (opportunity?.evidenceId && opportunity?.caseId) return 99;
  if (opportunity?.evidenceId || opportunity?.caseId) return 70;
  return 25;
}

function provenanceRiskPenalty(opportunity) {
  let penalty = 0;
  if (!opportunity?.evidenceId) penalty += 12;
  if (!opportunity?.caseId) penalty += 8;
  if (!opportunity?.sourceHost) penalty += 8;
  return Math.min(28, penalty);
}

function freshnessScore(detectedAt, now) {
  const detected = Date.parse(detectedAt);
  const current = Date.parse(now);
  if (!Number.isFinite(detected) || !Number.isFinite(current) || detected > current + 60_000) return 20;
  const ageHours = Math.max(0, current - detected) / 3_600_000;
  if (ageHours <= 24) return 99;
  if (ageHours <= 72) return 85;
  if (ageHours <= 168) return 70;
  if (ageHours <= 720) return 50;
  return 25;
}

function boundedAdjustment(value) {
  const numeric = Number(value) || 0;
  return Math.max(-35, Math.min(35, numeric));
}
function clamp(value) { return Math.max(0, Math.min(99, Number.isFinite(value) ? value : 0)); }
