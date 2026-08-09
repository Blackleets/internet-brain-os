import { describe, expect, it, vi } from 'vitest';
import { requestMissionCandidateVerification } from './automatic-mission-verification-client.mjs';

const token = 'verification-token-that-is-longer-than-thirty-two-characters';

describe('automatic Mission verification client', () => {
  it('requests Kernel-owned candidate verification over authenticated loopback HTTP', async () => {
    const fetchImpl = vi.fn(async (url, init) => ({
      ok: true,
      status: 202,
      json: async () => ({ mission: { id: 'mission:1', status: 'completed', executionPhase: 'forged' } }),
    }));
    await expect(requestMissionCandidateVerification({ baseUrl: 'http://127.0.0.1:4000', apiToken: token, missionId: 'mission:1', fetchImpl }))
      .resolves.toMatchObject({ id: 'mission:1', executionPhase: 'forged' });
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4000/api/agent-missions/mission%3A1/results', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'x-hephaestus-token': token, 'content-type': 'application/json' }),
      body: JSON.stringify({ resultKind: 'verify_candidates' }),
    }));
  });

  it('rejects non-loopback Kernel URLs and mismatched Mission responses', async () => {
    await expect(requestMissionCandidateVerification({ baseUrl: 'https://example.com', apiToken: token, missionId: 'mission:1' }))
      .rejects.toThrow('loopback HTTP');
    await expect(requestMissionCandidateVerification({
      baseUrl: 'http://127.0.0.1:4000', apiToken: token, missionId: 'mission:1',
      fetchImpl: async () => ({ ok: true, status: 202, json: async () => ({ mission: { id: 'mission:other' } }) }),
    })).rejects.toThrow('requested Mission');
  });

  it('surfaces Kernel verification failures without inventing success', async () => {
    await expect(requestMissionCandidateVerification({
      baseUrl: 'http://127.0.0.1:4000', apiToken: token, missionId: 'mission:1',
      fetchImpl: async () => ({ ok: false, status: 409, json: async () => ({ error: 'verification blocked' }) }),
    })).rejects.toThrow('verification blocked');
  });
});
