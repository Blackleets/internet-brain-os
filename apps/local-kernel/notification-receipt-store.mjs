import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * File-backed NotificationReceiptStore for production local-kernel serve.
 * Matches NotificationGateway's transaction/write contract (write runs inside transaction).
 */
export class FileNotificationReceiptStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.receipts = null;
    this.chain = Promise.resolve();
  }

  async transaction(callback) {
    let result;
    this.chain = this.chain.catch(() => undefined).then(async () => {
      await this.#ensureLoaded();
      result = await callback(this.receipts);
    });
    await this.chain;
    return result;
  }

  async write(next) {
    await this.#ensureLoaded();
    this.receipts = Array.isArray(next) ? structuredClone(next) : [];
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.tmp`;
    await writeFile(
      temporary,
      `${JSON.stringify({ version: 1, receipts: this.receipts }, null, 2)}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );
    await rename(temporary, this.filePath);
  }

  async #ensureLoaded() {
    if (this.receipts) return;
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
      this.receipts = Array.isArray(parsed?.receipts) ? structuredClone(parsed.receipts) : [];
    } catch (error) {
      if (error?.code === 'ENOENT') {
        this.receipts = [];
        return;
      }
      throw error;
    }
  }
}

export function memoryNotificationReceiptStore(seed = []) {
  let receipts = structuredClone(seed);
  return {
    transaction: async (callback) => callback(receipts),
    write: async (next) => { receipts = structuredClone(next); },
  };
}
