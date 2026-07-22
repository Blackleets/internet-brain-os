import { describe, expect, it, vi } from 'vitest';
import { runHermesMissionWorker } from './hermes-mission-worker.mjs';

const token = 'worker-token-that-is-longer-than-thirty-two-characters';
const mission = { id: 'mission:1', leaseId: 'lease:1', scope: { categories: ['job'] } };

describe('Hermes mission worker', () => {
  it('passes only the claimed mission to an explicit adapter and returns its bounded findings', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, mission }) })
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ ok: true, mission: { ...mission, status: 'completed' } }) });
    const execute = vi.fn(async () => ({ findings: [{ url: 'https://example.com/job', title: 'Job', text: 'Apply now' }] }));
    await expect(runHermesMissionWorker({ apiToken: token, command: '/opt/hermes-adapter', fetchImpl, execute })).resolves.toMatchObject({ status: 'completed' });
    expect(execute).toHaveBeenCalledWith('/opt/hermes-adapter', [], mission, expect.any(Object));
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toMatchObject({ leaseId: 'lease:1', findings: [{ title: 'Job' }] });
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
});
