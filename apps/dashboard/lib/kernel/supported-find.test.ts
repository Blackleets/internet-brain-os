import { describe, expect, it } from 'vitest';
import { countMissionKernelSupportedFinds, isKernelSupportedFind, kernelSupportedFinds, missionVerifiedWithoutSupport } from './supported-find';
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

describe('countMissionKernelSupportedFinds', () => {
  it('counts focused-mission verificationResults SUPPORT only', () => {
    expect(countMissionKernelSupportedFinds(missionWithSupport('ev-1', true))).toBe(1);
    expect(countMissionKernelSupportedFinds(missionWithSupport('ev-1', false))).toBe(0);
    expect(countMissionKernelSupportedFinds(undefined)).toBe(0);
    expect(countMissionKernelSupportedFinds({ verificationResults: null })).toBe(0);
  });

  it('uses GoalSurface findCount when verificationResults are stripped', () => {
    // focusedGoalSurface.mission never carries verificationResults — only findCount
    // (Kernel SUPPORT total from Shared Goal Truth). Must not always read as 0.
    expect(countMissionKernelSupportedFinds({ id: 'mission-1', findCount: 2 })).toBe(2);
    expect(countMissionKernelSupportedFinds({ id: 'mission-1', findCount: 0 })).toBe(0);
    expect(countMissionKernelSupportedFinds({ id: 'mission-1' })).toBe(0);
    expect(countMissionKernelSupportedFinds({ findCount: -1 })).toBe(0);
    expect(countMissionKernelSupportedFinds({ findCount: 1.5 })).toBe(0);
    // verificationResults wins when present (do not double-count findCount).
    expect(countMissionKernelSupportedFinds({
      findCount: 99,
      verificationResults: [{ supported: true }, { supported: false }],
    })).toBe(1);
  });
});

describe('missionVerifiedWithoutSupport (honest-blocked verifying)', () => {
  const verifying = { id: 'm', goalId: 'g', status: 'running', executionPhase: 'verifying', createdAt: '2026-09-02T00:00:00.000Z' } as const;

  it('is true once a verified page failed SUPPORT and none passed', () => {
    expect(missionVerifiedWithoutSupport({ ...verifying, verificationResults: [
      { candidateId: 'c1', status: 'verified', evidenceId: 'ev-1', supported: false },
      { candidateId: 'c2', status: 'verification_failed', reason: 'fetch_failed' },
    ] })).toBe(true);
    // GoalSurface strips rows; findCount 0 is only projected after verification.
    expect(missionVerifiedWithoutSupport({ workState: 'verifying', findCount: 0 })).toBe(true);
  });

  it('stays false while verification is pending, retryable, supported or not verifying', () => {
    expect(missionVerifiedWithoutSupport({ ...verifying })).toBe(false);
    expect(missionVerifiedWithoutSupport({ workState: 'verifying' })).toBe(false);
    expect(missionVerifiedWithoutSupport({ ...verifying, verificationResults: [] })).toBe(false);
    expect(missionVerifiedWithoutSupport({ ...verifying, verificationResults: [
      { candidateId: 'c1', status: 'verification_failed', reason: 'fetch_failed' },
    ] })).toBe(false);
    expect(missionVerifiedWithoutSupport({ ...verifying, verificationResults: [
      { candidateId: 'c1', status: 'verified', supported: false },
      { candidateId: 'c2', status: 'verified', supported: true },
    ] })).toBe(false);
    expect(missionVerifiedWithoutSupport({ workState: 'verifying', findCount: 1 })).toBe(false);
    expect(missionVerifiedWithoutSupport({ workState: 'forged', findCount: 0 })).toBe(false);
    expect(missionVerifiedWithoutSupport({ workState: 'investigating', verificationResults: [{ status: 'verified', supported: false }] })).toBe(false);
    expect(missionVerifiedWithoutSupport(undefined)).toBe(false);
  });
});
