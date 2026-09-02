import { describe, expect, it } from 'vitest';
import { isKernelSupportedFind, kernelSupportedFinds, presentFind } from './find-presentation.js';

const drill = {
  id: 'opp-drill',
  title: 'Taladro Bosch 21 EUR',
  evidenceId: 'ev-1',
  caseId: 'case-1',
  sourceUrl: 'https://shop.example/drill',
  sourceHost: 'shop.example',
  relevance: 80,
  supported: true,
};

function missionWithSupport(evidenceId, supported) {
  return {
    id: 'mission-1',
    verificationResults: [{ candidateId: 'cand-1', evidenceId, supported }],
  };
}

describe('Find presentation', () => {
  it('keeps objective relevance separate from personalized ordering and verification', () => {
    const result = presentFind({ relevance: 72, personalizedRelevance: 91, reasons: ['grant', 'apply now'] });
    expect(result).toMatchObject({ objectiveRelevance: 72, personalizedRelevance: 91, verificationLabel: 'Unverified lead', reasons: ['grant', 'apply now'] });
  });

  it('derives cautious guidance without claiming the source is safe', () => {
    const result = presentFind({ benefitType: 'income', deadlineText: 'Friday', evidenceId: 'evidence:123' });
    expect(result.evidenceId).toBe('evidence:123');
    expect(result.verificationLabel).toBe('Unverified lead');
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

  it('keeps Evidence+URL without SUPPORT as unverified, not a Kernel Find', () => {
    const item = { ...drill, supported: undefined };
    expect(isKernelSupportedFind(item)).toBe(false);
    expect(presentFind(item).verificationLabel).toBe('Unverified lead');
  });

  it('labels Kernel SUPPORT Finds with existing product copy', () => {
    expect(isKernelSupportedFind(drill)).toBe(true);
    expect(presentFind(drill).verificationLabel).toBe('Kernel SUPPORT');
  });

  it('accepts mission verificationResults SUPPORT for matching evidenceId', () => {
    const item = { ...drill, supported: undefined };
    const missions = [missionWithSupport('ev-1', true)];
    expect(isKernelSupportedFind(item, missions)).toBe(true);
    expect(presentFind(item, missions).verificationLabel).toBe('Kernel SUPPORT');
  });

  it('rejects verificationResults that are not supported or for another evidenceId', () => {
    const item = { ...drill, supported: undefined };
    expect(isKernelSupportedFind(item, [missionWithSupport('ev-1', false)])).toBe(false);
    expect(isKernelSupportedFind(item, [missionWithSupport('ev-other', true)])).toBe(false);
    expect(presentFind(item, [missionWithSupport('ev-1', false)]).verificationLabel).toBe('Unverified lead');
  });

  it('does not mint a Find from a Hermes snippet or jwt.io snippet-only row', () => {
    const snippet = { id: 'opp-snippet', title: 'Hermes snippet drill', supported: true };
    const jwt = { id: 'opp-jwt', title: 'JWT debugger', sourceHost: 'jwt.io', sourceUrl: 'https://jwt.io/', supported: true };
    expect(isKernelSupportedFind(snippet)).toBe(false);
    expect(isKernelSupportedFind(jwt)).toBe(false);
    expect(presentFind(snippet).verificationLabel).toBe('Unverified lead');
    expect(presentFind(jwt).verificationLabel).toBe('Unverified lead');
    expect(kernelSupportedFinds([snippet, jwt, drill]).map((item) => item.id)).toEqual(['opp-drill']);
  });

  it('rejects dismissed Finds and non-http sourceUrl even when stamped supported', () => {
    expect(isKernelSupportedFind({ ...drill, status: 'dismissed' })).toBe(false);
    expect(isKernelSupportedFind({ ...drill, sourceUrl: 'javascript:alert(1)' })).toBe(false);
    expect(isKernelSupportedFind({ ...drill, sourceUrl: 'not-a-url' })).toBe(false);
  });
});
