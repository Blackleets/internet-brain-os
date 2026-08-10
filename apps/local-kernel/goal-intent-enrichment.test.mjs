import { describe, expect, it } from 'vitest';
import { enrichGoalIntent, extractNumericGoalKeywords, inferGoalCategories } from './goal-intent-enrichment.mjs';

describe('Kernel-owned Goal intent enrichment', () => {
  it('infers offer + tool and preserves price bounds for a natural drill Goal', () => {
    const result = enrichGoalIntent({
      title: 'Find a good-quality drill in Spain for €18–€25 from reputable sellers.',
      keywords: ['find', 'good', 'quality', 'drill', 'spain', 'from', 'reputable', 'sellers'],
    });
    expect(result.categories).toEqual(expect.arrayContaining(['offer', 'tool']));
    expect(result.keywords).toEqual(expect.arrayContaining(['drill', 'spain', '18', '25']));
  });

  it('infers job + client for a natural freelance Goal without misclassifying hourly pay as a shopping offer', () => {
    const result = enrichGoalIntent({
      title: 'Find recent remote freelance work matching my skills at $20–$30/hour or more.',
      keywords: ['remote', 'freelance', 'work', 'skills', 'hour'],
    });
    expect(result.categories).toEqual(expect.arrayContaining(['job', 'client']));
    expect(result.categories).not.toContain('offer');
    expect(result.keywords).toEqual(expect.arrayContaining(['20', '30']));
  });

  it('never overrides an explicit supported category even when the title contains other signals', () => {
    const result = enrichGoalIntent({
      title: 'Find a free AI course under $20',
      categories: ['learning'],
      keywords: ['AI'],
    });
    expect(result.categories).toEqual(['learning']);
    expect(result.keywords).toEqual(expect.arrayContaining(['AI', '20']));
  });

  it('does not invent categories for generic text without a supported intent signal', () => {
    expect(inferGoalCategories('Anything please')).toEqual([]);
  });

  it('extracts bounded price/rate numbers without treating one-digit prose numbers as intent', () => {
    expect(extractNumericGoalKeywords('Need 3 options between €18 and 25 EUR, max 19.99')).toEqual(['18', '25', '19.99']);
  });
});
