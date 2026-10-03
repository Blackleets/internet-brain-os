import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { loadExistingApiToken, validateApiToken } from './api-token-store.mjs';
import { recoverAutomaticMissions } from './automatic-mission-recovery.mjs';
import { requestMissionCandidateVerification } from './automatic-mission-verification-client.mjs';
import { detectHermesRuntime, probeHermesReadOnlyRuntime } from './hermes-runtime.mjs';
import { selectInternalPort } from './internal-port.mjs';
import { runHermesMissionWorker } from './hermes-mission-worker.mjs';
import { createKernelProxyHandler, safeMessage } from './kernel-proxy.mjs';

const host = process.env.HEPHAESTUS_HOST ?? '127.0.0.1';
const port = Number(process.env.HEPHAESTUS_PORT ?? 4000);
const MAX_PROXY_BODY_BYTES = 1024 * 1024;
const MAX_AUTOMATIC_MISSION_ATTEMPTS = configuredAutomaticMissionAttempts(process.env.HEPHAESTUS_AUTOMATIC_MISSION_ATTEMPTS);
const activeRuns = new Map();
let shuttingDown = false;
let proxy;

if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(String(host).toLowerCase())) throw new Error('HEPHAESTUS_HOST must be a loopback address');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Kernel port must be a valid TCP port');

const internalPort = await selectInternalPort({ externalPort: port, requestedPort: process.env.HEPHAESTUS_INTERNAL_PORT });
const internalBaseUrl = `http://127.0.0.1:${internalPort}`;

const hermesRuntime = await detectHermesRuntime();
const hermesReadOnlyRuntime = await probeHermesReadOnlyRuntime(hermesRuntime);
if (hermesRuntime.available) process.env.HEPHAESTUS_HERMES_EXECUTABLE = hermesRuntime.executable;

const kernel = spawn(process.execPath, [resolve('apps/local-kernel/server.mjs')], {
  shell: false,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    HEPHAESTUS_HOST: '127.0.0.1',
    HEPHAESTUS_PORT: String(internalPort),
    HEPHAESTUS_HERMES_READY: hermesRuntime.available ? '1' : '0',
    HEPHAESTUS_HERMES_READ_ONLY_READY: hermesReadOnlyRuntime.ready ? '1' : '0',
  },
});

kernel.stdout.on('data', (chunk) => process.stdout.write(chunk));
kernel.stderr.on('data', (chunk) => process.stderr.write(chunk));
kernel.on('exit', (code, signal) => {
  if (shuttingDown) return;
  process.stderr.write(`Internal Kernel stopped unexpectedly (${signal ?? code ?? 'unknown'}).\n`);
  process.exitCode = code || 1;
  proxy?.close();
});

await waitForKernel();
const recoveryToken = await readRecoveryToken();
if (recoveryToken) {
  try {
    const recovered = await recoverAutomaticMissions({
      baseUrl: internalBaseUrl,
      apiToken: recoveryToken,
      startMission: startMissionRuntime,
    });
    if (recovered.queued || recovered.verifying || recovered.scheduled) {
      console.log(`Efesto recovery: queued=${recovered.queued}, verifying=${recovered.verifying}, scheduled=${recovered.scheduled}.`);
    }
  } catch (error) {
    console.error(`Efesto recovery check failed safely: ${safeMessage(error)}`);
  }
}

// Streams SSE/NDJSON (dashboard live events, chat) and aborts upstream when a client leaves.
proxy = createServer(createKernelProxyHandler({
  internalBaseUrl,
  maxBodyBytes: MAX_PROXY_BODY_BYTES,
  onMissionStart: startMissionRuntime,
}));

proxy.listen(port, host, () => {
  console.log(`Hephaestus one-click Kernel listening on http://${host}:${port}`);
  console.log(`Efesto internal Kernel bound to loopback port ${internalPort}.`);
  if (hermesReadOnlyRuntime.ready) console.log('Efesto automatic research is restricted to certified Hermes safe search-only discovery.');
  else if (hermesRuntime.available) console.log(`Hermes is installed, but automatic research is blocked until read-only runtime certification passes (${hermesReadOnlyRuntime.reason ?? 'unknown'}).`);
  else console.log('Hermes runtime was not found. Install Hermes or configure HEPHAESTUS_HERMES_EXECUTABLE.');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    proxy?.close(() => process.exit(0));
    kernel.kill(signal);
    setTimeout(() => process.exit(0), 2_000).unref();
  });
}

function startMissionRuntime(mission, apiToken) {
  if (!mission?.id || !['queued', 'running'].includes(mission.status) || activeRuns.has(mission.id)) return;
  const run = runMissionUntilTerminal(mission.id, apiToken)
    .catch((error) => console.error(`Hermes mission ${mission.id} failed: ${safeMessage(error)}`))
    .finally(() => activeRuns.delete(mission.id));
  activeRuns.set(mission.id, run);
}

async function runMissionUntilTerminal(missionId, apiToken) {
  let attempts = 0;
  while (attempts < MAX_AUTOMATIC_MISSION_ATTEMPTS) {
    attempts += 1;
    const result = await runHermesMissionWorker({
      baseUrl: internalBaseUrl,
      apiToken,
      missionId,
      command: process.execPath,
      args: [resolve('scripts/hermes-efesto-adapter.mjs')],
    });
    console.log(`Hermes mission ${missionId}: ${result.status}`);
    if (result.status === 'verifying') {
      const verified = await requestMissionCandidateVerification({ baseUrl: internalBaseUrl, apiToken, missionId });
      console.log(`Kernel verification ${missionId}: ${verified.executionPhase ?? verified.status}`);
      break;
    }
    if (result.status !== 'failed') break;
  }
}

function configuredAutomaticMissionAttempts(value) {
  if (value === undefined || value === '') return 3;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3) throw new Error('HEPHAESTUS_AUTOMATIC_MISSION_ATTEMPTS must be an integer between 1 and 3');
  return parsed;
}

async function readRecoveryToken() {
  try {
    if (process.env.HEPHAESTUS_API_TOKEN) return validateApiToken(process.env.HEPHAESTUS_API_TOKEN);
    const dataDir = resolve(process.env.HEPHAESTUS_DATA_DIR ?? '.hephaestus');
    return (await loadExistingApiToken(resolve(dataDir, 'kernel-api-token'))).token;
  } catch {
    return undefined;
  }
}

async function waitForKernel() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (kernel.exitCode !== null) throw new Error('Internal Kernel failed during startup');
    try {
      const response = await fetch(`${internalBaseUrl}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
  }
  kernel.kill();
  throw new Error('Internal Kernel did not become ready');
}
