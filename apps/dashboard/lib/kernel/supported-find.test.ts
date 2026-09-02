import { describe, expect, it } from 'vitest';
import { isKernelSupportedFind, kernelSupportedFinds } from './supported-find';
import type { MissionSummary, OpportunitySummary } from './contracts';

const evidenceBacked: OpportunitySummary = {
  id: 'opp-evidence',
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
  return { ...evidenceBacked, ...overrides };
}

function missionWithSupport(evidenceId: string, supported: boolean): MissionSummary {
  return {
    id: 'mission-1',
    goalId: 'goal-1',
    status: 'completed',
    createdAt: '2026-09-02T00:00:00.000Z',
    executionPhase: 'forged',
    verificationResults: [
      {
        candidateId: 'cand-1',
        status: 'verified',
        evidenceId,
        supported,
        supportReason: supported ? 'supported' : 'insufficient_term_coverage',
      },
    ],
  };
}

describe('kernelSupportedFinds', () => {
  it('fail-closes Evidence+URL without real SUPPORT proof', () => {
    expect(isKernelSupportedFind(evidenceBacked)).toBe(false);
    expect(kernelSupportedFinds([evidenceBacked])).toEqual([]);
  });

  it('keeps Finds stamped with supported === true', () => {
    const stamped = opportunity({ id: 'opp-supported', supported: true });
    expect(isKernelSupportedFind(stamped)).toBe(true);
    expect(kernelSupportedFinds([stamped]).map((item) => item.id)).toEqual(['opp-supported']);
  });

  it('accepts mission verificationResults SUPPORT for matching evidenceId without item.supported', () => {
    const item = opportunity({ id: 'opp-mission-proof' });
    const missions = [missionWithSupport('ev-1', true)];
    expect(isKernelSupportedFind(item, missions)).toBe(true);
    expect(kernelSupportedFinds([item], missions).map((row) => row.id)).toEqual(['opp-mission-proof']);
  });

  it('rejects mission verificationResults that are not supported', () => {
    const item = opportunity({ id: 'opp-unsupported-mission' });
    expect(isKernelSupportedFind(item, [missionWithSupport('ev-1', false)])).toBe(false);
    expect(isKernelSupportedFind(item, [missionWithSupport('ev-other', true)])).toBe(false);
  });

  it('fail-closes Hermes snippet-only rows without Evidence provenance', () => {
    const snippet = opportunity({
      id: 'opp-snippet',
      title: 'Hermes snippet drill',
      evidenceId: undefined,
      caseId: undefined,
      sourceUrl: undefined,
      supported: true,
    });
    expect(isKernelSupportedFind(snippet)).toBe(false);
    expect(kernelSupportedFinds([snippet, opportunity({ supported: true })])).toEqual([
      opportunity({ supported: true }),
    ]);
  });

  it('rejects dismissed Finds and non-http sourceUrl even when stamped supported', () => {
    expect(isKernelSupportedFind(opportunity({ status: 'dismissed', supported: true }))).toBe(false);
    expect(isKernelSupportedFind(opportunity({ sourceUrl: 'javascript:alert(1)', supported: true }))).toBe(false);
    expect(isKernelSupportedFind(opportunity({ sourceUrl: 'not-a-url', supported: true }))).toBe(false);
  });
});
