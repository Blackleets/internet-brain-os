import { chmod, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

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
});
