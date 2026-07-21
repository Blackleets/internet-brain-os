import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CorruptDataError, InvalidPathError } from './storage-errors';

interface VersionedEnvelope<T> {
  readonly version: 1;
  readonly records: readonly T[];
}

export interface AtomicJsonCollectionOptions<T> {
  readonly dataRoot: string;
  readonly fileName: string;
  readonly clone: (record: T) => T;
}

const writeQueues = new Map<string, Promise<void>>();

export class AtomicJsonCollection<T> {
  readonly filePath: string;
  private readonly clone: (record: T) => T;

  constructor(options: AtomicJsonCollectionOptions<T>) {
    const root = validateDataRoot(options.dataRoot);
    if (!options.fileName || options.fileName.includes('/') || options.fileName.includes('\\')) {
      throw new InvalidPathError(options.fileName);
    }

    const filePath = resolve(root, options.fileName);
    if (!filePath.startsWith(`${root}${sep}`)) {
      throw new InvalidPathError(filePath);
    }

    this.filePath = filePath;
    this.clone = options.clone;
  }

  async read(): Promise<readonly T[]> {
    await currentWriteQueue(this.filePath);
    return (await this.readUnsafe()).map(this.clone);
  }

  async mutate(mutator: (records: T[]) => void): Promise<void> {
    const previous = currentWriteQueue(this.filePath);
    const operation = previous.then(async () => {
      const records = await this.readUnsafe();
      mutator(records);
      await this.writeUnsafe(records);
    });
    const settled = operation.catch(() => undefined);
    writeQueues.set(this.filePath, settled);

    try {
      await operation;
    } finally {
      if (writeQueues.get(this.filePath) === settled) {
        writeQueues.delete(this.filePath);
      }
    }
  }

  private async readUnsafe(): Promise<T[]> {
    let source: string;
    try {
      source = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return [];
      throw error;
    }

    try {
      const parsed = JSON.parse(source) as Partial<VersionedEnvelope<T>>;
      if (parsed.version !== 1 || !Array.isArray(parsed.records)) {
        throw new Error('Unsupported storage envelope');
      }
      return parsed.records.map(this.clone);
    } catch (error) {
      throw new CorruptDataError(this.filePath, error);
    }
  }

  private async writeUnsafe(records: readonly T[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    const payload = `${JSON.stringify({ version: 1, records }, null, 2)}\n`;

    try {
      const handle = await open(temporaryPath, 'wx', 0o600);
      try {
        await handle.writeFile(payload, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}

function currentWriteQueue(filePath: string): Promise<void> {
  return writeQueues.get(filePath) ?? Promise.resolve();
}

function validateDataRoot(value: string): string {
  if (!value || value.includes('\0')) throw new InvalidPathError(value);
  return resolve(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
