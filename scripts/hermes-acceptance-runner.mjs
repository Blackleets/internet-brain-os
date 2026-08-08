import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { detectHermesRuntime } from '../apps/local-kernel/hermes-runtime.mjs';
import {
  SCHEMA, api, assertLoopback, createIsolatedDataDir, isPortFree, redact, removeDataDir,
  sleep, startKernel, stopKernel, waitForHealth,
} from './hermes-acceptance-lib.mjs';
import {
  checkAuthorityFieldsIgnored, checkConsentRequired, checkDeduplication,
  checkHostileUrlsRejected, checkInvalidLeaseRejected, checkOversizedPayloadRejected,
  checkReplayRejectedAfterCompletion, checkTerminalStateOwnedByKernel,
  checkUnauthenticatedAccessRejected,
} from './hermes-acceptance-checks.mjs';

const PORT = Number(process.env.HEPHAESTUS_ACCEPTANCE_PORT ?? 4310);
const INTERNAL_PORT = Number(process.env.HEPHAESTUS_ACCEPTANCE_INTERNAL_PORT ?? 4311);
const LIVE = process.argv.includes('--live');
const REPORT_PATH = process.env.HEPHAESTUS_ACCEPTANCE_REPORT ?? '.hephaestus/acceptance-report.json';

const GOAL = {
  title: 'Acceptance probe: public research boundary',
  categories: ['tool'],
  keywords: ['open source observability tooling'],
  priority: 2,
};

export async function runAcceptance(options = {}) {
  const live = options.live ?? LIVE;
  const started = new Date().toISOString();
  const runtime = await detectHermesRuntime();
  const preflight = [
    { id: 'P1', name: 'Hermes runtime detected', passed: runtime.available, detail: `source=${runtime.source}` },
    { id: 'P2', name: 'Node runtime supports the Kernel', passed: Number(process.versions.node.split('.')[0]) >= 20, detail: `node=${process.versions.node}` },
  ];

  const token = randomBytes(32).toString('hex');
  const baseUrl = assertLoopback(`http://127.0.0.1:${PORT}`);
  const portFree = await isPortFree(PORT);
  preflight.push({
    id: 'P4',
    name: 'Acceptance port is not already occupied by another Kernel',
    passed: portFree,
    detail: portFree ? `port ${PORT} free` : `port ${PORT} is already serving a Kernel; stop it or set HEPHAESTUS_ACCEPTANCE_PORT`,
  });
  const dataDir = await createIsolatedDataDir();
  let kernel;
  const checks = [];
  let blocked;

  try {
    if (!portFree) throw new Error(`Acceptance port ${PORT} is already in use`);
    kernel = startKernel({ dataDir, port: PORT, internalPort: INTERNAL_PORT, token, hermesExecutable: runtime.executable, autoRuntime: live });
    const healthy = await waitForHealth(baseUrl);
    preflight.push({ id: 'P3', name: 'Isolated Kernel became healthy', passed: healthy, detail: healthy ? 'ready' : 'timeout' });
    if (!healthy) throw new Error('Kernel did not become healthy');

    checks.push(await checkUnauthenticatedAccessRejected({ baseUrl }));

    const goal = await api(baseUrl, token, '/api/goals', { method: 'POST', body: GOAL });
    if (goal.status !== 201) throw new Error(`Goal creation failed with HTTP ${goal.status}`);
    const goalId = goal.body.goal.id;
    checks.push(await checkConsentRequired({ baseUrl, token, goalId }));

    if (live) {
      const mission = await api(baseUrl, token, `/api/goals/${encodeURIComponent(goalId)}/missions`, {
        method: 'POST',
        body: { agent: 'hermes', cadence: 'manual', confirmed: true },
      });
      if (mission.status !== 201) throw new Error(`Mission creation failed with HTTP ${mission.status}`);
      const missionId = mission.body.mission.id;
      const outcome = await waitForTerminal(baseUrl, token, missionId);
      checks.push({
        id: 'L1',
        name: 'Authentic Hermes runtime drove the mission to a terminal state',
        passed: outcome.status === 'completed',
        detail: `status=${outcome.status ?? 'timeout'} phase=${outcome.executionPhase ?? 'none'} summary=${JSON.stringify(outcome.resultSummary ?? null)}`,
      });
      checks.push({
        id: 'L2',
        name: 'Attempts stayed bounded at three or fewer',
        passed: Number(outcome.attempt ?? 0) <= 3,
        detail: `attempt=${outcome.attempt ?? 0}`,
      });
    } else {
      const provision = async (suffix) => {
        const created = await api(baseUrl, token, '/api/goals', {
          method: 'POST',
          body: { ...GOAL, title: `${GOAL.title} ${suffix}` },
        });
        if (created.status !== 201) throw new Error(`Goal ${suffix} failed with HTTP ${created.status}`);
        const id = created.body.goal.id;
        const made = await api(baseUrl, token, `/api/goals/${encodeURIComponent(id)}/missions`, {
          method: 'POST',
          body: { agent: 'hermes', cadence: 'manual', confirmed: true },
        });
        if (made.status !== 201) throw new Error(`Mission ${suffix} failed with HTTP ${made.status}`);
        const claimed = await api(baseUrl, token, '/api/agent-missions/claim', { method: 'POST' });
        if (claimed.status !== 200) throw new Error(`Claim ${suffix} failed with HTTP ${claimed.status}`);
        return { baseUrl, token, missionId: made.body.mission.id, leaseId: claimed.body.mission.leaseId, claim: claimed.body.mission };
      };

      const boundary = await provision('boundary');
      checks.push({
        id: 'A0',
        name: 'Claim exposes only the bounded Goal scope and a lease',
        passed: Object.keys(boundary.claim).every((key) => [
          'id', 'goalId', 'goalTitle', 'agent', 'scope', 'cadence', 'attempt', 'leaseId', 'leaseExpiresAt',
        ].includes(key)),
        detail: `fields=${Object.keys(boundary.claim).join(',')}`,
      });
      checks.push(await checkHostileUrlsRejected(boundary));
      checks.push(await checkInvalidLeaseRejected(boundary));
      checks.push(await checkOversizedPayloadRejected(boundary));

      checks.push(await checkAuthorityFieldsIgnored(await provision('authority')));

      const dedupe = await provision('dedupe');
      checks.push(await checkDeduplication(dedupe));
      checks.push(await checkTerminalStateOwnedByKernel(dedupe));
      checks.push(await checkReplayRejectedAfterCompletion(dedupe));
    }
  } catch (error) {
    blocked = redact(error instanceof Error ? error.message : error);
  } finally {
    await stopKernel(kernel);
    await removeDataDir(dataDir);
  }

  const all = [...preflight, ...checks];
  const report = {
    schemaVersion: SCHEMA,
    mode: live ? 'live-authentic-runtime' : 'boundary-authority',
    startedAt: started,
    finishedAt: new Date().toISOString(),
    hermesRuntimeDetected: runtime.available,
    hermesRuntimeSource: runtime.source,
    passed: all.filter((check) => check.passed).length,
    total: all.length,
    ok: !blocked && all.every((check) => check.passed),
    blocked,
    checks: all.map((check) => ({ ...check, detail: redact(check.detail) })),
    kernelLogTail: (kernel?.logs ?? []).slice(-15),
  };
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8').catch(() => {});
  return report;
}

async function waitForTerminal(baseUrl, token, missionId, timeoutMs = 15 * 60_000) {
  const deadline = Date.now() + timeoutMs;
  let last = {};
  while (Date.now() < deadline) {
    const response = await api(baseUrl, token, '/api/agent-missions');
    last = (response.body?.missions ?? []).find((item) => item.id === missionId) ?? last;
    if (['completed', 'failed'].includes(last.status)) return last;
    await sleep(2_000);
  }
  return last;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runAcceptance();
  for (const check of report.checks) {
    console.log(`${check.passed ? 'PASS' : 'FAIL'}  ${check.id} ${check.name} — ${check.detail}`);
  }
  if (report.blocked) console.log(`BLOCKED: ${report.blocked}`);
  console.log(`\n${report.ok ? 'ACCEPTANCE OK' : 'ACCEPTANCE NOT PROVEN'}: ${report.passed}/${report.total} checks in mode ${report.mode}.`);
  process.exitCode = report.ok ? 0 : 1;
}
