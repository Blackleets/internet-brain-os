const REMOTE_GOAL = /\b(?:remote|remotely|work\s+from\s+home|home[- ]based|remot[oa]s?|teletrabajo|teletrabajar|trabajo\s+desde\s+casa)\b/iu;
const REMOTE_POSITIVE = /\b(?:fully\s+remote|100%\s+remote|remote\s+(?:role|job|position|work|project)|work\s+from\s+home|home[- ]based|remot[oa]s?|teletrabajo|teletrabajar|trabajo\s+desde\s+casa)\b/iu;
const REMOTE_NEGATED = /\b(?:not\s+(?:fully\s+)?remote|no\s+remote|remote\s+(?:work\s+)?(?:not\s+available|unavailable)|onsite\s+only|on[- ]site\s+only|presencial\s+(?:only|solo|solamente)|solo\s+presencial)\b/iu;
const HYBRID = /\b(?:hybrid|h[ií]brid[oa])\b/iu;
const ONSITE = /\b(?:onsite|on[- ]site|in[- ]office|office[- ]based|presencial)\b/iu;

export function extractGoalWorkModeConstraint(value) {
  return REMOTE_GOAL.test(normalize(value))
    ? { mode: 'remote', source: 'goal_title' }
    : undefined;
}

export function extractObservedWorkModes(value) {
  const facts = [];
  for (const source of pageTextSources(value)) {
    const text = normalize(source.text);
    if (!text) continue;
    const remoteNegated = REMOTE_NEGATED.test(text);
    if (remoteNegated) facts.push(fact('not_remote', source.field));
    if (!remoteNegated && REMOTE_POSITIVE.test(text)) facts.push(fact('remote', source.field));
    if (HYBRID.test(text)) facts.push(fact('hybrid', source.field));
    if (ONSITE.test(text)) facts.push(fact('onsite', source.field));
  }
  return uniqueFacts(facts);
}

export function evaluateGoalWorkModeConstraint(goal, opportunity) {
  const constraint = goal?.constraints?.workMode ?? extractGoalWorkModeConstraint(goal?.title);
  if (!constraint) return { required: false, status: 'none', reasons: [] };
  if (constraint.mode !== 'remote') return { required: true, status: 'unverified', reasons: ['Unsupported work-mode constraint'] };

  const facts = Array.isArray(opportunity?.observedFacts?.workModes)
    ? opportunity.observedFacts.workModes
    : [];
  if (facts.some((item) => item?.mode === 'remote')) {
    const source = facts.find((item) => item?.mode === 'remote');
    return {
      required: true,
      status: 'verified',
      reasons: [`Observed verified-page work mode: remote${source?.field ? ` (${source.field})` : ''}`],
    };
  }
  if (facts.some((item) => ['hybrid', 'onsite', 'not_remote'].includes(item?.mode))) {
    return {
      required: true,
      status: 'violated',
      reasons: [`Remote requirement violated by observed ${facts.map((item) => item?.mode).filter(Boolean).join(', ')}`],
    };
  }
  return { required: true, status: 'unverified', reasons: ['Remote work mode not verified from page content'] };
}

function fact(mode, field) {
  return { mode, source: 'kernel_verified_page_text', field };
}

function pageTextSources(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [{ field: 'text', text: String(value ?? '') }];
  }
  return [
    { field: 'title', text: String(value.title ?? '') },
    { field: 'description', text: String(value.description ?? '') },
    { field: 'selection', text: String(value.selection ?? '') },
    { field: 'visibleText', text: String(value.visibleText ?? '') },
  ].filter((item) => item.text.trim());
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en');
}

function uniqueFacts(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.mode}|${item.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
