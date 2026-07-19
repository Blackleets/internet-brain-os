import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const MAX_BODY_BYTES = 32 * 1024;
const MAX_TEXT = 12_000;
const MAX_SELECTION = 2_000;

export class InboxError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'InboxError';
    this.code = code;
    this.status = status;
  }
}

export function validatePageContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InboxError('INVALID_CONTEXT', 'Page context must be an object');
  }
  if (value.schemaVersion !== 'hephaestus.page-context.v1') {
    throw new InboxError('INVALID_CONTEXT', 'Unsupported page context schema');
  }

  const url = publicHttpUrl(value.url, 'url');
  const canonicalUrl = value.canonicalUrl === undefined
    ? undefined
    : publicHttpUrl(value.canonicalUrl, 'canonicalUrl');
  const capturedAt = requiredText(value.capturedAt, 'capturedAt', 64);
  const capturedDate = new Date(capturedAt);
  if (Number.isNaN(capturedDate.getTime()) || capturedDate.toISOString() !== capturedAt) {
    throw new InboxError('INVALID_CONTEXT', 'capturedAt must be canonical UTC ISO-8601');
  }

  return {
    schemaVersion: value.schemaVersion,
    url,
    title: requiredText(value.title, 'title', 300),
    canonicalUrl,
    description: optionalText(value.description, 'description', 1_000),
    language: optionalText(value.language, 'language', 64),
    visibleText: requiredText(value.visibleText, 'visibleText', MAX_TEXT),
    selection: optionalText(value.selection, 'selection', MAX_SELECTION),
    capturedAt,
  };
}

export class PageContextInbox {
  constructor(filePath) {
    this.filePath = filePath;
    this.receipts = new Set();
    this.ready = this.load();
    this.writeQueue = Promise.resolve();
  }

  async accept(input) {
    await this.ready;
    const context = validatePageContext(input);
    const receiptId = `receipt:${createHash('sha256').update(stableJson(context)).digest('hex')}`;
    if (this.receipts.has(receiptId)) return { receiptId, duplicate: true };

    const record = { receiptId, acceptedAt: new Date().toISOString(), context };
    this.writeQueue = this.writeQueue.then(async () => {
      if (this.receipts.has(receiptId)) return;
      await mkdir(dirname(this.filePath), { recursive: true });
      await appendFile(this.filePath, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
      this.receipts.add(receiptId);
    });
    await this.writeQueue;
    return { receiptId, duplicate: false };
  }

  async load() {
    let content;
    try {
      content = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        if (typeof record.receiptId === 'string') this.receipts.add(record.receiptId);
      } catch {
        throw new InboxError('CORRUPT_INBOX', 'Local capture inbox contains invalid JSON', 500);
      }
    }
  }
}

function stableJson(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function publicHttpUrl(value, field) {
  const text = requiredText(value, field, 2_048);
  let url;
  try { url = new URL(text); } catch { throw new InboxError('INVALID_CONTEXT', `${field} must be a valid URL`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new InboxError('INVALID_CONTEXT', `${field} must be a public HTTP(S) URL without credentials`);
  }
  return url.href;
}

function requiredText(value, field, max) {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new InboxError('INVALID_CONTEXT', `${field} must contain 1-${max} characters`);
  }
  return value;
}

function optionalText(value, field, max) {
  if (value === undefined) return undefined;
  return requiredText(value, field, max);
}
