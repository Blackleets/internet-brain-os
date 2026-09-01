import { describe, expect, it } from 'vitest';
import { isKernelSupportedFind, kernelSupportedFinds } from './supported-find';
import type { OpportunitySummary } from './contracts';

const supported: OpportunitySummary = {
  id: 'opp-supported',
  title: 'Taladro Bosch 21 EUR',
  category: 'offer',
  categoryLabel: 'Offer',
  benefitType: 'savings',
  sourceHost: 'shop.example',
  relevance: 80,
  nextAction: 'Verify terms, price and source',
  status: 'new',
  detectedAt: '2026-09-02T00:00:00.000Z',
  evidenceId: 'ev-1',
  caseId: 'case-1',
  sourceUrl: 'https://shop.example/drill',
};

function opportunity(overrides: Partial<OpportunitySummary> = {}): OpportunitySummary {
  return { ...supported, ...overrides };
}

describe('kernelSupportedFinds', () => {
  it('keeps Kernel Evidence-backed Finds with title, sourceUrl and evidenceId', () => {
    expect(isKernelSupportedFind(supported)).toBe(true);
    expect(kernelSupportedFinds([supported]).map((item) => item.id)).toEqual(['opp-supported']);
  });

  it('fail-closes Hermes snippet-only rows without Evidence provenance', () => {
    const snippet = opportunity({
      id: 'opp-snippet',
      title: 'Hermes snippet drill',
      evidenceId: undefined,
      caseId: undefined,
      sourceUrl: undefined,
    });
    expect(isKernelSupportedFind(snippet)).toBe(false);
    expect(kernelSupportedFinds([snippet, supported])).toEqual([supported]);
  });

  it('rejects dismissed Finds and non-http sourceUrl', () => {
    expect(isKernelSupportedFind(opportunity({ status: 'dismissed' }))).toBe(false);
    expect(isKernelSupportedFind(opportunity({ sourceUrl: 'javascript:alert(1)' }))).toBe(false);
    expect(isKernelSupportedFind(opportunity({ sourceUrl: 'not-a-url' }))).toBe(false);
  });
});
