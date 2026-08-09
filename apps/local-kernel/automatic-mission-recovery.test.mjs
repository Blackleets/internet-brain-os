import { describe, expect, it, vi } from 'vitest';
import { recoverAutomaticMissions } from './automatic-mission-recovery.mjs';

const token = 'recovery-token-that-is-longer-than-thirty-two-characters';

function missionList(missions) {
  return async (_url, init) => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, missions }),
    request: init,
  });
}

describe('automatic Mission restart recovery', () => {
  it('resumes queued discovery and pending Kernel verification from persisted truth', async () => {
    const startMission = vi.fn();
    const verifyMission = vi.fn(async () => ({ id: 'mission:verify', status: 'completed' }));
    const fetchImpl = vi.fn(missionList([
      { id: 'mission:queued', status: 'queued', executionPhase: 'queued' },
      { id: 'mission:verify', status: 'running', executionPhase: 'verifying', searchCandidates: [{ id: 'candidate:1' }] },
      { id: 'mission:done', status: 'completed', executionPhase: 'forged' },
    ]));

    await expect(recoverAutomaticMissions({
      baseUrl: 'http://127.0.0.1:4000', apiToken: token, fetchImpl, startMission, verifyMission,
    })).resolves.toEqual({ queued: 1, verifying: 1, scheduled: 0, skipped: 1 });
    expect(startMission).toHaveBeenCalledWith(expect.objectContaining({ id: 'mission:queued' }), token);
    expect(verifyMission).toHaveBeenCalledWith('mission:verify');
    expect(fetchImpl.mock.calls[0][1].headers['x-hephaestus-token']).toBe(token);
  });

  it('schedules an in-flight investigating lease for safe reclaim after its expiry instead of stealing it', async () => {
    const startMission = vi.fn();
    const scheduled = [];
    const now = new Date('2026-08-09T22:30:00.000Z');
    const mission = {
      id: 'mission:leased', status: 'running', executionPhase: 'investigating',
      leaseExpiresAt: '2026-08-09T22:31:00.000Z',
    };
    const result = await recoverAutomaticMissions({
      baseUrl: 'http://127.0.0.1:4000', apiToken: token, fetchImpl: missionList([mission]), startMission,
      now: () => now,
      schedule: (callback, delay) => { scheduled.push({ callback, delay }); },
    });
    expect(result.scheduled).toBe(1);
    expect(startMission).not.toHaveBeenCalled();
    expect(scheduled[0].delay).toBe(60_050);
    scheduled[0].callback();
    expect(startMission).toHaveBeenCalledWith(mission, token);
  });

  it('fails closed for non-loopback recovery targets and malformed Mission lists', async () => {
    await expect(recoverAutomaticMissions({ baseUrl: 'https://example.com', apiToken: token, startMission() {} }))
      .rejects.toThrow('loopback HTTP');
    await expect(recoverAutomaticMissions({
      baseUrl: 'http://127.0.0.1:4000', apiToken: token, startMission() {},
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ missions: null }) }),
    })).rejects.toThrow('Unable to reconcile');
  });
});
