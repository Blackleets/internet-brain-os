import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const SCHEMA = 'efesto.hermes-acceptance.v1';
export const ACCEPTANCE_ORIGIN = 'http://127.0.0.1:4173';

export function redact(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[A-Fa-f0-9]{32,}/g, '<redacted-token>')
    .replace(/[A-Za-z]:\\[^\s"']+/g, '<redacted-path>')
    .replace(/\/(?:home|Users)\/[^\s"']+/g, '<redacted-path>')
    .slice(0, 500);
}

export function assertLoopback(baseUrl) {
  const url = new URL(baseUrl);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Acceptance runner only targets a loopback Kernel');
  }
  return url.href.replace(/\/$/, '');
}

export async function api(baseUrl, token, path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'x-hephaestus-token': token,
      ...(init.origin ? { origin: init.origin } : {}),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : undefined; } catch { body = undefined; }
  return { status: response.status, body };
}

export async function createIsolatedDataDir() {
  return mkdtemp(join(tmpdir(), 'efesto-acceptance-'));
}

export async function removeDataDir(dataDir) {
  if (!dataDir) return;
  await rm(dataDir, { recursive: true, force: true }).catch(() => {});
}

export function startKernel({ dataDir, port, internalPort, token, hermesExecutable, autoRuntime = true }) {
  const entry = autoRuntime ? 'apps/local-kernel/one-click-kernel.mjs' : 'apps/local-kernel/server.mjs';
  const child = spawn(process.execPath, [resolve(entry)], {
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HEPHAESTUS_HOST: '127.0.0.1',
      HEPHAESTUS_PORT: String(port),
      HEPHAESTUS_INTERNAL_PORT: String(internalPort),
      HEPHAESTUS_DATA_DIR: dataDir,
      HEPHAESTUS_API_TOKEN: token,
      HEPHAESTUS_PAIRING: '0',
      ...(autoRuntime ? {} : {
        HEPHAESTUS_HERMES_READY: '1',
        HEPHAESTUS_HERMES_READ_ONLY_READY: '1',
      }),
      ...(hermesExecutable && autoRuntime ? { HEPHAESTUS_HERMES_EXECUTABLE: hermesExecutable } : {}),
    },
  });
  const logs = [];
  const capture = (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) if (line.trim()) logs.push(redact(line));
    while (logs.length > 200) logs.shift();
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  return { child, logs };
}

export async function waitForHealth(baseUrl, timeoutMs = 40_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return true;
    } catch {}
    await sleep(200);
  }
  return false;
}

export async function stopKernel(handle) {
  if (!handle?.child || handle.child.exitCode !== null) return;
  handle.child.kill();
  await sleep(400);
  if (handle.child.exitCode === null) handle.child.kill('SIGKILL');
}

export async function isPortFree(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1_500) });
    return !response.ok;
  } catch {
    return true;
  }
}

export function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}
