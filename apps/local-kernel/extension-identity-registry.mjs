import { chmod, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class ExtensionIdentityRegistry {
  constructor(filePath) {
    this.filePath = filePath;
    this.identities = new Set();
    this.ready = this.load();
    this.writeQueue = Promise.resolve();
  }

  async authorize(origin) {
    await this.ready;
    const id = extensionId(origin);
    if (!id) throw new Error('A valid Chrome extension origin is required');
    if (this.identities.has(id)) return { id, added: false };
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      if (this.identities.has(id)) return;
      const next = [...this.identities, id].sort();
      await this.write(next);
      this.identities = new Set(next);
    });
    await this.writeQueue;
    return { id, added: true };
  }

  async allows(origin) {
    await this.ready;
    const id = extensionId(origin);
    if (!id) return false;
    return this.identities.has(id);
  }

  async clear() {
    await this.ready;
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      await this.write([]);
      this.identities = new Set();
    });
    await this.writeQueue;
  }

  async load() {
    try {
      await assertPrivateFile(this.filePath);
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (parsed.version !== 1 || !Array.isArray(parsed.extensionIds) || !parsed.extensionIds.every((id) => /^[a-p]{32}$/.test(id))) {
        throw new Error('Invalid extension identity registry');
      }
      if (new Set(parsed.extensionIds).size !== parsed.extensionIds.length) {
        throw new Error('Invalid extension identity registry');
      }
      this.identities = new Set(parsed.extensionIds);
      await chmod(this.filePath, 0o600);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  async write(extensionIds) {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ version: 1, extensionIds }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, this.filePath);
    await chmod(this.filePath, 0o600);
  }
}

function extensionId(origin) {
  return typeof origin === 'string' ? origin.match(/^chrome-extension:\/\/([a-p]{32})$/)?.[1] : undefined;
}

async function assertPrivateFile(filePath) {
  if (process.platform === 'win32') return;
  const mode = (await stat(filePath)).mode & 0o777;
  if ((mode & 0o077) !== 0) {
    throw new Error('Extension identity registry must have private file permissions');
  }
}
