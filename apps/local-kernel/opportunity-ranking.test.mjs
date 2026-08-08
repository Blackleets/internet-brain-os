import { describe, expect, test } from 'vitest';
import { rankOpportunity } from './opportunity-ranking.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';

const now = '2026-08-08T15:00:00.000Z';
const base = {
  id: 'opportunity:1',
  evidenceId: 'evidence:1',
  caseId: 'case:1',
  category: 'offer',
  categoryLabel: 'Offer',
  title: 'Cordless drill deal',
  sourceHost: 'example.com',
  relevance: 80,
  detectedAt: '2026-08-08T14:00:00.000Z',
};

describe('rankOpportunity', () => {
  test('strong provenance ranks above an otherwise identical unprovenanced candidate', () => {
    const proven = rankOpportunity(base, { now });
    const weak = rankOpportunity({ ...base, evidenceId: undefined, caseId: undefined }, { now });
    expect(proven.score).toBeGreaterThan(weak.score);
    expect(proven.components.evidenceStrength).toBeGreaterThan(weak.components.evidenceStrength);
  });

  test('fresh evidence ranks above stale evidence', () => {
    const fresh = rankOpportunity(base, { now });
    const stale = rankOpportunity({ ...base, detectedAt: '2026-06-01T00:00:00.000Z' }, { now });
    expect(fresh.score).toBeGreaterThan(stale.score);
  });

  test('only explicit learned adjustment changes the preference component', () => {
    const neutral = rankOpportunity(base, { now, learnedAdjustment: 0 });
    const positive = rankOpportunity(base, { now, learnedAdjustment: 25 });
    const negative = rankOpportunity(base, { now, learnedAdjustment: -25 });
    expect(positive.score).toBeGreaterThan(neutral.score);
    expect(negative.score).toBeLessThan(neutral.score);
  });

  test('ranking never mutates raw classifier relevance', () => {
    const opportunity = { ...base };
    rankOpportunity(opportunity, { now, goalMatches: [{ score: 99 }] });
    expect(opportunity.relevance).toBe(80);
  });
});

describe('OpportunityProjector ranking integration', () => {
  test('the real inbox exposes explainable ranking and uses it for personalizedRelevance', async () => {
    const data = {
      opportunities: [base],
      goals: [{
        id: 'goal:1', title: 'Find drill', categories: ['offer'], keywords: ['drill'], priority: 3, status: 'active', createdAt: now,
      }],
      preferenceFeedback: [],
    };
    const projector = new OpportunityProjector({ read: async () => structuredClone(data) });
    const [result] = await projector.list({ now });
    expect(result.relevance).toBe(80);
    expect(result.ranking.components.evidenceStrength).toBe(99);
    expect(result.personalizedRelevance).toBe(result.ranking.score);
    expect(result.ranking.reasons.length).toBeGreaterThan(0);
  });
});
