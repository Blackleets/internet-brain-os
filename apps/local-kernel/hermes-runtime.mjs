import { access, constants, stat } from 'node:fs/promises';
import { delimiter, isAbsolute, join, resolve } from 'node:path';

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
    const standardInstall = join(
      env.LOCALAPPDATA,
      'hermes',
      'hermes-agent',
      'venv',
      'Scripts',
      'hermes.exe',
    );
    if (await isExecutableFile(standardInstall)) {
      return { available: true, executable: standardInstall, source: 'standard-install' };
    }
  }

  const executable = await resolveExecutable('hermes', { env, platform });
  return executable
    ? { available: true, executable, source: 'path' }
    : { available: false, source: 'not-found' };
}

export async function resolveExecutable(command, options = {}) {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const hasPath = isAbsolute(command) || command.includes('/') || command.includes('\\');
  const candidates = hasPath
    ? [resolve(command)]
    : (env.PATH ?? '').split(delimiter).filter(Boolean).map((directory) => resolve(directory, command));

  if (platform === 'win32' && !/\.[a-z0-9]+$/i.test(command)) {
    const extensions = (env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM')
      .split(';')
      .filter(Boolean);
    candidates.push(...candidates.flatMap((candidate) => extensions.map((extension) => `${candidate}${extension.toLowerCase()}`)));
  }

  for (const candidate of candidates) {
    if (await isExecutableFile(candidate)) return candidate;
  }
  return undefined;
}

async function isExecutableFile(candidate) {
  try {
    await access(candidate, constants.X_OK);
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
}
