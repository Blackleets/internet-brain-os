import { describe, expect, it } from 'vitest';
import { missionTimeline, presentMission } from './mission-presentation.js';

describe('mission presentation', () => {
  it('derives an auditable timeline only from persisted timestamps', () => {
    const timeline = missionTimeline({ createdAt: '2026-07-22T10:00:00.000Z', claimedAt: '2026-07-22T10:01:00.000Z', completedAt: '2026-07-22T10:02:00.000Z', attempt: 1, resultSummary: { received: 4, evidenceCreated: 4, opportunitiesPromoted: 2 } });
    expect(timeline.map((event) => event.label)).toEqual(['Commission authorized', 'Hermes claimed attempt 1', 'Kernel verification completed']);
    expect(timeline[2].detail).toBe('4 received · 4 Evidence · 2 promoted');
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
  });

  it('fails closed for impossible result counts', () => {
    expect(presentMission({ status: 'completed', resultSummary: { received: 99, evidenceCreated: -1, opportunitiesPromoted: 'bad' } })).toMatchObject({ received: 0, evidenceCreated: 0, opportunitiesPromoted: 0 });
  });
});
