import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { InboxError, PageContextInbox, validatePageContext } from './page-context-inbox.mjs';

const context = {
  schemaVersion: 'hephaestus.page-context.v1',
  url: 'https://example.com/product',
  title: 'Example product',
  visibleText: 'Evidence captured from a public page.',
  capturedAt: '2026-07-19T11:00:00.000Z',
};

describe('local page context inbox', () => {
  it('persists a validated capture and deduplicates retries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-inbox-'));
    const file = join(dir, 'inbox.jsonl');
    const inbox = new PageContextInbox(file);
    const first = await inbox.accept(context);
    const retry = await inbox.accept(context);

    expect(first.receiptId).toMatch(/^receipt:[a-f0-9]{64}$/);
    expect(first.duplicate).toBe(false);
    expect(retry).toEqual({ receiptId: first.receiptId, duplicate: true });
    expect((await readFile(file, 'utf8')).trim().split('\n')).toHaveLength(1);
  });

  it('rejects oversized and credential-bearing input', () => {
    expect(() => validatePageContext({ ...context, visibleText: 'x'.repeat(12_001) })).toThrow(InboxError);
    expect(() => validatePageContext({ ...context, url: 'https://user:secret@example.com' })).toThrow(/without credentials/);
  });

  it('restores receipt deduplication after restart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-restart-'));
    const file = join(dir, 'inbox.jsonl');
    const first = await new PageContextInbox(file).accept(context);
    const retry = await new PageContextInbox(file).accept(context);
    expect(retry).toEqual({ receiptId: first.receiptId, duplicate: true });
  });
});
