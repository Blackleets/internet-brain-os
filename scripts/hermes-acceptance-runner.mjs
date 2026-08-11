import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { detectHermesRuntime } from '../apps/local-kernel/hermes-runtime.mjs';
import {
  ACCEPTANCE_ORIGIN, SCHEMA, api, assertLoopback, createIsolatedDataDir, isPortFree, redact, removeDataDir,
  sleep, startKernel, stopKernel, waitForHealth,
} from './hermes-acceptance-lib.mjs';
import {
  checkAuthorityFieldsIgnored, checkConsentRequired, checkDeduplication,
  checkHostileUrlsRejected, checkInvalidLeaseRejected, checkOversizedPayloadRejected,
  checkReplayIdempotentAfterCompletion, checkTerminalStateOwnedByKernel,
  checkUnauthenticatedAccessRejected,
} from './hermes-acceptance-checks.mjs';
import { assessLivePublicWebJourney } from './hermes-live-journey-assessment.mjs';

const PORT = Number(process.env.HEPHAESTUS_ACCEPTANCE_PORT ?? 4310);
const INTERNAL_PORT = Number(process.env.HEPHAESTUS_ACCEPTANCE_INTERNAL_PORT ?? 4311);
const LIVE = process.argv.includes('--live');
const REPORT_PATH = process.env.HEPHAESTUS_ACCEPTANCE_REPORT ?? '.hephaestus/acceptance-report.json';
const DEFAULT_ADAPTER_TIMEOUT_MS = 12 * 60_000;
const MAX_ADAPTER_TIMEOUT_MS = 25 * 60_000;
const DEFAULT_WORKER_TIMEOUT_MS = 15 * 60_000;
const MAX_WORKER_TIMEOUT_MS = 30 * 60_000;
const DEFAULT_TERMINAL_TIMEOUT_MS = 16 * 60_000;
const MAX_TERMINAL_TIMEOUT_MS = 35 * 60_000;

const BOUNDARY_GOAL = {
  title: 'Acceptance probe: public research boundary',
  categories: ['tool'],
  keywords: ['open source observability tooling'],
  priority: 2,
};

export const LIVE_VALUE_GOAL = {
  title: 'Find a public open-source developer tool with API, documentation, installation and license details',
  categories: ['tool'],
  keywords: ['open source', 'developer tool', 'GitHub', 'API', 'documentation', 'install', 'license'],
  priority: 2,
};

export async function runAcceptance(options = {}) {
  const live = options.live ?? LIVE;
  const started = new Date().toISOString();
  const runtime = await detectHermesRuntime();
  const preflight = [
    {
      id: 'P1',
      name: live ? 'Authentic Hermes runtime detected' : 'Hermes runtime is optional for boundary-only acceptance',
      passed: !live || runtime.available,
      detail: `required=${live} available=${runtime.available} source=${runtime.source}`,
    },
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
    const liveTimeoutBudget = live ? resolveLiveTimeoutBudget() : undefined;
    if (liveTimeoutBudget) {
      preflight.push({
        id: 'P5',
        name: 'Live runtime deadlines are strictly nested',
        passed: true,
        detail: `adapter=${liveTimeoutBudget.adapterMs} worker=${liveTimeoutBudget.workerMs} terminal=${liveTimeoutBudget.terminalMs}`,
      });
    }
    kernel = startKernel({ dataDir, port: PORT, internalPort: INTERNAL_PORT, token, hermesExecutable: runtime.executable, autoRuntime: live });
    const healthy = await waitForHealth(baseUrl);
    preflight.push({ id: 'P3', name: 'Isolated Kernel became healthy', passed: healthy, detail: healthy ? 'ready' : 'timeout' });
    if (!healthy) throw new Error('Kernel did not become healthy');

    checks.push(await checkUnauthenticatedAccessRejected({ baseUrl }));

    const goalInput = live ? LIVE_VALUE_GOAL : BOUNDARY_GOAL;
    const goal = await api(baseUrl, token, '/api/goals', { method: 'POST', body: goalInput });
    if (goal.status !== 201) throw new Error(`Goal creation failed with HTTP ${goal.status}`);
    const goalId = goal.body.goal.id;
    checks.push(await checkConsentRequired({ baseUrl, token, goalId }));

    if (live) {
      const mission = await api(baseUrl, token, `/api/goals/${encodeURIComponent(goalId)}/missions`, {
        method: 'POST',
        origin: ACCEPTANCE_ORIGIN,
        body: { agent: 'hermes', cadence: 'manual', confirmed: true },
      });
      if (mission.status !== 201) throw new Error(`Mission creation failed with HTTP ${mission.status}`);
      const missionId = mission.body.mission.id;
      const outcome = await waitForTerminal(baseUrl, token, missionId, liveTimeoutBudget.terminalMs);
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
      const journey = await readLiveJourney(baseUrl, token, goalId, outcome);
      checks.push(...assessLivePublicWebJourney(journey));
    } else {
      const provision = async (suffix) => {
        const created = await api(baseUrl, token, '/api/goals', {
          method: 'POST',
          body: { ...BOUNDARY_GOAL, title: `${BOUNDARY_GOAL.title} ${suffix}` },
        });
        if (created.status !== 201) throw new Error(`Goal ${suffix} failed with HTTP ${created.status}`);
        const id = created.body.goal.id;
        const made = await api(baseUrl, token, `/api/goals/${encodeURIComponent(id)}/missions`, {
          method: 'POST',
          origin: ACCEPTANCE_ORIGIN,
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
      checks.push(await checkReplayIdempotentAfterCompletion(dedupe));
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

async function readLiveJourney(baseUrl, token, goalId, mission) {
  const opportunitiesResponse = await api(baseUrl, token, '/api/opportunities');
  if (opportunitiesResponse.status !== 200) throw new Error(`Opportunity read failed with HTTP ${opportunitiesResponse.status}`);
  const opportunities = Array.isArray(opportunitiesResponse.body?.opportunities) ? opportunitiesResponse.body.opportunities : [];
  const linkedFinds = opportunities.filter((item) => Array.isArray(item?.goalMatches) && item.goalMatches.some((match) => match?.goalId === goalId));
  const caseIds = [...new Set(linkedFinds.map((item) => item?.caseId).filter((value) => typeof value === 'string' && value))];
  const caseDetails = [];
  for (const caseId of caseIds) {
    const detail = await api(baseUrl, token, `/api/browser/case/${encodeURIComponent(caseId)}`);
    if (detail.status === 200 && detail.body?.ok === true) caseDetails.push(detail.body);
  }
  const surfaceResponse = await api(baseUrl, token, `/api/goal-surfaces/${encodeURIComponent(goalId)}`);
  if (surfaceResponse.status !== 200) throw new Error(`Shared Goal Truth read failed with HTTP ${surfaceResponse.status}`);
  return {
    goalId,
    mission,
    opportunities,
    caseDetails,
    surface: surfaceResponse.body?.surface,
  };
}

export function resolveLiveTimeoutBudget(env = process.env) {
  const adapterMs = boundedTimeout(env.HEPHAESTUS_HERMES_ONESHOT_TIMEOUT_MS, DEFAULT_ADAPTER_TIMEOUT_MS, MAX_ADAPTER_TIMEOUT_MS, 'HEPHAESTUS_HERMES_ONESHOT_TIMEOUT_MS');
  const workerMs = boundedTimeout(env.HEPHAESTUS_HERMES_WORKER_TIMEOUT_MS, DEFAULT_WORKER_TIMEOUT_MS, MAX_WORKER_TIMEOUT_MS, 'HEPHAESTUS_HERMES_WORKER_TIMEOUT_MS');
  const terminalMs = boundedTimeout(env.HEPHAESTUS_ACCEPTANCE_TERMINAL_TIMEOUT_MS, DEFAULT_TERMINAL_TIMEOUT_MS, MAX_TERMINAL_TIMEOUT_MS, 'HEPHAESTUS_ACCEPTANCE_TERMINAL_TIMEOUT_MS');
  if (!(adapterMs < workerMs && workerMs < terminalMs)) {
    throw new Error('Live timeout budget must satisfy Hermes adapter < mission worker < acceptance terminal deadline');
  }
  return { adapterMs, workerMs, terminalMs };
}

function boundedTimeout(value, fallback, max, name) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 60_000 || parsed > max) {
    throw new Error(`${name} must be an integer between 60000 and ${max}`);
  }
  return parsed;
}

async function waitForTerminal(baseUrl, token, missionId, timeoutMs = DEFAULT_TERMINAL_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let last = {};
  while (Date.now() < deadline) {
    const response = await api(baseUrl, token, '/api/agent-missions');
    last = (response.body?.missions ?? []).find((item) => item.id === missionId) ?? last;
    if (isObservableMissionOutcome(last)) return last;
    await sleep(2_000);
  }
  return last;
}

export function isObservableMissionOutcome(mission) {
  return Boolean(mission?.status === 'completed'
    || mission?.status === 'failed'
    || (mission?.status === 'queued' && mission?.lastFailure && Number(mission?.attempt ?? 0) > 0));
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
