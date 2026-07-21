#!/usr/bin/env node
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const secret = process.env.IBOS_HERMES_SECRET ?? 'dev-smoke-secret';
const port = Number(process.env.IBOS_HERMES_SMOKE_PORT ?? 4107);
const host = '127.0.0.1';
const baseUrl = `http://${host}:${port}`;
const dataDir = await mkdtemp(join(tmpdir(), 'ibos-hermes-smoke-'));
let server;

try {
  server = spawn(process.execPath, ['apps/local-kernel/server.mjs'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HEPHAESTUS_HOST: host,
      HEPHAESTUS_PORT: String(port),
      HEPHAESTUS_DATA_DIR: dataDir,
      HEPHAESTUS_API_TOKEN: 'smoke-token-that-is-long-enough-32',
      IBOS_HERMES_SECRET: secret,
    },
  });

  const output = [];
  server.stdout.on('data', (chunk) => output.push(chunk.toString('utf8')));
  server.stderr.on('data', (chunk) => output.push(chunk.toString('utf8')));

  await waitForHealth(`${baseUrl}/health`);
  const health = await (await fetch(`${baseUrl}/health`)).json();
  assert(isEnabled(health.hermes), 'Hermes route must be enabled in health response.');

  const idempotencyKey = `hermes-smoke-${Date.now()}`;
  const timestamp = new Date().toISOString();
  const commonEnv = {
    ...process.env,
    IBOS_HERMES_SECRET: secret,
    IBOS_HERMES_INGEST_URL: `${baseUrl}/hermes/ingestions`,
    IBOS_HERMES_IDEMPOTENCY_KEY: idempotencyKey,
    IBOS_HERMES_TIMESTAMP: timestamp,
  };

  const first = await runSample(commonEnv);
  const replay = await runSample(commonEnv);

  assert(first.status === 202, `First ingest expected 202, got ${first.status}: ${first.body}`);
  assert(replay.status === 202, `Replay ingest expected 202, got ${replay.status}: ${replay.body}`);

  const firstBody = JSON.parse(first.body);
  const replayBody = JSON.parse(replay.body);
  assert(firstBody.ok === true, 'First ingest response must be ok.');
  assert(replayBody.ok === true, 'Replay ingest response must be ok.');
  assert(firstBody.recordId === replayBody.recordId, 'Replay must return the original cognitive record id.');

  console.log('Hermes smoke test PASS');
  console.log(JSON.stringify({ recordId: firstBody.recordId, replayRecordId: replayBody.recordId }, null, 2));
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

function isEnabled(value) {
  return value === true || value?.enabled === true;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
