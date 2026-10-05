import { chmod, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { PageContextInbox } from '../apps/local-kernel/page-context-inbox.mjs';
import { createLocalKernelServer } from '../apps/local-kernel/server.mjs';
import { AgentPresence } from '../apps/local-kernel/agent-presence.mjs';

async function runDoctor(env) {
  const { spawn } = await import('node:child_process');
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [resolve('scripts/hermes-worker-doctor.mjs')], { cwd: resolve('.'), env: { ...process.env, ...env } });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.on('close', (status) => resolvePromise({ status, stdout }));
  });
}

async function makeExecutable(path) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, '#!/bin/sh\nexit 0\n', 'utf8');
  await chmod(path, 0o700);
}

describe('Hermes worker doctor', () => {
  it('reuses private one-click state and hides secrets and paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hephaestus-doctor-'));
    const token = 's'.repeat(64);
    const tokenFile = join(root, 'kernel-api-token');
    const hermes = join(root, 'bin', 'hermes');
    await writeFile(tokenFile, `${token}\n`, { mode: 0o600 });
    await makeExecutable(hermes);

    const result = spawnSync(process.execPath, [resolve('scripts/hermes-worker-doctor.mjs')], {
      cwd: resolve('.'),
      encoding: 'utf8',
      env: {
        ...process.env,
        HEPHAESTUS_DATA_DIR: root,
        HEPHAESTUS_HERMES_EXECUTABLE: hermes,
        HEPHAESTUS_KERNEL_URL: 'http://127.0.0.1:65534',
      },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('PASS  API token: configured (value and path hidden)');
    expect(result.stdout).toContain('PASS  Hermes adapter: bundled adapter and Hermes runtime detected (path hidden)');
    expect(result.stdout).toContain('PASS  Hermes adapter arguments: bundled adapter selected; no manual arguments required');
    expect(result.stdout).not.toContain(token);
    expect(result.stdout).not.toContain(root);
  });

  it('preserves the explicit legacy adapter contract', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hephaestus-doctor-'));
    const adapter = join(root, 'adapter');
    await makeExecutable(adapter);
    const result = spawnSync(process.execPath, [resolve('scripts/hermes-worker-doctor.mjs')], {
      encoding: 'utf8',
      env: {
        ...process.env,
        HEPHAESTUS_API_TOKEN: 't'.repeat(64),
        HEPHAESTUS_HERMES_COMMAND: adapter,
        HEPHAESTUS_HERMES_ARGS_JSON: '["--json"]',
        HEPHAESTUS_KERNEL_URL: 'http://127.0.0.1:65534',
      },
    });
    expect(result.stdout).toContain('PASS  Hermes adapter: legacy adapter executable found (path hidden)');
    expect(result.stdout).toContain('PASS  Hermes adapter arguments: 1 configured argument(s); values hidden');
    expect(result.stdout).not.toContain(adapter);
  });

  it('verifies the token with the authenticated agent ping and records the worker contact; a wrong token fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hephaestus-doctor-'));
    const adapter = join(root, 'adapter');
    await makeExecutable(adapter);
    const apiToken = 'doctor-ping-test-token-at-least-32-characters';
    const presence = new AgentPresence();
    const server = createLocalKernelServer(new PageContextInbox(join(root, 'inbox.jsonl')), undefined, undefined, undefined, { apiToken, agentPresence: presence });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    try {
      const env = { HEPHAESTUS_HERMES_COMMAND: adapter, HEPHAESTUS_HERMES_ARGS_JSON: '["--json"]', HEPHAESTUS_KERNEL_URL: `http://127.0.0.1:${server.address().port}` };
      const wrong = await runDoctor({ ...env, HEPHAESTUS_API_TOKEN: 'w'.repeat(48) });
      expect(wrong.stdout).toContain('FAIL  Kernel reachability: HTTP 401');
      expect(presence.contact('hermes').lastPingAt).toBeUndefined();
      const right = await runDoctor({ ...env, HEPHAESTUS_API_TOKEN: apiToken });
      expect(right.stdout).toContain('PASS  Kernel reachability: HTTP 200; token accepted');
      expect(right.stdout).not.toContain(apiToken);
      expect(presence.contact('hermes')).toMatchObject({ lastSeenVia: 'ping' });
    } finally {
      await new Promise((done) => server.close(done));
    }
  });
});
