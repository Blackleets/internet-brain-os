import { cp, mkdir, stat } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { InvalidPathError } from './storage-errors';

export async function backupDataDirectory(dataRoot: string, destinationRoot: string): Promise<string> {
  const source = resolveValidatedPath(dataRoot);
  const destinationBase = resolveValidatedPath(destinationRoot);
  const sourceStats = await stat(source);
  if (!sourceStats.isDirectory()) throw new InvalidPathError(dataRoot);

  const destination = resolve(destinationBase, `${basename(source)}-backup-${backupTimestamp()}`);
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  await cp(source, destination, {
    recursive: true,
    errorOnExist: true,
    force: false,
    preserveTimestamps: true,
  });
  return destination;
}

function resolveValidatedPath(value: string): string {
  if (!value || value.includes('\0')) throw new InvalidPathError(value);
  return resolve(value);
}

function backupTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
