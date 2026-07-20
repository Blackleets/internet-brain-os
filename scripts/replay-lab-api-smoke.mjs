#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const secret = process.env.IBOS_HERMES_SECRET ?? 'dev-replay-lab-smoke-secret';
const port = Number(process.env.IBOS_REPLAY_LAB_SMOKE_PORT ?? 4111);
const host = '127.0.0.1';
const apiToken = 'replay-lab-smoke-token-long-enough-32';
const baseUrl = `http://${host}:${port}`;
const dataDir = await mkdtemp(join(tmpdir(), 'ibos-replay-lab-smoke-'));
let server;

try {
  server = spawn(process.execPath, ['apps/local-kernel/server.mjs'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HEPHAESTUS_HOST: host,
      HEPHAESTUS_PORT: String(port),
      HEPHAESTUS_DATA_DIR: dataDir,
      HEPHAESTUS_API_TOKEN: apiToken,
      IBOS_HERMES_SECRET: secret,
    },
  });

  const output = [];
  server.stdout.on('data', (chunk) => output.push(chunk.toString('utf8')));
  server.stderr.on('data', (chunk) => output.push(chunk.toString('utf8')));

  await waitForHealth(`${baseUrl}/health`);
  const health = await (await fetch(`${baseUrl}/health`)).json();
  assert(health.hermes?.enabled === true, 'Hermes route must be enabled in health response.');
  assert(health.replayLab?.enabled === true, 'Replay Lab API must be enabled in health response.');

  const unauthorized = await fetch(`${baseUrl}/api/replay-lab/cases`);
  assert(unauthorized.status === 401, `Replay Lab API must require token, got ${unauthorized.status}.`);

  const idempotencyKey = `replay-lab-smoke-${Date.now()}`;
  const ingest = await runSample({
    ...process.env,
    IBOS_HERMES_SECRET: secret,
    IBOS_HERMES_INGEST_URL: `${baseUrl}/hermes/ingestions`,
    IBOS_HERMES_IDEMPOTENCY_KEY: idempotencyKey,
  });
  assert(ingest.status === 202, `Sample ingest expected 202, got ${ingest.status}: ${ingest.body}`);

  const ingestBody = JSON.parse(ingest.body);
  assert(ingestBody.ok === true, 'Sample ingest response must be ok.');
  assert(typeof ingestBody.recordId === 'string', 'Sample ingest response must include recordId.');

  const listResponse = await fetch(`${baseUrl}/api/replay-lab/cases`, { headers: authHeaders() });
  assert(listResponse.status === 200, `Replay Lab list expected 200, got ${listResponse.status}: ${await listResponse.text()}`);
  const listBody = await listResponse.json();
  assert(listBody.ok === true, 'Replay Lab list response must be ok.');
  assert(Array.isArray(listBody.cases), 'Replay Lab list response must include cases array.');
  const listed = listBody.cases.find((candidate) => candidate.id === ingestBody.recordId);
  assert(listed, `Replay Lab list must contain ingested record ${ingestBody.recordId}.`);
  assert(listed.idempotency?.idempotencyKey === idempotencyKey, 'Replay Lab list must expose safe idempotency key metadata.');
  assert(JSON.stringify(listed).includes('fingerprint') === false, 'Replay Lab list must not expose receipt fingerprints.');

  const encodedRecordId = encodeURIComponent(ingestBody.recordId);
  const detailResponse = await fetch(`${baseUrl}/api/replay-lab/cases/${encodedRecordId}`, { headers: authHeaders() });
  assert(detailResponse.status === 200, `Replay Lab detail expected 200, got ${detailResponse.status}: ${await detailResponse.text()}`);
  const detailBody = await detailResponse.json();
  assert(detailBody.ok === true, 'Replay Lab detail response must be ok.');
  assert(detailBody.case.id === ingestBody.recordId, 'Replay Lab detail must return the requested record.');
  assert(detailBody.case.idempotency?.idempotencyKey === idempotencyKey, 'Replay Lab detail must attach safe idempotency metadata.');
  assert(JSON.stringify(detailBody).includes('fingerprint') === false, 'Replay Lab detail must not expose receipt fingerprints.');

  console.log('Replay Lab API smoke test PASS');
  console.log(JSON.stringify({ recordId: ingestBody.recordId, cases: listBody.cases.length }, null, 2));
} catch (error) {
  if (server) {
    console.error(output.join('').trim());
  }
  throw error;
} finally {
  if (server && !server.killed) server.kill('SIGTERM');
  await rm(dataDir, { recursive: true, force: true });
}

async function waitForHealth(url) {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Local Kernel did not become healthy: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function runSample(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/hermes-ingest-sample.mjs'], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.on('error', reject);
    child.on('close', (code) => {
      const [statusLine, ...bodyLines] = stdout.trim().split('\n');
      const status = Number(statusLine?.split(' ')[0]);
      const body = bodyLines.join('\n');
      if (code !== 0) {
        reject(new Error(`Sample client failed with exit ${code}: ${stderr || stdout}`));
        return;
      }
      resolve({ status, body });
    });
  });
}

function authHeaders() {
  return { 'x-hephaestus-token': apiToken };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
