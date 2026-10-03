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
    await expect(runHermesMissionWorker({ apiToken: token, command: '/opt/hermes-adapter', fetchImpl, execute })).resolves.toMatchObject({ status: 'failed', reason: 'provider failed', reported: true });
  });

  it('keeps the real adapter cause when the Kernel refuses the failure report', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, mission }) })
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ ok: false, error: 'Mission lease is no longer active' }) });
    const execute = vi.fn(async () => { throw new Error('Hermes adapter timed out'); });
    await expect(runHermesMissionWorker({ apiToken: token, command: '/opt/hermes-adapter', fetchImpl, execute })).resolves.toEqual({
      status: 'failed', missionId: mission.id, reason: 'Hermes adapter timed out', reported: false, reportError: 'Mission lease is no longer active',
    });
  });

  it('does not reject when the Kernel is unreachable for the failure report', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, mission }) })
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:4311'));
    const execute = vi.fn(async () => ({ findings: 'not-an-array' }));
    await expect(runHermesMissionWorker({ apiToken: token, command: '/opt/hermes-adapter', fetchImpl, execute })).resolves.toMatchObject({
      status: 'failed', reported: false, reason: expect.stringContaining('must return { findings'), reportError: expect.stringContaining('ECONNREFUSED'),
    });
  });

  it('bounds a stalled Kernel request instead of awaiting forever, then reports the timeout', async () => {
    // A Kernel that accepts the connection but never answers used to leave the worker (and the
    // one-click activeRuns entry for this Mission) pending forever, so it was never retried.
    const stalled = (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
    });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, mission }) })
      .mockImplementationOnce(stalled)
      .mockImplementationOnce(stalled)
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ ok: true }) });
    const execute = vi.fn(async () => ({ findings: [{ url: 'https://example.com/job', title: 'Job', text: 'Search snippet' }] }));
    await expect(runHermesMissionWorker({ apiToken: token, command: '/opt/hermes-adapter', fetchImpl, execute, requestTimeoutMs: 50 }))
      .resolves.toMatchObject({ status: 'failed', reported: true, reason: 'Kernel request timed out after 50 ms' });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls.every(([, init]) => init.signal instanceof AbortSignal)).toBe(true);
  }, 5_000);

  it('a stalled claim rejects with a bounded timeout rather than hanging', async () => {
    const fetchImpl = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
    }));
    await expect(runHermesMissionWorker({ apiToken: token, command: '/opt/hermes-adapter', fetchImpl, requestTimeoutMs: 50 }))
      .rejects.toThrow('Kernel request timed out after 50 ms');
  }, 5_000);

  it('does not report a timeout until the adapter process has actually stopped', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'efesto-worker-timeout-test-'));
    const fixture = join(directory, 'ignore-term.mjs');
    const pidFile = join(directory, 'child.pid');
    await writeFile(fixture, "import { writeFileSync } from 'node:fs'; writeFileSync(process.argv[2], String(process.pid)); process.on('SIGTERM', () => {}); process.stdin.resume(); setInterval(() => {}, 1000);\n", 'utf8');
    const startedAt = Date.now();
    try {
      // Generous adapter budget: under full-suite CPU contention the child's
      // Node startup can exceed sub-second budgets, which would race the
      // timeout against the fixture's own pid write. The guarantee under test
      // is unchanged: once the timeout fires, the ignored-SIGTERM child must
      // be gone before the error resolves, within bounded wall-clock time.
      await expect(executeAdapter(process.execPath, [fixture, pidFile], mission, { timeoutMs: 2_000 })).rejects.toThrow('timed out');
      const pid = await waitForPid(pidFile, 5_000);
      expect(() => process.kill(pid, 0)).toThrow();
      const startupMs = Math.max(Date.now() - startedAt - 2_000, 500);
      expect(Date.now() - startedAt).toBeLessThan(startupMs + 10_000);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('surfaces bounded sanitized adapter diagnostics on a non-zero exit', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'efesto-worker-diagnostic-test-'));
    const fixture = join(directory, 'failed-adapter.mjs');
    await writeFile(fixture, "process.stdin.resume(); process.stderr.write('Hermes failed with token=abcdef0123456789abcdef0123456789'); process.exitCode = 9;\n", 'utf8');
    try {
      await expect(executeAdapter(process.execPath, [fixture], mission, { timeoutMs: 2_000 }))
        .rejects.toThrow('Hermes adapter exited with code 9: Hermes failed with token=<redacted-secret>');
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

/** Polls until the fixture child writes its pid, tolerating slow startup under load. */
async function waitForPid(pidFile, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return Number(await readFile(pidFile, 'utf8'));
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw lastError;
}
