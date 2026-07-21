#!/usr/bin/env node
import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const secret = process.env.IBOS_HERMES_SECRET ?? 'dev-attack-smoke-secret';
const port = Number(process.env.IBOS_HERMES_ATTACK_SMOKE_PORT ?? 4108);
const host = '127.0.0.1';
const baseUrl = `http://${host}:${port}`;
const dataDir = await mkdtemp(join(tmpdir(), 'ibos-hermes-attack-smoke-'));
let server;

try {
  server = spawn(process.execPath, ['apps/local-kernel/server.mjs'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HEPHAESTUS_HOST: host,
      HEPHAESTUS_PORT: String(port),
      HEPHAESTUS_DATA_DIR: dataDir,
      HEPHAESTUS_API_TOKEN: 'attack-smoke-token-that-is-long-enough-32',
      IBOS_HERMES_SECRET: secret,
    },
  });

  const output = [];
  server.stdout.on('data', (chunk) => output.push(chunk.toString('utf8')));
  server.stderr.on('data', (chunk) => output.push(chunk.toString('utf8')));

  await waitForHealth(`${baseUrl}/health`);
  const health = await (await fetch(`${baseUrl}/health`)).json();
  assert(isEnabled(health.hermes), 'Hermes route must be enabled in health response.');

  const idempotencyKey = `hermes-attack-smoke-${Date.now()}`;
  const timestamp = new Date().toISOString();
  const first = await ingest({ idempotencyKey, timestamp, statement: 'Hermes idempotency attack smoke baseline claim.', confidence: 0.9 });
  const replay = await ingest({ idempotencyKey, timestamp, statement: 'Hermes idempotency attack smoke baseline claim.', confidence: 0.9 });
  const altered = await ingest({ idempotencyKey, timestamp, statement: 'ALTERED claim trying to reuse the same idempotency key.', confidence: 0.1 });

  assert(first.status === 202, `First ingest expected 202, got ${first.status}: ${first.body}`);
  assert(replay.status === 202, `Replay ingest expected 202, got ${replay.status}: ${replay.body}`);
  assert(altered.status === 409, `Altered retry expected 409 conflict, got ${altered.status}: ${altered.body}`);

  const firstBody = JSON.parse(first.body);
  const replayBody = JSON.parse(replay.body);
  const alteredBody = JSON.parse(altered.body);
  assert(firstBody.ok === true, 'First ingest response must be ok.');
  assert(replayBody.ok === true, 'Replay ingest response must be ok.');
  assert(firstBody.recordId === replayBody.recordId, 'Replay must return the original cognitive record id.');
  assert(alteredBody.ok === false, 'Altered retry response must not be ok.');

  console.log('Hermes idempotency attack test PASS');
  console.log(JSON.stringify({
    recordId: firstBody.recordId,
    replayRecordId: replayBody.recordId,
    alteredStatus: altered.status,
    alteredCode: alteredBody.code,
  }, null, 2));
} finally {
  if (server && !server.killed) server.kill('SIGTERM');
  await rm(dataDir, { recursive: true, force: true });
}

async function ingest({ idempotencyKey, timestamp, statement, confidence }) {
  const body = JSON.stringify({
    idempotencyKey,
    recordId: `pipeline-${idempotencyKey}`,
    resultId: `result-${idempotencyKey}`,
    events: [
      {
        type: 'run_started',
        missionId: 'mission-hermes-attack-smoke',
        taskId: 'task-hermes-attack-smoke',
        at: timestamp,
      },
      {
        type: 'evidence_recorded',
        evidenceId: 'evidence-hermes-attack-smoke-1',
        requirementKey: 'source',
        verified: true,
        at: timestamp,
      },
      {
        type: 'claim_proposed',
        proposalId: 'proposal-hermes-attack-smoke-1',
        statement,
        confidence,
        evidenceIds: ['evidence-hermes-attack-smoke-1'],
        at: timestamp,
      },
      {
        type: 'run_completed',
        summary: 'Hermes idempotency attack smoke execution completed.',
        at: timestamp,
      },
    ],
  });

  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${idempotencyKey}.${body}`)
    .digest('hex');

  const response = await fetch(`${baseUrl}/hermes/ingestions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ibos-idempotency-key': idempotencyKey,
      'x-ibos-timestamp': timestamp,
      'x-ibos-signature': signature,
    },
    body,
  });

  return { status: response.status, body: await response.text() };
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

function isEnabled(value) {
  return value === true || value?.enabled === true;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
