import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { executeAdapter, runHermesMissionWorker } from './hermes-mission-worker.mjs';

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

  it('does not report a timeout until the adapter process has actually stopped', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'efesto-worker-timeout-test-'));
    const fixture = join(directory, 'ignore-term.mjs');
    const pidFile = join(directory, 'child.pid');
    await writeFile(fixture, "import { writeFileSync } from 'node:fs'; writeFileSync(process.argv[2], String(process.pid)); process.on('SIGTERM', () => {}); process.stdin.resume(); setInterval(() => {}, 1000);\n", 'utf8');
    const startedAt = Date.now();
    try {
      await expect(executeAdapter(process.execPath, [fixture, pidFile], mission, { timeoutMs: 500 })).rejects.toThrow('timed out');
      const pid = Number(await readFile(pidFile, 'utf8'));
      expect(() => process.kill(pid, 0)).toThrow();
      expect(Date.now() - startedAt).toBeLessThan(3_000);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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
