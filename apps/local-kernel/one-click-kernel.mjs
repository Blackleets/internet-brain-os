import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runHermesMissionWorker } from './hermes-mission-worker.mjs';

const host = process.env.HEPHAESTUS_HOST ?? '127.0.0.1';
const port = Number(process.env.HEPHAESTUS_PORT ?? 4000);
const internalPort = Number(process.env.HEPHAESTUS_INTERNAL_PORT ?? port + 1);
const internalBaseUrl = `http://127.0.0.1:${internalPort}`;
const MAX_PROXY_BODY_BYTES = 1024 * 1024;
const activeRuns = new Map();
let shuttingDown = false;
let proxy;

if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(String(host).toLowerCase())) {
  throw new Error('HEPHAESTUS_HOST must be a loopback address');
}
if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isInteger(internalPort) || internalPort < 1 || internalPort > 65535 || port === internalPort) {
  throw new Error('Kernel ports must be distinct valid TCP ports');
}

configureBundledHermes();

const kernel = spawn(process.execPath, [resolve('apps/local-kernel/server.mjs')], {
  shell: false,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, HEPHAESTUS_HOST: '127.0.0.1', HEPHAESTUS_PORT: String(internalPort) },
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

proxy = createServer(async (request, response) => {
  try {
    const body = await readBody(request);
    const headers = forwardHeaders(request.headers);
    const upstream = await fetch(`${internalBaseUrl}${request.url ?? '/'}`, {
      method: request.method,
      headers,
      body: body.length ? body : undefined,
      redirect: 'manual',
    });
    const payload = Buffer.from(await upstream.arrayBuffer());
    response.statusCode = upstream.status;
    for (const [name, value] of upstream.headers) {
      if (!['content-length', 'transfer-encoding', 'connection'].includes(name.toLowerCase())) response.setHeader(name, value);
    }
    response.end(payload);

    if (isMissionStart(request, upstream.status)) {
      const token = String(request.headers['x-hephaestus-token'] ?? '').trim();
      const parsed = parseJson(payload);
      if (token && parsed?.mission) startMissionRuntime(parsed.mission, token);
    }
  } catch (error) {
    if (response.headersSent) return response.destroy(error instanceof Error ? error : undefined);
    response.statusCode = 502;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ ok: false, code: 'KERNEL_PROXY_FAILED', error: safeMessage(error) }));
  }
});

proxy.listen(port, host, () => {
  console.log(`Hephaestus one-click Kernel listening on http://${host}:${port}`);
  console.log('Efesto Research now starts Hermes automatically; manual mission-worker commands are not required.');
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
  const run = runHermesMissionWorker({
    baseUrl: internalBaseUrl,
    apiToken,
    command: process.execPath,
    args: [resolve('scripts/hermes-efesto-adapter.mjs')],
  })
    .then((result) => console.log(`Hermes mission ${mission.id}: ${result.status}`))
    .catch((error) => console.error(`Hermes mission ${mission.id} failed: ${safeMessage(error)}`))
    .finally(() => activeRuns.delete(mission.id));
  activeRuns.set(mission.id, run);
}

function configureBundledHermes() {
  if (process.env.HEPHAESTUS_HERMES_EXECUTABLE) return;
  const localAppData = process.env.LOCALAPPDATA;
  const candidate = localAppData
    ? join(localAppData, 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes.exe')
    : undefined;
  process.env.HEPHAESTUS_HERMES_EXECUTABLE = candidate && existsSync(candidate) ? candidate : 'hermes';
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

function isMissionStart(request, status) {
  return request.method === 'POST'
    && status >= 200 && status < 300
    && /^\/api\/goals\/[^/]+\/missions$/.test(request.url ?? '');
}

function forwardHeaders(headers) {
  const forwarded = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined && !['host', 'connection', 'content-length'].includes(name.toLowerCase())) forwarded[name] = value;
  }
  return forwarded;
}

async function readBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_PROXY_BODY_BYTES) throw new Error('Request body exceeded the proxy limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseJson(value) {
  try { return JSON.parse(value.toString('utf8')); }
  catch { return undefined; }
}

function safeMessage(error) {
  return String(error instanceof Error ? error.message : error).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500);
}
