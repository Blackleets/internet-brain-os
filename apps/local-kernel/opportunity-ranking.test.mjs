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
  sourceUrl: 'https://example.com/drill',
  relevance: 80,
  detectedAt: '2026-08-08T14:00:00.000Z',
  supported: true,
};

function withoutSupport(overrides = {}) {
  const { supported: _supported, ...rest } = { ...base, ...overrides };
  return rest;
}

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

  test('evidenceId and caseId without Kernel SUPPORT do not get provenance credit', () => {
    const unsupported = rankOpportunity(withoutSupport(), { now });
    const none = rankOpportunity({ ...withoutSupport(), evidenceId: undefined, caseId: undefined }, { now });
    expect(unsupported.components.evidenceStrength).toBe(25);
    expect(unsupported.components.evidenceStrength).toBe(none.components.evidenceStrength);
    expect(unsupported.reasons).not.toContain('Case and Evidence provenance available');
  });

  test('unsupported Evidence+URL must not outrank an otherwise identical supported Find', () => {
    const unsupported = rankOpportunity(withoutSupport({ sourceUrl: 'https://jwt.io/' }), { now });
    const supportedFind = rankOpportunity(base, { now });
    expect(unsupported.score).toBeLessThan(supportedFind.score);
    expect(unsupported.components.evidenceStrength).toBeLessThan(supportedFind.components.evidenceStrength);
    expect(supportedFind.components.evidenceStrength).toBe(99);
  });

  test('mission verificationResults SUPPORT grants provenance credit without opportunity.supported', () => {
    const item = withoutSupport();
    const missions = [{
      id: 'mission:1',
      verificationResults: [{ evidenceId: 'evidence:1', supported: true }],
    }];
    const ranked = rankOpportunity(item, { now, missions });
    expect(ranked.components.evidenceStrength).toBe(99);
    expect(ranked.reasons).toContain('Case and Evidence provenance available');
  });

  test('verificationResults without supported === true or matching evidenceId do not grant provenance', () => {
    const item = withoutSupport();
    const rejected = rankOpportunity(item, {
      now,
      missions: [{ verificationResults: [{ evidenceId: 'evidence:1', supported: false }] }],
    });
    const otherId = rankOpportunity(item, {
      now,
      missions: [{ verificationResults: [{ evidenceId: 'evidence:other', supported: true }] }],
    });
    expect(rejected.components.evidenceStrength).toBe(25);
    expect(otherId.components.evidenceStrength).toBe(25);
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

  test('projector list does not credit unsupported Evidence+URL over a supported Find', async () => {
    const unsupported = withoutSupport({
      id: 'opportunity:jwt',
      title: 'JWT debugger',
      sourceHost: 'jwt.io',
      sourceUrl: 'https://jwt.io/',
    });
    const data = {
      opportunities: [unsupported, { ...base, id: 'opportunity:supported-find' }],
      goals: [],
      preferenceFeedback: [],
      agentMissions: [],
    };
    const projector = new OpportunityProjector({ read: async () => structuredClone(data) });
    const ranked = await projector.list({ now });
    expect(ranked[0].id).toBe('opportunity:supported-find');
    expect(ranked[0].ranking.components.evidenceStrength).toBe(99);
    expect(ranked.find((item) => item.id === 'opportunity:jwt').ranking.components.evidenceStrength).toBe(25);
  });
});
