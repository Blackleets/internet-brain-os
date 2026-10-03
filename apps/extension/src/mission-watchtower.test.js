import { describe, expect, it } from 'vitest';
import { chromeNotificationIdForWatchtowerAviso, markWatchtowerEventsRead, pendingWorkspaceViewForWatchtowerNotification, presentWatchtowerAviso, presentWatchtowerBanner, reconcileMissionWatchtower, unreadWatchtowerCount } from './mission-watchtower.js';

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
    // Zero-SUPPORT forged must not brand Completado / finished forging.
    expect(aviso).toMatchObject({ notify: true, kind: 'forged', title: 'Research completed' });
    expect(aviso.message).toContain('No Kernel SUPPORT Find');
    expect(aviso.message).toContain('Forge Ledger');
    expect(aviso.message).not.toMatch(/finished forging|inspect the Evidence|useful lead|opportunit/i);
    expect(aviso.title).not.toMatch(/finished forging/i);
  });

  it('fires Find aviso only when isKernelSupportedFind for this mission and names Kernel SUPPORT', () => {
    const aviso = presentWatchtowerAviso(forgedTransition, [supportedFind], missionWithSupport);
    expect(aviso).toMatchObject({ notify: true, kind: 'find', title: 'Efesto finished forging' });
    expect(aviso.message).toContain('1 Find passed Kernel SUPPORT');
    expect(aviso.message).not.toMatch(/useful lead|opportunit/i);
  });

  it('names Kernel SUPPORT from verificationResults when opportunities list is empty', () => {
    // Mirrors background.js listOpportunities catch→[] — inbox empty must not
    // demote a SUPPORT forged mission to kind:forged "inspect the Evidence".
    const aviso = presentWatchtowerAviso(forgedTransition, [], missionWithSupport);
    expect(aviso).toMatchObject({ notify: true, kind: 'find', title: 'Efesto finished forging' });
    expect(aviso.message).toContain('1 Find passed Kernel SUPPORT');
    expect(aviso.message).not.toMatch(/useful lead|opportunit|local mission finished/i);
    const zeroSupport = {
      ...missionWithSupport,
      verificationResults: [{ candidateId: 'cand-1', evidenceId: 'ev-1', supported: false }],
    };
    expect(presentWatchtowerAviso(forgedTransition, [], zeroSupport)).toMatchObject({
      notify: true,
      kind: 'forged',
      title: 'Research completed',
    });
    expect(presentWatchtowerAviso(forgedTransition, [], zeroSupport).message).toContain('No Kernel SUPPORT Find');
    expect(presentWatchtowerAviso(forgedTransition, [], zeroSupport).title).not.toMatch(/finished forging/i);
  });

  it('does not understate Living Forge SUPPORT when opportunities list is partial', () => {
    // finds.length > 0 used to win the ternary and report 1 Find while verificationResults
    // (Living Forge / mission-presentation) prove 2 SUPPORT rows.
    const missionTwoSupport = {
      ...missionWithSupport,
      verificationResults: [
        { candidateId: 'cand-1', evidenceId: 'ev-1', supported: true },
        { candidateId: 'cand-2', evidenceId: 'ev-2', supported: true },
      ],
    };
    const aviso = presentWatchtowerAviso(forgedTransition, [supportedFind], missionTwoSupport);
    expect(aviso).toMatchObject({ notify: true, kind: 'find' });
    expect(aviso.message).toContain('2 Finds passed Kernel SUPPORT');
    expect(aviso.message).not.toContain('1 Find passed Kernel SUPPORT');
  });

  it('keeps failed missions as attention, not Find', () => {
    const aviso = presentWatchtowerAviso({ status: 'failed' }, [supportedFind], missionWithSupport);
    expect(aviso).toMatchObject({ notify: true, kind: 'attention', title: 'Efesto needs your attention' });
  });


  it('routes kind:find OS notify click to Finds workspace (Kernel gateway fallback parity)', () => {
    const transition = { id: 'mission:1:completed:2026-07-22T10:05:00Z', missionId: 'mission:1', status: 'completed' };
    const findId = chromeNotificationIdForWatchtowerAviso(transition, 'find');
    expect(findId).toBe('efesto-mission:find:mission:1:completed:2026-07-22T10:05:00Z');
    expect(pendingWorkspaceViewForWatchtowerNotification(findId)).toBe('finds');
    expect(pendingWorkspaceViewForWatchtowerNotification(
      chromeNotificationIdForWatchtowerAviso(transition, 'attention'),
    )).toBe('missions');
    expect(pendingWorkspaceViewForWatchtowerNotification(
      chromeNotificationIdForWatchtowerAviso(transition, 'forged'),
    )).toBe('missions');
    // Legacy ids without kind stay on missions (pre-encoding watchtower notifies).
    expect(pendingWorkspaceViewForWatchtowerNotification(`efesto-mission:${transition.id}`)).toBe('missions');
    expect(pendingWorkspaceViewForWatchtowerNotification('efesto-kernel-notification:n1')).toBeNull();
  });

  it('Watchtower banner does not treat unsupported opportunity as Find', () => {
    expect(presentWatchtowerBanner(1, { status: 'completed', kind: 'find' })).toBe('1 new forge result ready to inspect.');
    // kind:forged / forged-complete without Find kind must not brand Completado forge results.
    expect(presentWatchtowerBanner(2, { status: 'completed', executionPhase: 'forged', kind: 'forged' })).toBe('2 research updates ready to inspect.');
    expect(presentWatchtowerBanner(1, { status: 'completed', executionPhase: 'forged' })).toBe('1 research update ready to inspect.');
    expect(presentWatchtowerBanner(1, { status: 'completed' })).toBe('1 mission update needs attention.');
    expect(presentWatchtowerBanner(1, { status: 'completed', kind: 'silent' })).toBe('1 mission update needs attention.');
    expect(presentWatchtowerBanner(1, { status: 'failed' })).toBe('1 mission update needs attention.');
  });
});
