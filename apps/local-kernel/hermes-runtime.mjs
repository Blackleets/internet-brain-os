import { spawn } from 'node:child_process';
import { access, constants, stat } from 'node:fs/promises';
import { delimiter, isAbsolute, join, resolve } from 'node:path';

const DEFAULT_PROBE_TIMEOUT_MS = 5_000;
const MAX_PROBE_OUTPUT_BYTES = 128 * 1024;

export async function detectHermesRuntime(options = {}) {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const explicit = env.HEPHAESTUS_HERMES_EXECUTABLE?.trim();

  if (explicit) {
    const executable = await resolveExecutable(explicit, { env, platform });
    return executable
      ? { available: true, executable, source: 'environment' }
      : { available: false, source: 'environment' };
  }

  if (platform === 'win32' && env.LOCALAPPDATA) {
    const standardInstall = join(env.LOCALAPPDATA, 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes.exe');
    if (await isExecutableFile(standardInstall)) {
      return { available: true, executable: standardInstall, source: 'standard-install' };
    }
  }

  const executable = await resolveExecutable('hermes', { env, platform });
  return executable
    ? { available: true, executable, source: 'path' }
    : { available: false, source: 'not-found' };
}

export async function probeHermesReadOnlyRuntime(runtime, options = {}) {
  if (!runtime?.available || typeof runtime.executable !== 'string' || !runtime.executable) {
    return { ready: false, reason: 'runtime_unavailable' };
  }
  const runCommand = options.runCommand ?? runHermesHelp;
  let result;
  try {
    result = await runCommand(runtime.executable, ['--help'], { timeoutMs: options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS });
  } catch {
    return { ready: false, reason: 'probe_failed' };
  }
  if (!result?.ok) return { ready: false, reason: result?.reason ?? 'probe_failed' };
  const help = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const required = [
    /(?:^|\s)-z(?:,|\s)|--oneshot/m,
    /--toolsets/m,
    /--ignore-user-config/m,
    /--ignore-rules/m,
  ];
  if (!required.every((pattern) => pattern.test(help))) {
    return { ready: false, reason: 'required_flags_missing' };
  }
  return {
    ready: true,
    mode: 'isolated_search_only',
    executable: runtime.executable,
    requiredArgs: ['--ignore-user-config', '--ignore-rules', '--toolsets', 'search', '-z'],
  };
}

export async function resolveExecutable(command, options = {}) {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const hasPath = isAbsolute(command) || command.includes('/') || command.includes('\\');
  const candidates = hasPath
    ? [resolve(command)]
    : (env.PATH ?? '').split(delimiter).filter(Boolean).map((directory) => resolve(directory, command));

  if (platform === 'win32' && !/\.[a-z0-9]+$/i.test(command)) {
    const extensions = (env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean);
    candidates.push(...candidates.flatMap((candidate) => extensions.map((extension) => `${candidate}${extension.toLowerCase()}`)));
  }

  for (const candidate of candidates) {
    if (await isExecutableFile(candidate)) return candidate;
  }
  return undefined;
}

async function runHermesHelp(executable, args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let bytes = 0; let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, reason: 'probe_timeout' });
    }, options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS);
    const collect = (chunk, target) => {
      bytes += chunk.length;
      if (bytes > MAX_PROBE_OUTPUT_BYTES) {
        child.kill();
        finish({ ok: false, reason: 'probe_output_too_large' });
        return;
      }
      if (target === 'stdout') stdout += chunk; else stderr += chunk;
    };
    child.stdout.on('data', (chunk) => collect(chunk, 'stdout'));
    child.stderr.on('data', (chunk) => collect(chunk, 'stderr'));
    child.on('error', () => finish({ ok: false, reason: 'probe_failed' }));
    child.on('close', (code) => finish(code === 0
      ? { ok: true, stdout, stderr }
      : { ok: false, reason: 'probe_nonzero', stdout, stderr }));
  });
}

async function isExecutableFile(candidate) {
  try {
    await access(candidate, constants.X_OK);
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
}
