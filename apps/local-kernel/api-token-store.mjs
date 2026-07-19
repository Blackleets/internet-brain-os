import { randomBytes } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function loadOrCreateApiToken(filePath, options = {}) {
  if (options.envToken !== undefined) return { token: validateApiToken(options.envToken), source: 'environment' };
  const rotated = options.rotate === true;
  if (rotated) await rotateToken(filePath);
  try {
    const token = validateApiToken((await readFile(filePath, 'utf8')).trim());
    await chmod(filePath, 0o600);
    return { token, source: rotated ? 'rotated' : 'file', filePath };
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
  const token = randomBytes(32).toString('hex');
  try {
    const handle = await open(filePath, 'wx', 0o600);
    try { await handle.writeFile(`${token}\n`, 'utf8'); } finally { await handle.close(); }
    return { token, source: 'created', filePath };
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    return loadOrCreateApiToken(filePath);
  }
}

export function validateApiToken(value) {
  if (typeof value !== 'string' || value.length < 32 || value.length > 512) {
    throw new Error('HEPHAESTUS_API_TOKEN must contain 32-512 characters');
  }
  return value;
}

async function rotateToken(filePath) {
  await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${randomBytes(32).toString('hex')}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, filePath);
  await chmod(filePath, 0o600);
}
