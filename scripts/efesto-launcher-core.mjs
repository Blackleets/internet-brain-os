import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defaultEfestoPaths, inspectEfestoBootstrap, readLauncherConfig } from './efesto-bootstrap.mjs';

export async function repairEfestoLauncher(options = {}) {
  const ops = launcherOps(options);
  const before = await ops.inspect();
  await ops.ensureDirectories();
  if (before.kernel === 'ready') {
    await ops.writeLog('Efesto already ready; no duplicate Kernel process started.');
    return { started: false, status: before };
  }
  if (before.kernel === 'port_conflict') {
    await ops.writeLog('Repair stopped: port conflict detected.');
    return { started: false, status: before };
  }
  if (before.kernel === 'stale') await ops.removeStalePidFile(before.diagnostics?.kernel?.pid);
  const started = await ops.startKernel();
  const status = await ops.waitForReady(started);
  await ops.writeLog(`Repair finished with ${status.overall}.`);
  return { started: true, pid: started?.pid, status };
}

export async function shutdownEfestoLauncher(options = {}) {
  const ops = launcherOps(options);
  const status = await ops.inspect();
  const kernel = status.diagnostics?.kernel ?? {};
  if (kernel.pid && kernel.owned === true && kernel.verified === true) {
    await ops.stopOwnedProcess(kernel.pid);
    await ops.writeLog('Efesto Kernel shutdown requested for owned launcher process.');
    return { stopped: true, status };
  }
  await ops.writeLog(`Shutdown skipped: no safely verified Efesto Kernel process was found (${kernel.reason ?? 'not_verified'}).`);
  return { stopped: false, status };
}

export async function openEfestoLauncher(options = {}) {
  const ops = launcherOps(options);
  const status = await ops.inspect();
  if (status.overall !== 'ready') return { opened: false, status };
  await ops.openEfesto();
  return { opened: true, status };
}

export function launcherOps(options = {}) {
  if (options.ops) return options.ops;
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const paths = options.paths ?? defaultEfestoPaths(env, cwd);
  return {
    inspect: () => inspectEfestoBootstrap({ ...options, env, cwd, paths }),
    ensureDirectories: () => mkdir(dirname(paths.logFile), { recursive: true }),
    writeLog: (message) => appendLog(paths.logFile, message),
    removeStalePidFile: () => rm(paths.pidFile, { force: true }),
    startKernel: () => startKernelProcess({ env, cwd, paths }),
    waitForReady: () => waitForReady({ ...options, env, cwd, paths }),
    stopOwnedProcess: async (pid) => { try { process.kill(Number(pid), 'SIGTERM'); } catch {} await rm(paths.pidFile, { force: true }); },
    openEfesto: () => openEfesto(env),
  };
}

export function buildKernelChildEnv(env = process.env, config = {}) {
  return {
    ...env,
    HEPHAESTUS_PAIRING: env.HEPHAESTUS_PAIRING ?? '1',
    ...(config.obsidianDir && !env.HEPHAESTUS_OBSIDIAN_DIR ? { HEPHAESTUS_OBSIDIAN_DIR: config.obsidianDir } : {}),
  };
}

async function startKernelProcess({ env, cwd, paths }) {
  await mkdir(dirname(paths.pidFile), { recursive: true });
  const config = await readLauncherConfig({ paths, env, cwd });
  const scriptPath = resolve(cwd, 'apps/local-kernel/one-click-kernel.mjs');
  const nonce = randomUUID();
  const commandFingerprint = 'apps/local-kernel/one-click-kernel.mjs';
  const child = spawn(process.execPath, [scriptPath, '--efesto-launcher-nonce', nonce], {
    cwd,
    shell: false,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'ignore'],
    env: buildKernelChildEnv(env, config),
  });
  child.unref();
  const record = { owner: 'efesto-launcher-v1', pid: child.pid, startedAt: new Date().toISOString(), command: scriptPath, commandFingerprint, nonce };
  await writeFile(paths.pidFile, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return { pid: child.pid };
}

async function waitForReady(options = {}) {
  const deadline = Date.now() + Number(options.timeoutMs ?? 20_000);
  let latest;
  while (Date.now() < deadline) {
    latest = await inspectEfestoBootstrap(options);
    if (latest.kernel === 'ready' || latest.kernel === 'port_conflict' || latest.kernel === 'failed') return latest;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  return latest ?? await inspectEfestoBootstrap(options);
}

async function appendLog(path, message) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${new Date().toISOString()} ${sanitizeLog(message)}\n`, { flag: 'a', encoding: 'utf8' });
}

function openEfesto(env) {
  const target = env.EFESTO_EXTENSION_URL ?? 'chrome://extensions/';
  if (process.platform === 'win32') {
    const child = spawn('cmd.exe', ['/c', 'start', '', target], { shell: false, windowsHide: true, stdio: 'ignore' });
    child.unref();
    return;
  }
  const child = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [target], { shell: false, windowsHide: true, stdio: 'ignore' });
  child.unref();
}

function sanitizeLog(value) {
  return String(value).replace(/\b(?:token|secret|authorization|cookie)\b\s*[:=]\s*\S+/giu, '$1=[REDACTED]').replace(/\b[A-Za-z0-9._~+/=-]{48,}\b/g, '[REDACTED]').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2] ?? 'repair';
  const result = command === 'shutdown'
    ? await shutdownEfestoLauncher()
    : command === 'open'
      ? await openEfestoLauncher()
      : await repairEfestoLauncher();
  process.stdout.write(`${JSON.stringify(result.status ?? result, null, 2)}\n`);
  if ((result.status?.overall ?? 'ready') === 'failed') process.exitCode = 1;
}
