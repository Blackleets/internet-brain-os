import { describe, expect, it } from 'vitest';
import { buildOpportunityActionPlan, normalizeOpportunityReviewState, updateOpportunityReviewState } from './opportunity-action-workspace.js';

describe('Opportunity Action Workspace', () => {
  it('builds a category-aware manual checklist without claiming verification', () => {
    const plan = buildOpportunityActionPlan({ category: 'grant' }, ['check-1']);
    expect(plan).toMatchObject({ completedCount: 1, totalCount: 4, statusLabel: 'Human review only' });
    expect(plan.steps[0]).toMatchObject({ completed: true, label: 'Eligibility matches the official rules' });
  });

  it('updates only bounded recognized checklist state', () => {
    const state = updateOpportunityReviewState({}, 'opp:1', 'check-2', true);
    expect(state).toEqual({ 'opp:1': ['check-2'] });
    expect(updateOpportunityReviewState(state, 'opp:1', 'invalid', true)).toEqual(state);
    expect(updateOpportunityReviewState(state, 'opp:1', 'check-2', false)).toEqual({ 'opp:1': [] });
  });

  it('normalizes malformed state and retains at most one hundred records', () => {
    const input = Object.fromEntries(Array.from({ length: 105 }, (_, index) => [`opp:${index}`, ['check-1', 'bad', 'check-1']]));
    const normalized = normalizeOpportunityReviewState(input);
    expect(Object.keys(normalized)).toHaveLength(100);
    expect(normalized['opp:104']).toEqual(['check-1']);
    expect(normalizeOpportunityReviewState([])).toEqual({});
  });
});
