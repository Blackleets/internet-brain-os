import { describe, expect, it } from 'vitest';
import { assessLivePublicWebJourney, LIVE_PUBLIC_WEB_CHECK_IDS } from './hermes-live-journey-assessment.mjs';

function fixture(overrides = {}) {
  const goalId = 'goal:live';
  const mission = {
    id: 'mission:live',
    goalId,
    status: 'completed',
    executionPhase: 'forged',
    attempt: 1,
    resultSummary: { received: 2, evidenceCreated: 1, opportunitiesPromoted: 1 },
    searchCandidates: [
      { id: 'search-candidate:a', url: 'https://tool.example/a', title: 'Tool A', snippet: 'search snippet', status: 'verified', evidenceId: 'evidence:a', sourceUrl: 'https://tool.example/a' },
      { id: 'search-candidate:b', url: 'https://tool.example/b', title: 'Tool B', snippet: 'other snippet', status: 'verification_failed' },
    ],
    verificationResults: [
      { candidateId: 'search-candidate:a', status: 'verified', sourceUrl: 'https://tool.example/a', evidenceId: 'evidence:a', supported: true },
      { candidateId: 'search-candidate:b', status: 'verification_failed', reason: 'blocked upstream', supported: false },
    ],
  };
  const opportunities = [{
    id: 'opportunity:a', caseId: 'case:a', evidenceId: 'evidence:a', sourceUrl: 'https://tool.example/a',
    supported: true,
    goalMatches: [{ goalId, title: 'Live Goal', score: 90, reasons: ['tool'] }],
  }];
  const caseDetails = [{
    case: { id: 'case:a' },
    evidence: [{
      id: 'evidence:a', caseId: 'case:a', missionId: 'mission:live', candidateId: 'search-candidate:a',
      sourceUrl: 'https://tool.example/a', sourceReceiptId: 'web-read:abc', extractionMethod: 'kernel-web-read-v1',
      rawText: 'Fetched public page content from the independent Kernel reader.',
      contentHash: 'a'.repeat(64),
    }],
  }];
  const surface = {
    schemaVersion: 'efesto.goal-surface.v1', sourceOfTruth: 'kernel',
    goal: { id: goalId }, mission: { id: 'mission:live', workState: 'forged' },
  };
  return { goalId, mission, opportunities, caseDetails, surface, ...overrides };
}

describe('authentic live public-web journey assessment', () => {
  it('requires Candidate -> Kernel Evidence -> Goal-linked Find -> Shared Goal Truth provenance', () => {
    const checks = assessLivePublicWebJourney(fixture());
    expect(checks.map(({ id }) => id)).toEqual(LIVE_PUBLIC_WEB_CHECK_IDS);
    expect(checks.every(({ passed }) => passed)).toBe(true);
  });

  it('L5 check name requires Kernel SUPPORT and never equates promotion with a Find', () => {
    const l5 = assessLivePublicWebJourney(fixture()).find(({ id }) => id === 'L5');
    expect(l5?.name).toMatch(/Kernel SUPPORT/i);
    expect(l5?.name).not.toMatch(/promot/i);
  });

  it('L6 check name requires Kernel SUPPORT Find provenance (Evidence alone is not a Find)', () => {
    const l6 = assessLivePublicWebJourney(fixture()).find(({ id }) => id === 'L6');
    expect(l6?.name).toMatch(/Kernel SUPPORT/i);
    expect(l6?.name).not.toMatch(/^Find provenance/i);
  });

  it('L7 check name admits forged or honest blocked verifying (never forged-only)', () => {
    const l7 = assessLivePublicWebJourney(fixture()).find(({ id }) => id === 'L7');
    expect(l7?.name).toMatch(/honestly blocked verifying/i);
    expect(l7?.name).not.toMatch(/converged on the forged Mission from the same Kernel state/i);
  });

  it('admits an honest blocked investigation that kept Evidence without Completado', () => {
    const data = fixture();
    const checks = assessLivePublicWebJourney({
      ...data,
      mission: {
        ...data.mission,
        status: 'running',
        executionPhase: 'verifying',
        verificationResults: data.mission.verificationResults.map((item) => (
          item.status === 'verified' ? { ...item, supported: false } : item
        )),
      },
      opportunities: data.opportunities.map((item) => ({ ...item, supported: false })),
      surface: {
        ...data.surface,
        mission: { id: 'mission:live', workState: 'verifying' },
      },
    });
    expect(checks.map(({ id }) => id)).toEqual(LIVE_PUBLIC_WEB_CHECK_IDS);
    // Evidence path stays honest (L3/L4/L7); L5/L6 must not invent Finds without SUPPORT.
    expect(checks.filter(({ id }) => ['L3', 'L4', 'L7'].includes(id)).every(({ passed }) => passed)).toBe(true);
    expect(checks.find(({ id }) => id === 'L5')).toMatchObject({ passed: false });
    expect(checks.find(({ id }) => id === 'L6')).toMatchObject({ passed: false });
  });

  it('does not invent L5 Finds from opportunitiesPromoted without Kernel SUPPORT', () => {
    const data = fixture();
    const checks = assessLivePublicWebJourney({
      ...data,
      mission: {
        ...data.mission,
        resultSummary: { received: 2, evidenceCreated: 1, opportunitiesPromoted: 9 },
        verificationResults: data.mission.verificationResults.map((item) => (
          item.status === 'verified' ? { ...item, supported: false } : item
        )),
      },
      opportunities: data.opportunities.map((item) => ({ ...item, supported: false })),
    });
    expect(checks.find(({ id }) => id === 'L5')).toMatchObject({ passed: false });
    expect(checks.find(({ id }) => id === 'L6')).toMatchObject({ passed: false });
    expect(checks.find(({ id }) => id === 'L5')?.detail).not.toMatch(/opportunitiesPromoted=/);
  });

  it('does not treat goal-linked Evidence+URL alone as a SUPPORT Find for L5', () => {
    const data = fixture();
    const checks = assessLivePublicWebJourney({
      ...data,
      mission: {
        ...data.mission,
        verificationResults: [
          { candidateId: 'search-candidate:a', status: 'verified', sourceUrl: 'https://tool.example/a', evidenceId: 'evidence:a' },
        ],
      },
      opportunities: [{
        id: 'opportunity:a', caseId: 'case:a', evidenceId: 'evidence:a', sourceUrl: 'https://tool.example/a',
        goalMatches: [{ goalId: data.goalId, title: 'Live Goal', score: 90, reasons: ['tool'] }],
      }],
    });
    expect(checks.find(({ id }) => id === 'L5')).toMatchObject({ passed: false });
    expect(checks.find(({ id }) => id === 'L6')).toMatchObject({ passed: false });
  });

  it('does not mistake a terminal mission with no useful provenance for live product value', () => {
    const data = fixture();
    const checks = assessLivePublicWebJourney({
      ...data,
      mission: { ...data.mission, resultSummary: { received: 0, evidenceCreated: 0, opportunitiesPromoted: 0 }, searchCandidates: [], verificationResults: [] },
      opportunities: [],
      caseDetails: [],
    });
    expect(checks.filter(({ id }) => ['L3', 'L4', 'L5', 'L6'].includes(id)).every(({ passed }) => !passed)).toBe(true);
    expect(checks.find(({ id }) => id === 'L7')?.passed).toBe(true);
  });

  it('rejects agent-like text that lacks Kernel web.read Evidence provenance', () => {
    const data = fixture();
    const caseDetails = [{
      case: { id: 'case:a' },
      evidence: [{
        id: 'evidence:a', caseId: 'case:a', missionId: 'mission:live', candidateId: 'search-candidate:a',
        sourceUrl: 'https://tool.example/a', rawText: 'search snippet', contentHash: 'a'.repeat(64),
        extractionMethod: 'agent-summary', sourceReceiptId: 'agent:hermes',
      }],
    }];
    const checks = assessLivePublicWebJourney({ ...data, caseDetails });
    expect(checks.find(({ id }) => id === 'L6')).toMatchObject({ passed: false });
  });

  it('requires a Find to match the exact tested Goal rather than any opportunity in the store', () => {
    const data = fixture();
    const opportunities = data.opportunities.map((item) => ({ ...item, goalMatches: [{ goalId: 'goal:other' }] }));
    const checks = assessLivePublicWebJourney({ ...data, opportunities });
    expect(checks.find(({ id }) => id === 'L5')).toMatchObject({ passed: false });
    expect(checks.find(({ id }) => id === 'L6')).toMatchObject({ passed: false });
  });

  it('fails closed when Shared Goal Truth diverges from the tested mission', () => {
    const data = fixture();
    const checks = assessLivePublicWebJourney({
      ...data,
      surface: { ...data.surface, sourceOfTruth: 'client', mission: { id: 'mission:other', workState: 'queued' } },
    });
    expect(checks.find(({ id }) => id === 'L7')).toMatchObject({ passed: false });
  });
});
