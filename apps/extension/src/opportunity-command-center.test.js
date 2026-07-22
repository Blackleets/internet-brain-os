import { describe, expect, it } from 'vitest';
import { buildOpportunityCommandCenter } from './opportunity-command-center.js';

describe('Opportunity Command Center', () => {
  it('preserves Kernel ordering and explains the first lead without inventing confidence', () => {
    const center = buildOpportunityCommandCenter([
      { id: 'opp:1', title: 'AI grant', relevance: 76, personalizedRelevance: 91, deadlineText: 'August 14', goalMatches: [{ title: 'Fund Efesto' }], nextAction: 'Review eligibility' },
      { id: 'opp:2', title: 'Remote role', relevance: 82, personalizedRelevance: 84 },
    ]);

    expect(center.lead).toMatchObject({ id: 'opp:1', position: 1, objectiveRelevance: 76, personalizedRelevance: 91, verificationLabel: 'Unverified lead' });
    expect(center.lead.reasons).toEqual([
      'Matches Goal: Fund Efesto',
      'Deadline text detected; confirm it at the source',
      'Strong objective Evidence relevance',
    ]);
    expect(center.queue.map((item) => item.id)).toEqual(['opp:1', 'opp:2']);
  });

  it('summarizes only observable fields and provides a cautious fallback action', () => {
    const center = buildOpportunityCommandCenter([{ title: 'Useful tool', relevance: 0 }]);
    expect(center).toMatchObject({ objectiveCount: 0, goalLinkedCount: 0, deadlineCount: 0 });
    expect(center.lead.reasons).toEqual(['Highest current position in your private Inbox']);
    expect(center.lead.nextAction).toContain('verify the details independently');
  });

  it('bounds malformed values and caps the visible action queue', () => {
    const center = buildOpportunityCommandCenter(Array.from({ length: 7 }, (_, index) => ({ id: `opp:${index}`, relevance: 500, personalizedRelevance: -20 })));
    expect(center.queue).toHaveLength(5);
    expect(center.lead).toMatchObject({ objectiveRelevance: 99, personalizedRelevance: 0 });
  });

  it('returns an honest empty state', () => {
    expect(buildOpportunityCommandCenter()).toEqual({ lead: undefined, queue: [], objectiveCount: 0, goalLinkedCount: 0, deadlineCount: 0 });
  });
});
