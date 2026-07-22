const MAX_RECORDS = 100;

const CATEGORY_CHECKS = {
  grant: ['Eligibility matches the official rules', 'Deadline is confirmed at the official source', 'Required documents are understood', 'No payment or credential request is involved'],
  job: ['Employer and role exist at the official source', 'Requirements match the Goal', 'Terms and location are understood', 'No advance payment or sensitive credential request is involved'],
  money: ['Source identity is independently checked', 'Return and risk claims are not taken at face value', 'No money or wallet connection is required to inspect it', 'Terms are confirmed outside promotional material'],
};

const DEFAULT_CHECKS = ['Source identity is independently checked', 'Eligibility or fit is understood', 'Date, cost and conditions are confirmed', 'No payment or sensitive credential request is involved'];

export function buildOpportunityActionPlan(opportunity = {}, completedIds = []) {
  const category = clean(opportunity.category)?.toLowerCase();
  const labels = CATEGORY_CHECKS[category] ?? DEFAULT_CHECKS;
  const completed = new Set(Array.isArray(completedIds) ? completedIds.filter((id) => typeof id === 'string') : []);
  const steps = labels.map((label, index) => ({ id: `check-${index + 1}`, label, completed: completed.has(`check-${index + 1}`) }));
  return { steps, completedCount: steps.filter((step) => step.completed).length, totalCount: steps.length, statusLabel: 'Human review only' };
}

export function updateOpportunityReviewState(state = {}, opportunityId, stepId, completed) {
  if (!clean(opportunityId) || !/^check-[1-4]$/.test(stepId)) return normalizeState(state);
  const normalized = normalizeState(state);
  const selected = new Set(normalized[opportunityId] ?? []);
  if (completed) selected.add(stepId); else selected.delete(stepId);
  const next = { ...normalized, [opportunityId]: [...selected].sort() };
  const entries = Object.entries(next).slice(-MAX_RECORDS);
  return Object.fromEntries(entries);
}

export function normalizeOpportunityReviewState(state) {
  return normalizeState(state);
}

function normalizeState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return {};
  const entries = Object.entries(state).slice(-MAX_RECORDS).flatMap(([id, values]) => {
    if (!clean(id) || !Array.isArray(values)) return [];
    return [[id, [...new Set(values.filter((value) => /^check-[1-4]$/.test(value)))].sort()]];
  });
  return Object.fromEntries(entries);
}

function clean(value) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 180) : undefined;
}
