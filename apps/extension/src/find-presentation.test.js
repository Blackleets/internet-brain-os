import { describe, expect, it } from 'vitest';
import { presentFind } from './find-presentation.js';

describe('Find presentation', () => {
  it('keeps objective relevance separate from personalized ordering and verification', () => {
    const result = presentFind({ relevance: 72, personalizedRelevance: 91, reasons: ['grant', 'apply now'] });
    expect(result).toMatchObject({ objectiveRelevance: 72, personalizedRelevance: 91, verificationLabel: 'Unverified lead', reasons: ['grant', 'apply now'] });
  });

  it('derives cautious guidance without claiming the source is safe', () => {
    const result = presentFind({ benefitType: 'income', deadlineText: 'Friday', evidenceId: 'evidence:123' });
    expect(result.evidenceId).toBe('evidence:123');
    expect(result.cautions).toEqual(expect.arrayContaining([
      expect.stringContaining('independently'),
      expect.stringContaining('not been confirmed'),
      expect.stringContaining('Never pay upfront'),
    ]));
  });

  it('bounds malformed scores and limits displayed reasons', () => {
    const result = presentFind({ relevance: 400, personalizedRelevance: -20, reasons: ['one', '', 'two', 'three', 'four'] });
    expect(result).toMatchObject({ objectiveRelevance: 99, personalizedRelevance: 0, reasons: ['one', 'two', 'three'] });
  });
});
