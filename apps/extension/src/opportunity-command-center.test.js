import { describe, expect, it } from 'vitest';
import { buildOpportunityCommandCenter } from './opportunity-command-center.js';

const drill = {
  id: 'opp:1',
  title: 'Taladro Bosch 21 EUR',
  evidenceId: 'ev-1',
  caseId: 'case-1',
  sourceUrl: 'https://shop.example/drill',
  sourceHost: 'shop.example',
  category: 'offer',
  categoryLabel: 'Offer',
  relevance: 76,
  personalizedRelevance: 91,
  deadlineText: 'August 14',
  goalMatches: [{ title: 'Fund Efesto' }],
  nextAction: 'Review eligibility',
  supported: true,
};

describe('Opportunity Command Center', () => {
  it('preserves Kernel ordering and explains the first supported Find', () => {
    const center = buildOpportunityCommandCenter([
      drill,
      { ...drill, id: 'opp:2', title: 'Remote role', relevance: 82, personalizedRelevance: 84, deadlineText: undefined, goalMatches: undefined, nextAction: undefined },
    ]);

    expect(center.lead).toMatchObject({ id: 'opp:1', position: 1, objectiveRelevance: 76, personalizedRelevance: 91, verificationLabel: 'Kernel SUPPORT' });
    expect(center.lead.reasons).toEqual([
      'Matches Goal: Fund Efesto',
      'Deadline text detected; confirm it at the source',
      'Strong objective Evidence relevance',
    ]);
    expect(center.queue.map((item) => item.id)).toEqual(['opp:1', 'opp:2']);
  });

  it('does not present snippet-only or unsupported opportunities as Finds', () => {
    const snippet = { id: 'opp:snippet', title: 'Hermes snippet drill', relevance: 99 };
    const jwt = { id: 'opp:jwt', title: 'JWT debugger', sourceHost: 'jwt.io', sourceUrl: 'https://jwt.io/', evidenceId: 'ev-jwt', relevance: 90 };
    const unsupported = { ...drill, id: 'opp:url', supported: undefined };
    const center = buildOpportunityCommandCenter([snippet, jwt, unsupported]);
    expect(center).toEqual({ lead: undefined, queue: [], objectiveCount: 0, goalLinkedCount: 0, deadlineCount: 0 });
  });

  it('accepts mission verificationResults SUPPORT without item.supported', () => {
    const item = { ...drill, id: 'opp:mission', supported: undefined };
    const missions = [{ id: 'mission-1', verificationResults: [{ evidenceId: 'ev-1', supported: true }] }];
    const center = buildOpportunityCommandCenter([item], missions);
    expect(center.lead).toMatchObject({ id: 'opp:mission', verificationLabel: 'Kernel SUPPORT' });
  });

  it('summarizes only observable fields and provides a cautious fallback action', () => {
    const center = buildOpportunityCommandCenter([{ ...drill, relevance: 0, personalizedRelevance: 0, deadlineText: undefined, goalMatches: undefined, nextAction: undefined }]);
    expect(center).toMatchObject({ objectiveCount: 0, goalLinkedCount: 0, deadlineCount: 0 });
    expect(center.lead.reasons).toEqual(['Highest current position in your private Inbox']);
    expect(center.lead.nextAction).toContain('verify the details independently');
    expect(center.lead.verificationLabel).toBe('Kernel SUPPORT');
  });

  it('bounds malformed values and caps the visible action queue', () => {
    const center = buildOpportunityCommandCenter(Array.from({ length: 7 }, (_, index) => ({
      ...drill,
      id: `opp:${index}`,
      relevance: 500,
      personalizedRelevance: -20,
    })));
    expect(center.queue).toHaveLength(5);
    expect(center.lead).toMatchObject({ objectiveRelevance: 99, personalizedRelevance: 0, verificationLabel: 'Kernel SUPPORT' });
  });

  it('returns an honest empty state', () => {
    expect(buildOpportunityCommandCenter()).toEqual({ lead: undefined, queue: [], objectiveCount: 0, goalLinkedCount: 0, deadlineCount: 0 });
  });
});
