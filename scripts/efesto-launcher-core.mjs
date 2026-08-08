import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defaultEfestoPaths, inspectEfestoBootstrap, readLauncherConfig } from './efesto-bootstrap.mjs';

export async function repairEfestoLauncher(options = {}) {
  const ops = launcherOps(options);
  let before = await ops.inspect();
  await ops.ensureDirectories();

  if (before.kernel === 'ready' && before.pairing === 'paired') {
    await ops.writeLog('Efesto already ready; no duplicate Kernel process started.');
    return { started: false, status: before };
  }

  if (before.kernel === 'ready' && before.pairing === 'required') {
    const kernel = before.diagnostics?.kernel ?? {};
    if (!(kernel.pid && kernel.owned === true && kernel.verified === true)) {
      await ops.writeLog(`Pairing recovery blocked because the existing Kernel process is not safely verified (${kernel.reason ?? 'not_verified'}).`);
      return { started: false, status: before };
    }
    await ops.writeLog('Pairing is required; safely restarting the owned Kernel to issue a fresh one-time pairing code.');
    await ops.stopOwnedProcess(kernel.pid);
    if (ops.waitForStopped) await ops.waitForStopped();
    before = await ops.inspect();
  }

  if (before.kernel === 'port_conflict') {
    await ops.writeLog('Repair stopped: port conflict detected.');
    return { started: false, status: before };
  }
  if (before.kernel === 'stale') await ops.removeStalePidFile(before.diagnostics?.kernel?.pid);
  const started = await ops.startKernel({ showPairing: before.pairing === 'required' });
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
    startKernel: ({ showPairing = false } = {}) => startKernelProcess({ env, cwd, paths, showPairing }),
    waitForReady: () => waitForReady({ ...options, env, cwd, paths }),
    waitForStopped: () => waitForStopped({ ...options, env, cwd, paths }),
    stopOwnedProcess: async (pid) => {
      await stopLauncherProcessTree(pid, options);
      await rm(paths.pidFile, { force: true });
    },
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

export async function stopLauncherProcessTree(pid, options = {}) {
  const numericPid = Number(pid);
  if (!Number.isInteger(numericPid) || numericPid <= 0) return { stopped: false, reason: 'invalid_pid' };
  const platform = options.platform ?? process.platform;

  if (platform === 'win32') {
    const runner = options.runStopCommand ?? runHiddenCommand;
    const result = await runner('taskkill.exe', ['/PID', String(numericPid), '/T', '/F'], { timeoutMs: 5000 });
    return { stopped: result.code === 0, code: result.code };
  }

  try {
    process.kill(numericPid, 'SIGTERM');
    return { stopped: true };
  } catch {
    return { stopped: false, reason: 'not_alive' };
  }
}

async function startKernelProcess({ env, cwd, paths, showPairing = false }) {
  await mkdir(dirname(paths.pidFile), { recursive: true });
  const config = await readLauncherConfig({ paths, env, cwd });
  const scriptPath = resolve(cwd, 'apps/local-kernel/one-click-kernel.mjs');
  const nonce = randomUUID();
  const commandFingerprint = 'apps/local-kernel/one-click-kernel.mjs';
  const child = spawn(process.execPath, [scriptPath, '--efesto-launcher-nonce', nonce], {
    cwd,
    shell: false,
    detached: true,
    windowsHide: !showPairing,
    stdio: showPairing ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'ignore', 'ignore'],
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
    await sleep(250);
  }
  return latest ?? await inspectEfestoBootstrap(options);
}

async function waitForStopped(options = {}) {
  const deadline = Date.now() + Number(options.stopTimeoutMs ?? 5_000);
  let latest;
  while (Date.now() < deadline) {
    latest = await inspectEfestoBootstrap(options);
    if (latest.kernel !== 'ready') return latest;
    await sleep(150);
  }
  return latest ?? await inspectEfestoBootstrap(options);
}

function runHiddenCommand(command, args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, stdio: 'ignore' });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(result);
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      finish({ code: 124 });
    }, options.timeoutMs ?? 5000);
    child.once('error', () => finish({ code: 127 }));
    child.once('close', (code) => finish({ code: code ?? 1 }));
  });
}

function sleep(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }

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
