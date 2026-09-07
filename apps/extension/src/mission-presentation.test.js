import { describe, expect, it } from 'vitest';
import { missionTimeline, presentMission } from './mission-presentation.js';

describe('mission presentation', () => {
  it('derives an auditable timeline only from persisted timestamps', () => {
    const timeline = missionTimeline({
      status: 'completed',
      executionPhase: 'forged',
      forgedAt: '2026-07-22T10:02:00.000Z',
      createdAt: '2026-07-22T10:00:00.000Z',
      claimedAt: '2026-07-22T10:01:00.000Z',
      completedAt: '2026-07-22T10:02:00.000Z',
      attempt: 1,
      resultSummary: { received: 4, evidenceCreated: 4, opportunitiesPromoted: 2 },
      verificationResults: [
        { evidenceId: 'ev-1', supported: true },
        { evidenceId: 'ev-2', supported: true },
      ],
    });
    expect(timeline.map((event) => event.label)).toEqual(['Commission authorized', 'Hermes claimed attempt 1', 'Kernel verification completed']);
    expect(timeline[2].detail).toBe('4 received · 4 Evidence · 2 Finds');
  });

  it('does not claim Kernel verification completed without forge', () => {
    const timeline = missionTimeline({
      status: 'completed',
      createdAt: '2026-07-22T10:00:00.000Z',
      claimedAt: '2026-07-22T10:01:00.000Z',
      completedAt: '2026-07-22T10:02:00.000Z',
      attempt: 1,
      resultSummary: { received: 0, evidenceCreated: 0, opportunitiesPromoted: 0 },
    });
    expect(timeline.map((event) => event.label)).toEqual(['Commission authorized', 'Hermes claimed attempt 1', 'Research ended without Evidence']);
    expect(timeline.map((event) => event.label)).not.toContain('Kernel verification completed');
    expect(timeline[2].detail).toBe('0 received · 0 Evidence · 0 Finds');
  });

  it('separates safe failure guidance from bounded provider detail', () => {
    const view = presentMission({ status: 'failed', attempt: 3, goalTitle: 'Find work', lastFailure: { reason: ' provider\n unavailable '.repeat(30) } });
    expect(view.statusLabel).toBe('Research stopped safely');
    expect(view.statusDetail).toContain('Three bounded attempts');
    expect(view.failureDetail.length).toBeLessThanOrEqual(160);
    expect(view.failureDetail).not.toContain('\n');
  });

  it('presents a persisted verification phase without claiming completion', () => {
    const mission = { status: 'running', executionPhase: 'verifying', verifyingAt: '2026-07-22T10:02:00.000Z' };
    expect(presentMission(mission)).toMatchObject({ statusLabel: 'Verifying returned findings', opportunitiesPromoted: 0 });
    expect(missionTimeline(mission)[0].label).toBe('Kernel verification started');
    expect(missionTimeline(mission)[0].detail).toMatch(/no Kernel SUPPORT Find is sealed yet/i);
    expect(missionTimeline(mission)[0].detail).not.toMatch(/opportunit/i);
  });

  it('verifying Activity ledger must not brand Evidence validation as opportunity', () => {
    const timeline = missionTimeline({
      status: 'running',
      executionPhase: 'verifying',
      verifyingAt: '2026-07-22T10:02:00.000Z',
      createdAt: '2026-07-22T10:00:00.000Z',
    });
    const verifying = timeline.find((event) => event.label === 'Kernel verification started');
    expect(verifying?.detail).toBe('Returned material entered local validation; no Kernel SUPPORT Find is sealed yet.');
    expect(verifying?.detail).not.toMatch(/opportunit/i);
    expect(JSON.stringify(timeline)).not.toMatch(/opportunit/i);
  });

  it('fails closed for impossible result counts', () => {
    expect(presentMission({ status: 'completed', resultSummary: { received: 99, evidenceCreated: -1, opportunitiesPromoted: 'bad' } })).toMatchObject({ received: 0, evidenceCreated: 0, opportunitiesPromoted: 0 });
  });

  it('does not present completed-without-forged as Commission forged', () => {
    const bare = presentMission({ status: 'completed', resultSummary: { received: 3, evidenceCreated: 0, opportunitiesPromoted: 1 } });
    expect(bare.statusLabel).toBe('Research ended without Evidence');
    expect(bare.statusLabel).not.toMatch(/Commission forged|Completado/i);
    expect(bare.statusDetail).not.toMatch(/passed through the local Kernel/i);
  });

  it('does not claim findings passed Kernel when forged without SUPPORT Finds', () => {
    const forgedNoResults = presentMission({ status: 'completed', executionPhase: 'forged' });
    expect(forgedNoResults.statusLabel).toBe('Research completed');
    expect(forgedNoResults.statusLabel).not.toMatch(/Commission forged|Completado/i);
    expect(forgedNoResults.statusDetail).toMatch(/No Find passed Kernel SUPPORT/i);
    expect(forgedNoResults.statusDetail).not.toMatch(/findings passed through the local Kernel/i);

    const forgedWorkState = presentMission({ status: 'completed', workState: 'forged', resultSummary: { opportunitiesPromoted: 3 } });
    expect(forgedWorkState.statusLabel).toBe('Research completed');
    expect(forgedWorkState.statusDetail).not.toMatch(/findings passed/i);

    const unsupported = presentMission({
      status: 'completed',
      executionPhase: 'forged',
      verificationResults: [{ evidenceId: 'ev-1', supported: false }, { evidenceId: 'ev-2' }],
    });
    expect(unsupported.statusLabel).toBe('Research completed');
    expect(unsupported.statusDetail).not.toMatch(/findings passed through the local Kernel/i);

    const supported = presentMission({
      status: 'completed',
      executionPhase: 'forged',
      verificationResults: [{ evidenceId: 'ev-1', supported: true }],
    });
    expect(supported.statusLabel).toBe('Commission forged');
    expect(supported.statusDetail).toMatch(/1 Find passed Kernel SUPPORT/i);
    expect(supported.statusDetail).not.toMatch(/findings passed through the local Kernel/i);

    const supportedMany = presentMission({
      status: 'completed',
      executionPhase: 'forged',
      verificationResults: [
        { evidenceId: 'ev-1', supported: true },
        { evidenceId: 'ev-2', supported: true },
        { evidenceId: 'ev-3', supported: false },
      ],
    });
    expect(supportedMany.statusLabel).toBe('Commission forged');
    expect(supportedMany.statusDetail).toMatch(/2 Finds passed Kernel SUPPORT/i);
    expect(supportedMany.statusDetail).not.toMatch(/findings passed through/i);
  });

  it('does not treat opportunitiesPromoted as Finds without Kernel SUPPORT', () => {
    const promotedOnly = presentMission({
      status: 'completed',
      executionPhase: 'forged',
      forgedAt: '2026-07-22T10:02:00.000Z',
      completedAt: '2026-07-22T10:02:00.000Z',
      resultSummary: { received: 4, evidenceCreated: 4, opportunitiesPromoted: 9 },
    });
    expect(promotedOnly.opportunitiesPromoted).toBe(0);
    expect(promotedOnly.timeline.find((e) => e.label === 'Kernel verification completed')?.detail).toBe('4 received · 4 Evidence · 0 Finds');

    const unsupported = presentMission({
      status: 'completed',
      executionPhase: 'forged',
      forgedAt: '2026-07-22T10:02:00.000Z',
      resultSummary: { received: 2, evidenceCreated: 2, opportunitiesPromoted: 2 },
      verificationResults: [
        { evidenceId: 'ev-1', supported: false },
        { evidenceId: 'ev-2' },
      ],
    });
    expect(unsupported.opportunitiesPromoted).toBe(0);

    const supported = presentMission({
      status: 'completed',
      executionPhase: 'forged',
      forgedAt: '2026-07-22T10:02:00.000Z',
      resultSummary: { received: 3, evidenceCreated: 3, opportunitiesPromoted: 99 },
      verificationResults: [
        { evidenceId: 'ev-1', supported: true },
        { evidenceId: 'ev-2', supported: true },
        { evidenceId: 'ev-3', supported: false },
      ],
    });
    expect(supported.opportunitiesPromoted).toBe(2);
    expect(supported.timeline.at(-1).detail).toBe('3 received · 3 Evidence · 2 Finds');
  });
});
