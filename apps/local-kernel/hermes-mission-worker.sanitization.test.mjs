import { describe, expect, it } from 'vitest';
import { runHermesMissionWorker } from './hermes-mission-worker.mjs';

const SECRET = 'sk-live-SUPERSECRET-0123456789abcdef';

function fetchStub(recorded) {
  return async (url, init) => {
    if (url.endsWith('/api/agent-missions/claim')) {
      return { ok: true, status: 200, json: async () => ({ mission: { id: 'mission:1', leaseId: 'lease-1', goalTitle: 'Probe', scope: {} } }) };
    }
    recorded.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 202, json: async () => ({ mission: { id: 'mission:1', status: 'queued' } }) };
  };
}

describe('hermes mission worker failure sanitization', () => {
  it('never forwards adapter stderr into the Kernel failure reason', async () => {
    const recorded = [];
    const result = await runHermesMissionWorker({
      baseUrl: 'http://127.0.0.1:4000',
      apiToken: 'a'.repeat(40),
      command: 'unused',
      fetchImpl: fetchStub(recorded),
      execute: async () => { throw new Error(`Hermes adapter exited with code 1: ${SECRET}`); },
    });
    expect(result.status).toBe('failed');
    const failure = recorded.find((entry) => entry.url.endsWith('/failures'));
    expect(failure).toBeDefined();
    expect(JSON.stringify(recorded)).not.toContain(SECRET);
  });

  it('bounds and sanitizes the reported reason', async () => {
    const recorded = [];
    await runHermesMissionWorker({
      baseUrl: 'http://127.0.0.1:4000',
      apiToken: 'a'.repeat(40),
      command: 'unused',
      fetchImpl: fetchStub(recorded),
      execute: async () => { throw new Error(`bad\u0000reason${'x'.repeat(2000)}`); },
    });
    const failure = recorded.find((entry) => entry.url.endsWith('/failures'));
    expect(failure.body.reason.length).toBeLessThanOrEqual(500);
    expect(failure.body.reason).not.toContain('\u0000');
  });

  it('rejects a non-loopback Kernel URL', async () => {
    await expect(runHermesMissionWorker({
      baseUrl: 'http://example.com',
      apiToken: 'a'.repeat(40),
      command: 'unused',
    })).rejects.toThrow(/loopback/i);
  });
});
