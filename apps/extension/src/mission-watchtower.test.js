import { describe, expect, it } from 'vitest';
import { markWatchtowerEventsRead, presentWatchtowerAviso, presentWatchtowerBanner, reconcileMissionWatchtower, unreadWatchtowerCount } from './mission-watchtower.js';

const queued = { id: 'mission:1', status: 'queued', createdAt: '2026-07-22T10:00:00Z' };
const completed = { ...queued, status: 'completed', executionPhase: 'forged', completedAt: '2026-07-22T10:05:00Z', forgedAt: '2026-07-22T10:05:00Z' };
const supportedFind = {
  id: 'opp-drill',
  title: 'Taladro Bosch 21 EUR',
  evidenceId: 'ev-1',
  sourceUrl: 'https://shop.example/drill',
  supported: true,
};

describe('mission Watchtower', () => {
  it('seeds existing missions without notifying historical terminal work', () => {
    const result = reconcileMissionWatchtower([completed], {}, Date.parse('2026-07-22T10:06:00Z'));
    expect(result.transitions).toEqual([]);
    expect(result.state.initialized).toBe(true);
  });

  it('emits one private event when a known mission reaches a terminal state', () => {
    const baseline = reconcileMissionWatchtower([queued]).state;
    const result = reconcileMissionWatchtower([completed], baseline, Date.parse('2026-07-22T10:06:00Z'));
    expect(result.transitions).toEqual([expect.objectContaining({ missionId: 'mission:1', status: 'completed', executionPhase: 'forged', unread: true })]);
    expect(unreadWatchtowerCount(result.state)).toBe(1);
    expect(reconcileMissionWatchtower([completed], result.state).transitions).toEqual([]);
  });

  it('does not mark completed-without-forged as Kernel forged', () => {
    const baseline = reconcileMissionWatchtower([queued]).state;
    const empty = { ...queued, status: 'completed', completedAt: '2026-07-22T10:05:00Z' };
    const result = reconcileMissionWatchtower([empty], baseline, Date.parse('2026-07-22T10:06:00Z'));
    expect(result.transitions).toEqual([expect.objectContaining({ status: 'completed', unread: true })]);
    expect(result.transitions[0].executionPhase).toBeUndefined();
    expect(result.transitions[0].workState).toBeUndefined();
  });

  it('does not notify newly discovered historical missions and bounds retained state', () => {
    const baseline = reconcileMissionWatchtower([queued]).state;
    const historical = Array.from({ length: 120 }, (_, index) => ({ ...completed, id: `old:${index}` }));
    const result = reconcileMissionWatchtower([queued, ...historical], baseline);
    expect(result.transitions).toEqual([]);
    expect(Object.keys(result.state.known).length).toBe(100);
  });

  it('marks result-center events read without deleting audit context', () => {
    const state = reconcileMissionWatchtower([completed], reconcileMissionWatchtower([queued]).state).state;
    const read = markWatchtowerEventsRead(state);
    expect(unreadWatchtowerCount(read)).toBe(0);
    expect(read.events).toHaveLength(1);
  });
});

describe('Watchtower Find aviso', () => {
  const forgedTransition = { status: 'completed', executionPhase: 'forged' };
  const missionWithSupport = {
    id: 'mission:1',
    status: 'completed',
    executionPhase: 'forged',
    verificationResults: [{ candidateId: 'cand-1', evidenceId: 'ev-1', supported: true }],
  };

  it('does not notify Completado for unverified bare completed leads', () => {
    const aviso = presentWatchtowerAviso({ status: 'completed' }, [supportedFind], { status: 'completed', resultSummary: { opportunitiesPromoted: 1 } });
    expect(aviso).toMatchObject({ notify: false, kind: 'silent' });
  });

  it('does not fire a Find alert on Evidence+URL without Kernel SUPPORT', () => {
    const unverified = { ...supportedFind, supported: undefined };
    const mission = {
      ...missionWithSupport,
      verificationResults: [{ candidateId: 'cand-1', evidenceId: 'ev-1', supported: false }],
    };
    const aviso = presentWatchtowerAviso(forgedTransition, [unverified], mission);
    expect(aviso).toMatchObject({ notify: true, kind: 'forged', title: 'Efesto finished forging' });
    expect(aviso.message).toContain('inspect the Evidence');
    expect(aviso.message).not.toMatch(/useful lead|opportunit/i);
  });

  it('fires Find aviso only when isKernelSupportedFind for this mission', () => {
    const aviso = presentWatchtowerAviso(forgedTransition, [supportedFind], missionWithSupport);
    expect(aviso).toMatchObject({ notify: true, kind: 'find', title: 'Efesto finished forging' });
    expect(aviso.message).toContain('A useful lead was forged');
  });

  it('keeps failed missions as attention, not Find', () => {
    const aviso = presentWatchtowerAviso({ status: 'failed' }, [supportedFind], missionWithSupport);
    expect(aviso).toMatchObject({ notify: true, kind: 'attention', title: 'Efesto needs your attention' });
  });

  it('Watchtower banner does not treat unsupported opportunity as Find', () => {
    expect(presentWatchtowerBanner(1, { status: 'completed', kind: 'find' })).toBe('1 new forge result ready to inspect.');
    expect(presentWatchtowerBanner(2, { status: 'completed', executionPhase: 'forged', kind: 'forged' })).toBe('2 new forge results ready to inspect.');
    expect(presentWatchtowerBanner(1, { status: 'completed' })).toBe('1 mission update needs attention.');
    expect(presentWatchtowerBanner(1, { status: 'completed', kind: 'silent' })).toBe('1 mission update needs attention.');
    expect(presentWatchtowerBanner(1, { status: 'failed' })).toBe('1 mission update needs attention.');
  });
});
