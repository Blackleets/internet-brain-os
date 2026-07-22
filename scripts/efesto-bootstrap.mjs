import { spawn } from 'node:child_process';
import { access, constants, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deriveEfestoBootstrapStatus } from '../apps/local-kernel/efesto-bootstrap-status.mjs';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4000;
const DEFAULT_TIMEOUT_MS = 3000;

export function defaultEfestoPaths(env = process.env, cwd = process.cwd()) {
  const dataDir = resolve(env.HEPHAESTUS_DATA_DIR ?? join(cwd, '.hephaestus'));
  return {
    repoRoot: cwd,
    dataDir,
    configFile: resolve(dataDir, 'efesto-launcher-config.json'),
    pidFile: resolve(dataDir, 'efesto-launcher-process.json'),
    tokenFile: resolve(dataDir, 'kernel-api-token'),
    extensionRegistryFile: resolve(dataDir, 'authorized-extensions.json'),
    logFile: resolve(dataDir, 'logs', 'efesto-launcher.log'),
  };
}

export async function inspectEfestoBootstrap(options = {}) {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const paths = options.paths ?? defaultEfestoPaths(env, cwd);
  const config = { ...(await readJsonOptional(paths.configFile)), ...(options.config ?? {}) };
  const port = Number(env.HEPHAESTUS_PORT ?? config.port ?? DEFAULT_PORT);
  const host = env.HEPHAESTUS_HOST ?? config.host ?? DEFAULT_HOST;
  const baseUrl = `http://${host}:${port}`;
  const [kernelProbe, hermesProbe, obsidianProbe, pairingProbe, processProbe] = await Promise.all([
    probeKernel(baseUrl, port, options),
    probeHermes(env, options),
    probeObsidian({ env, config, paths, options }),
    probePairing(paths),
    probeLauncherProcess(paths, options),
  ]);
  return deriveEfestoBootstrapStatus({ kernelProbe, hermesProbe, obsidianProbe, pairingProbe, processProbe });
}

export async function probeKernel(baseUrl, port, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${baseUrl}/status`, { signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS) });
    const payload = await response.json().catch(() => ({}));
    return {
      reachable: true,
      ok: response.ok && payload?.service === 'hephaestus-local-kernel' && payload?.kernel === 'ready',
      service: payload?.service,
      port,
    };
  } catch (error) {
    return { reachable: false, portOpen: await isPortOpen(port, options), port, error: error?.name === 'TimeoutError' ? 'timeout' : undefined };
  }
}

export async function probeHermes(env = process.env, options = {}) {
  const executable = env.HEPHAESTUS_HERMES_EXECUTABLE?.trim() || await resolveDefaultHermes(env, options);
  if (!executable) return { found: false, valid: false };
  try {
    const shouldValidate = options.validateHermes === true || env.EFESTO_VALIDATE_HERMES === '1';
    if (!shouldValidate) return { found: true, valid: true, executable };
    const runner = options.runHermesValidation ?? runCommand;
    const result = await runner(executable, ['--version'], { timeoutMs: 5000 });
    return result.code === 0
      ? { found: true, valid: true, executable }
      : { found: true, valid: false, executable, error: `exit ${result.code}` };
  } catch (error) {
    return { found: true, valid: false, executable, error: safeMessage(error) };
  }
}

export async function probeObsidian({ env = process.env, config = {}, paths, options = {} }) {
  const configuredPath = env.HEPHAESTUS_OBSIDIAN_DIR ?? config.obsidianDir;
  if (!configuredPath) return { configured: false };
  const vaultPath = resolve(configuredPath);
  const probePath = join(vaultPath, '.efesto-write-test');
  try {
    if (options.writeObsidianProbe) await options.writeObsidianProbe({ vaultPath, probePath });
    else {
      await mkdir(vaultPath, { recursive: true });
      await writeFile(probePath, 'efesto write probe\n', { flag: 'w' });
      await rm(probePath, { force: true });
    }
    return { configured: true, writable: true, path: vaultPath, vaultRelativePath: config.obsidianLabel ?? 'configured vault' };
  } catch (error) {
    return { configured: true, writable: false, path: vaultPath, error: error?.code ?? safeMessage(error) };
  }
}

export async function probePairing(paths) {
  const tokenPresent = await existsFile(paths.tokenFile);
  const registry = await readJsonOptional(paths.extensionRegistryFile);
  const paired = Array.isArray(registry?.extensionIds) && registry.extensionIds.length > 0;
  return { tokenPresent, paired, registryPresent: registry !== undefined };
}

export async function probeLauncherProcess(paths, options = {}) {
  const record = await readJsonOptional(paths.pidFile);
  if (!record?.pid) return { pidFilePresent: false };
  const alive = options.isProcessAlive ? await options.isProcessAlive(record.pid) : isProcessAlive(record.pid);
  const owned = record.owner === 'efesto-launcher-v1';
  const identity = alive && owned ? await verifyProcessIdentity(record, options) : { verified: false, reason: alive ? 'owner_mismatch' : 'not_alive' };
  return { pidFilePresent: true, pid: record.pid, alive, owned, verified: Boolean(identity.verified), reason: identity.reason, nonce: identity.verified ? record.nonce : undefined };
}

export async function writeLauncherConfig(config, options = {}) {
  const paths = options.paths ?? defaultEfestoPaths(options.env ?? process.env, options.cwd ?? process.cwd());
  const current = await readJsonOptional(paths.configFile) ?? {};
  const next = { ...current, ...config, updatedAt: new Date().toISOString() };
  await mkdir(dirname(paths.configFile), { recursive: true });
  await writeFile(paths.configFile, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return next;
}

export async function readLauncherConfig(options = {}) {
  const paths = options.paths ?? defaultEfestoPaths(options.env ?? process.env, options.cwd ?? process.cwd());
  return await readJsonOptional(paths.configFile) ?? {};
}

async function resolveDefaultHermes(env, options) {
  const localAppData = env.LOCALAPPDATA;
  const bundled = localAppData ? join(localAppData, 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes.exe') : undefined;
  if (bundled && await executableExists(bundled)) return bundled;
  return resolveCommand('hermes', env, options);
}

async function resolveCommand(command, env = process.env, options = {}) {
  if (options.resolveCommand) return options.resolveCommand(command);
  const delimiter = process.platform === 'win32' ? ';' : ':';
  const pathExt = process.platform === 'win32' ? (env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';') : [''];
  for (const directory of String(env.PATH ?? '').split(delimiter).filter(Boolean)) {
    for (const extension of pathExt) {
      const candidate = resolve(directory, process.platform === 'win32' && extension && !/\.[a-z0-9]+$/i.test(command) ? `${command}${extension.toLowerCase()}` : command);
      if (await executableExists(candidate)) return candidate;
    }
  }
  return undefined;
}

async function executableExists(path) {
  try { await access(path, constants.X_OK); return true; } catch { return false; }
}

async function readJsonOptional(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error?.code === 'ENOENT') return undefined; throw error; }
}

async function existsFile(path) {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}

function isProcessAlive(pid) {
  try { process.kill(Number(pid), 0); return true; } catch { return false; }
}

async function isPortOpen(port, options = {}) {
  if (options.isPortOpen) return options.isPortOpen(port);
  return new Promise((resolvePromise) => {
    const socket = createConnection({ host: '127.0.0.1', port, timeout: 750 });
    const done = (value) => { socket.destroy(); resolvePromise(value); };
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    const timer = setTimeout(() => { child.kill(); resolvePromise({ code: 124, stderr: 'timeout' }); }, options.timeoutMs ?? 5000);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => { clearTimeout(timer); resolvePromise({ code: 127, stderr: safeMessage(error) }); });
    child.on('close', (code) => { clearTimeout(timer); resolvePromise({ code: code ?? 1, stdout, stderr }); });
  });
}

async function verifyProcessIdentity(record, options = {}) {
  if (!record.nonce || !record.commandFingerprint || !record.startedAt) return { verified: false, reason: 'missing_fingerprint' };
  const actual = options.readProcessIdentity
    ? await options.readProcessIdentity(record.pid)
    : await readProcessIdentity(record.pid);
  if (!actual?.commandLine) return { verified: false, reason: 'identity_unavailable' };
  const commandLine = String(actual.commandLine);
  if (!commandLine.includes(record.nonce) || !commandLine.includes(record.commandFingerprint)) return { verified: false, reason: 'fingerprint_mismatch' };
  return { verified: true };
}

async function readProcessIdentity(pid) {
  if (process.platform !== 'win32') {
    try { return { commandLine: await readFile(`/proc/${Number(pid)}/cmdline`, 'utf8') }; }
    catch { return undefined; }
  }
  const result = await runCommand('wmic.exe', ['process', 'where', `ProcessId=${Number(pid)}`, 'get', 'CommandLine', '/format:list'], { timeoutMs: 3000 });
  return result.code === 0 ? { commandLine: result.stdout || result.stderr || '' } : undefined;
}

function safeMessage(error) {
  return String(error instanceof Error ? error.message : error).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 240);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const status = await inspectEfestoBootstrap();
  process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
  if (status.overall === 'failed') process.exitCode = 1;
}
