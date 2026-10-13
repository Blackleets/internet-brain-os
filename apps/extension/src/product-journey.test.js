import { describe, expect, it } from 'vitest';
import { missionJourney, newestMission, onboardingJourney } from './product-journey.js';

describe('Efesto product journey', () => {
  it('selects the newest mission regardless of transport ordering', () => {
    expect(newestMission([{ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' }, { id: 'new', createdAt: '2026-02-01T00:00:00.000Z' }])?.id).toBe('new');
  });

  it('maps persisted mission state to honest named stages', () => {
    expect(missionJourney({ status: 'running' }).stages.map((stage) => stage.state)).toEqual(['complete', 'active', 'pending', 'pending']);
    expect(missionJourney({ status: 'running', executionPhase: 'verifying' }).stages.map((stage) => stage.state)).toEqual(['complete', 'complete', 'active', 'pending']);
    expect(missionJourney({ status: 'completed' }).stages.map((stage) => stage.state)).toEqual(['complete', 'complete', 'complete', 'pending']);
    expect(missionJourney({ status: 'failed', attempt: 2 }).stages[2].state).toBe('error');
  });

  it('does not complete Forged stage for zero-SUPPORT forged missions', () => {
    // popup.js → renderMissionProgress → missionJourney; Living Forge already says Research completed.
    const emptyPhase = missionJourney({ status: 'completed', executionPhase: 'forged' });
    expect(emptyPhase.stages.map((stage) => stage.state)).toEqual(['complete', 'complete', 'complete', 'pending']);
    expect(emptyPhase.stages.find((stage) => stage.id === 'forged')?.state).toBe('pending');

    const emptyWork = missionJourney({
      status: 'completed',
      workState: 'forged',
      resultSummary: { opportunitiesPromoted: 3 },
      verificationResults: [{ evidenceId: 'ev-1', supported: false }],
    });
    expect(emptyWork.stages.map((stage) => stage.state)).toEqual(['complete', 'complete', 'complete', 'pending']);

    const missingCount = missionJourney({ status: 'completed', executionPhase: 'forged', findCount: undefined });
    expect(missingCount.stages.find((stage) => stage.id === 'forged')?.state).toBe('pending');
  });

  it('completes Forged stage only when Kernel SUPPORT Finds are proven', () => {
    const supported = missionJourney({
      status: 'completed',
      executionPhase: 'forged',
      verificationResults: [
        { evidenceId: 'ev-1', supported: true },
        { evidenceId: 'ev-2', supported: false },
      ],
    });
    expect(supported.stages.every((stage) => stage.state === 'complete')).toBe(true);

    const workState = missionJourney({
      status: 'completed',
      workState: 'forged',
      verificationResults: [{ evidenceId: 'ev-1', supported: true }],
    });
    expect(workState.stages.every((stage) => stage.state === 'complete')).toBe(true);

    // GoalSurface missions strip verificationResults and expose SUPPORT as findCount.
    const surface = missionJourney({ status: 'completed', executionPhase: 'forged', findCount: 2 });
    expect(surface.stages.every((stage) => stage.state === 'complete')).toBe(true);
    expect(missionJourney({ status: 'completed', executionPhase: 'forged', findCount: 0 }).stages.find((s) => s.id === 'forged')?.state).toBe('pending');
  });

  it('Kernel verified_without_support keeps Verification complete — never error chrome', () => {
    // popup.js → renderMissionProgress → missionJourney (#mission-progress).
    // Same settlement as mission card / orb / watchtower: pages read → Evidence, none SUPPORT.
    const settled = missionJourney({
      status: 'failed',
      executionPhase: 'failed',
      attempt: 1,
      lastFailure: { code: 'verified_without_support', reason: 'Kernel web.read read 2 pages; none supports the Goal' },
      verificationResults: [
        { candidateId: 'a', status: 'verified', evidenceId: 'evidence:a', supported: false },
        { candidateId: 'b', status: 'verified', evidenceId: 'evidence:b', supported: false },
      ],
    });
    expect(settled.stages.map((stage) => stage.state)).toEqual(['complete', 'complete', 'complete', 'pending']);
    expect(settled.stages.find((stage) => stage.id === 'verification')?.state).toBe('complete');
    expect(settled.stages.find((stage) => stage.id === 'verification')?.state).not.toBe('error');
    expect(settled.stages.find((stage) => stage.id === 'forged')?.state).toBe('pending');
    expect(settled.stages.some((stage) => stage.state === 'error')).toBe(false);

    // Contradictory SUPPORT row under the settlement code stays bare failed attention.
    const contradicted = missionJourney({
      status: 'failed',
      attempt: 2,
      lastFailure: { code: 'verified_without_support' },
      verificationResults: [{ candidateId: 'a', status: 'verified', supported: true }],
    });
    expect(contradicted.stages.find((stage) => stage.id === 'verification')?.state).toBe('error');

    // web_read_failed / bare failed stay Verification error (nothing honest finished).
    expect(missionJourney({
      status: 'failed',
      attempt: 2,
      lastFailure: { code: 'web_read_failed' },
      verificationResults: [{ candidateId: 'a', status: 'verification_failed' }],
    }).stages.find((stage) => stage.id === 'verification')?.state).toBe('error');
  });

  it('guides the user to the first unfinished product action', () => {
    expect(onboardingJourney({ connected: true, goalCount: 1 }).next).toMatchObject({ id: 'radar', view: 'forge' });
    expect(onboardingJourney({ connected: true, goalCount: 1, radarEnabled: true, findCount: 1 }).complete).toBe(true);
  });

  it('fail-closes onboarding Find step to Kernel SUPPORT, not bare useful find', () => {
    const findStep = onboardingJourney({ connected: true, goalCount: 1, radarEnabled: true }).next;
    expect(findStep).toMatchObject({ id: 'find', view: 'finds' });
    expect(findStep.label).toContain('Kernel SUPPORT');
    expect(findStep.label).not.toContain('useful find');
  });
});
