import { chmod, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectHermesRuntime } from './hermes-runtime.mjs';

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
    await expect(detectHermesRuntime({
      env: { HEPHAESTUS_HERMES_EXECUTABLE: executable, PATH: '' },
      platform: 'linux',
    })).resolves.toEqual({ available: true, executable, source: 'environment' });
  });

  it('detects the standard Windows Hermes installation', async () => {
    const localAppData = await mkdtemp(join(tmpdir(), 'hephaestus-hermes-'));
    const executable = await executableAt(join(localAppData, 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes.exe'));
    await expect(detectHermesRuntime({
      env: { LOCALAPPDATA: localAppData, PATH: '' },
      platform: 'win32',
    })).resolves.toEqual({ available: true, executable, source: 'standard-install' });
  });

  it('uses PATH and fails closed when Hermes is absent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-hermes-'));
    const executable = await executableAt(join(dir, 'hermes'));
    expect((await detectHermesRuntime({ env: { PATH: dir }, platform: 'linux' })).executable).toBe(executable);
    await expect(detectHermesRuntime({
      env: { PATH: ['', 'missing'].join(delimiter) },
      platform: 'linux',
    })).resolves.toEqual({ available: false, source: 'not-found' });
  });

  it('does not fall back when an explicit executable is invalid', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-hermes-'));
    await executableAt(join(dir, 'hermes'));
    await expect(detectHermesRuntime({
      env: { HEPHAESTUS_HERMES_EXECUTABLE: join(dir, 'missing'), PATH: dir },
      platform: 'linux',
    })).resolves.toEqual({ available: false, source: 'environment' });
  });
});
