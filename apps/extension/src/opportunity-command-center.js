const DEFAULT_ACTION = 'Open the public source and verify the details independently.';

export function buildOpportunityCommandCenter(opportunities = []) {
  if (!Array.isArray(opportunities) || opportunities.length === 0) {
    return { lead: undefined, queue: [], objectiveCount: 0, goalLinkedCount: 0, deadlineCount: 0 };
  }

  const queue = opportunities.slice(0, 5).map((item, index) => ({
    id: typeof item.id === 'string' ? item.id : `find-${index}`,
    title: cleanText(item.title, 'Untitled opportunity'),
    category: cleanText(item.categoryLabel ?? item.category, 'Lead'),
    position: index + 1,
    objectiveRelevance: boundedScore(item.relevance),
    personalizedRelevance: boundedScore(item.personalizedRelevance ?? item.relevance),
    sourceHost: cleanText(item.sourceHost, 'Public source'),
    deadlineText: cleanOptionalText(item.deadlineText),
    goalTitle: cleanOptionalText(item.goalMatches?.[0]?.title),
    nextAction: cleanText(item.nextAction, DEFAULT_ACTION),
    verificationLabel: 'Unverified lead',
    reasons: attentionReasons(item),
  }));

  return {
    lead: queue[0],
    queue,
    objectiveCount: opportunities.filter((item) => boundedScore(item.relevance) > 0).length,
    goalLinkedCount: opportunities.filter((item) => Boolean(cleanOptionalText(item.goalMatches?.[0]?.title))).length,
    deadlineCount: opportunities.filter((item) => Boolean(cleanOptionalText(item.deadlineText))).length,
  };
}

function attentionReasons(item) {
  const reasons = [];
  const goal = cleanOptionalText(item.goalMatches?.[0]?.title);
  const deadline = cleanOptionalText(item.deadlineText);
  if (goal) reasons.push(`Matches Goal: ${goal}`);
  if (deadline) reasons.push('Deadline text detected; confirm it at the source');
  if (boundedScore(item.relevance) >= 70) reasons.push('Strong objective Evidence relevance');
  if (!reasons.length) reasons.push('Highest current position in your private Inbox');
  return reasons.slice(0, 3);
}

function boundedScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(99, Math.round(score))) : 0;
}

function cleanOptionalText(value) {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text ? text.slice(0, 160) : undefined;
}

function cleanText(value, fallback) {
  return cleanOptionalText(value) ?? fallback;
}
