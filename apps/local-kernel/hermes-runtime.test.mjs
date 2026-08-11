import { chmod, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectHermesRuntime, probeHermesReadOnlyRuntime } from './hermes-runtime.mjs';

async function executableAt(path) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, '#!/bin/sh\nexit 0\n', 'utf8');
  await chmod(path, 0o700);
  return path;
}

describe('Hermes runtime detection', () => {
  it('prefers an explicitly configured executable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-hermes-'));
    const executable = await executableAt(join(dir, 'custom-hermes'));
    await expect(detectHermesRuntime({ env: { HEPHAESTUS_HERMES_EXECUTABLE: executable, PATH: '' }, platform: 'linux' }))
      .resolves.toEqual({ available: true, executable, source: 'environment' });
  });

  it('detects the standard Windows Hermes installation', async () => {
    const localAppData = await mkdtemp(join(tmpdir(), 'hephaestus-hermes-'));
    const executable = await executableAt(join(localAppData, 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes.exe'));
    await expect(detectHermesRuntime({ env: { LOCALAPPDATA: localAppData, PATH: '' }, platform: 'win32' }))
      .resolves.toEqual({ available: true, executable, source: 'standard-install' });
  });

  it('uses PATH and fails closed when Hermes is absent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-hermes-'));
    const executable = await executableAt(join(dir, 'hermes'));
    expect((await detectHermesRuntime({ env: { PATH: dir }, platform: 'linux' })).executable).toBe(executable);
    await expect(detectHermesRuntime({ env: { PATH: ['', 'missing'].join(delimiter) }, platform: 'linux' }))
      .resolves.toEqual({ available: false, source: 'not-found' });
  });

  it('does not fall back when an explicit executable is invalid', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-hermes-'));
    await executableAt(join(dir, 'hermes'));
    await expect(detectHermesRuntime({ env: { HEPHAESTUS_HERMES_EXECUTABLE: join(dir, 'missing'), PATH: dir }, platform: 'linux' }))
      .resolves.toEqual({ available: false, source: 'environment' });
  });
});

describe('Hermes automatic read-only capability probe', () => {
  const runtime = { available: true, executable: '/safe/hermes', source: 'test' };

  it('accepts only a runtime advertising one-shot plus isolated search flags', async () => {
    const result = await probeHermesReadOnlyRuntime(runtime, {
      runCommand: async (_executable, args) => {
        expect(args).toEqual(['--help']);
        return { ok: true, stdout: '-z, --oneshot PROMPT\n--toolsets TOOLSETS\n--ignore-rules' };
      },
    });
    expect(result).toEqual({
      ready: true,
      mode: 'bounded_isolated_search_only',
      executable: runtime.executable,
      requiredArgs: ['--ignore-rules', '--toolsets', 'search', '-z'],
    });
  });

  it('fails closed for an older or incompatible runtime', async () => {
    await expect(probeHermesReadOnlyRuntime(runtime, {
      runCommand: async () => ({ ok: true, stdout: '-z, --oneshot PROMPT' }),
    })).resolves.toEqual({ ready: false, reason: 'required_flags_missing' });
  });

  it('fails closed when the runtime is absent or the probe errors', async () => {
    await expect(probeHermesReadOnlyRuntime({ available: false }, {}))
      .resolves.toEqual({ ready: false, reason: 'runtime_unavailable' });
    await expect(probeHermesReadOnlyRuntime(runtime, { runCommand: async () => { throw new Error('boom'); } }))
      .resolves.toEqual({ ready: false, reason: 'probe_failed' });
  });
});
