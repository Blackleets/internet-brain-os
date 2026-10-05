import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { launcherOps, repairEfestoLauncher, shutdownEfestoLauncher } from './efesto-launcher-core.mjs';
import { launcherRuntimeNeedsAttention } from './efesto-launcher.mjs';

const dirs = [];
const exec = promisify(execFile);
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
const ready = {
  kernel: 'ready', hermes: 'ready', pairing: 'paired', overall: 'ready',
  diagnostics: { kernel: { pid: 4242, owned: true, verified: true } },
};

describe('launcher stop failure remains observable and recoverable', () => {
  it.each([2, 124])('retains the original process record when Windows taskkill returns %s', async (code) => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-stop-failure-'));
    dirs.push(dir);
    const pidFile = join(dir, 'process.json');
    const original = JSON.stringify({ owner: 'efesto-launcher-v1', pid: 4242, nonce: 'keep-this-record' });
    await writeFile(pidFile, original);
    const ops = launcherOps({ paths: { pidFile }, platform: 'win32', runStopCommand: async () => ({ code }) });
    expect(await ops.stopOwnedProcess(4242)).toMatchObject({ stopped: false, code });
    expect(await readFile(pidFile, 'utf8')).toBe(original);
  });
  it('removes the process record only after a successful stop request', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-stop-success-'));
    dirs.push(dir);
    const pidFile = join(dir, 'process.json');
    await writeFile(pidFile, 'owned record');
    const ops = launcherOps({ paths: { pidFile }, platform: 'win32', runStopCommand: async () => ({ code: 0 }) });
    expect(await ops.stopOwnedProcess(4242)).toMatchObject({ stopped: true });
    await expect(readFile(pidFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('reports an unsuccessful shutdown instead of claiming it was requested successfully', async () => {
    const ops = { inspect: async () => ready, stopOwnedProcess: async () => ({ stopped: false, code: 2 }), writeLog: async () => {} };
    expect(await shutdownEfestoLauncher({ ops })).toMatchObject({ stopped: false, reason: 'stop_failed', status: ready });
  });
  it('does not wait or start another Kernel after a rejected pairing restart stop', async () => {
    const calls = [];
    const status = { ...ready, pairing: 'required', overall: 'needs_setup' };
    const ops = {
      inspect: async () => status, ensureDirectories: async () => {}, writeLog: async () => {},
      stopOwnedProcess: async () => ({ stopped: false, code: 2 }),
      waitForStopped: async () => { calls.push('wait'); return status; },
      startKernel: async () => { calls.push('start'); return {}; }, waitForReady: async () => status,
    };
    const result = await repairEfestoLauncher({ ops });
    expect(result).toMatchObject({ started: false, reason: 'stop_failed' });
    expect(calls).toEqual([]);
  });
  it('does not start another Kernel when the bounded stop wait still reports ready', async () => {
    let starts = 0;
    const status = { ...ready, pairing: 'required', overall: 'needs_setup' };
    const ops = {
      inspect: async () => status, ensureDirectories: async () => {}, writeLog: async () => {},
      stopOwnedProcess: async () => ({ stopped: true }), waitForStopped: async () => status,
      startKernel: async () => { starts++; return {}; }, waitForReady: async () => status,
    };
    expect(await repairEfestoLauncher({ ops })).toMatchObject({ started: false, reason: 'stop_not_confirmed' });
    expect(starts).toBe(0);
  });
  it.each(['stop_failed', 'stop_not_confirmed'])('treats %s as a CLI failure even with healthy Hermes', (reason) => {
    expect(launcherRuntimeNeedsAttention({ overall: 'needs_setup', hermes: 'ready' }, { reason })).toBe(true);
  });
  it.each(['repair', 'shutdown'])('exits nonzero and explains the failed stop in the actual %s CLI', async (command) => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-stop-cli-'));
    dirs.push(dir);
    await copyFile(new URL('./efesto-launcher.mjs', import.meta.url), join(dir, 'efesto-launcher.mjs'));
    await writeFile(join(dir, 'efesto-bootstrap.mjs'), 'export async function inspectEfestoBootstrap() {}\nexport async function writeLauncherConfig() {}\n');
    const result = { started: false, stopped: false, reason: 'stop_failed', status: { ...ready, actions: [], message: 'Kernel remains running' } };
    await writeFile(join(dir, 'efesto-launcher-core.mjs'), `const result = ${JSON.stringify(result)};\nexport async function repairEfestoLauncher(){return result;}\nexport async function shutdownEfestoLauncher(){return result;}\nexport async function openEfestoLauncher(){return result;}\n`);
    const output = await exec(process.execPath, [join(dir, 'efesto-launcher.mjs'), command], { timeout: 5000 }).catch(error => error);
    expect(output.code).toBe(1);
    expect(output.stderr).toMatch(/record.*retained/);
    if (command === 'shutdown') expect(output.stdout).not.toContain('Shutdown requested');
  });
});
