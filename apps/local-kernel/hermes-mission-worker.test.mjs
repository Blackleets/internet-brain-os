import { describe, expect, it, vi } from 'vitest';
import { runHermesMissionWorker } from './hermes-mission-worker.mjs';

const token = 'worker-token-that-is-longer-than-thirty-two-characters';
const mission = { id: 'mission:1', leaseId: 'lease:1', scope: { categories: ['job'] } };

describe('Hermes mission worker', () => {
  it('submits bounded discovery output as search candidates and reports verifying truthfully', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, mission }) })
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ ok: true, mission: { ...mission, status: 'running', executionPhase: 'verifying' } }) });
    const execute = vi.fn(async () => ({ findings: [{ url: 'https://example.com/job', title: 'Job', text: 'Search snippet' }] }));
    await expect(runHermesMissionWorker({ apiToken: token, command: '/opt/hermes-adapter', fetchImpl, execute })).resolves.toMatchObject({ status: 'verifying' });
    expect(execute).toHaveBeenCalledWith('/opt/hermes-adapter', [], mission, expect.any(Object));
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toMatchObject({
      leaseId: 'lease:1', resultKind: 'search_candidates', findings: [{ title: 'Job' }],
    });
  });

  it('stays idle when no authorized mission is claimable', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 204 }));
    await expect(runHermesMissionWorker({ apiToken: token, command: '/opt/hermes-adapter', fetchImpl })).resolves.toEqual({ status: 'idle' });
  });

  it('reports sanitized adapter failures through the bounded failure route', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, mission }) })
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ ok: true }) });
    const execute = vi.fn(async () => { throw new Error('provider\nfailed'); });
    await expect(runHermesMissionWorker({ apiToken: token, command: '/opt/hermes-adapter', fetchImpl, execute })).resolves.toMatchObject({ status: 'failed', reason: 'provider failed' });
  });

  it('reconciles a persisted verifying Mission when the result response is lost', async () => {
    const verifying = { ...mission, status: 'running', executionPhase: 'verifying' };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, mission }) })
      .mockRejectedValueOnce(new Error('socket closed after commit'))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, missions: [verifying] }) });
    const execute = vi.fn(async () => ({ findings: [{ url: 'https://example.com/job', title: 'Job', text: 'Search snippet' }] }));

    await expect(runHermesMissionWorker({ apiToken: token, command: '/opt/hermes-adapter', fetchImpl, execute }))
      .resolves.toMatchObject({ status: 'verifying', mission: { id: mission.id, executionPhase: 'verifying' } });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
