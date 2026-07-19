import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CaptureCaseEvidenceProjector, LocalKnowledgeStore } from './capture-projector.mjs';

const context = {
  schemaVersion: 'hephaestus.page-context.v1',
  url: 'https://example.com/original',
  canonicalUrl: 'https://example.com/product',
  title: 'Example product',
  description: 'Primary product description',
  visibleText: 'Evidence captured from a public product page.',
  selection: 'Selected evidence',
  capturedAt: '2026-07-19T11:00:00.000Z',
};
const receiptId = `receipt:${'a'.repeat(64)}`;

describe('capture Case/Evidence projector', () => {
  it('atomically creates deterministic Case and Evidence records', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-projector-'));
    const file = join(dir, 'store.json');
    const projector = new CaptureCaseEvidenceProjector(new LocalKnowledgeStore(file));
    const result = await projector.project(receiptId, context);
    const stored = JSON.parse(await readFile(file, 'utf8'));

    expect(result).toEqual({
      caseId: `case:${'a'.repeat(64)}`,
      evidenceId: `evidence:${'a'.repeat(64)}`,
      duplicate: false,
    });
    expect(stored.cases).toHaveLength(1);
    expect(stored.evidence).toHaveLength(1);
    expect(stored.evidence[0]).toMatchObject({
      caseId: result.caseId,
      sourceReceiptId: receiptId,
      sourceUrl: context.canonicalUrl,
      summary: context.selection,
      extractionMethod: 'browser-visible-text-v1',
    });
    expect(stored.evidence[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns the original projection without duplicate writes after restart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-projector-'));
    const file = join(dir, 'store.json');
    const first = await new CaptureCaseEvidenceProjector(new LocalKnowledgeStore(file)).project(receiptId, context);
    const retry = await new CaptureCaseEvidenceProjector(new LocalKnowledgeStore(file)).project(receiptId, context);
    const stored = JSON.parse(await readFile(file, 'utf8'));
    expect(retry).toEqual({ caseId: first.caseId, evidenceId: first.evidenceId, duplicate: true });
    expect(stored.cases).toHaveLength(1);
    expect(stored.evidence).toHaveLength(1);
  });

  it('preserves existing CLI knowledge while adding the projection', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-projector-'));
    const file = join(dir, 'store.json');
    const store = new LocalKnowledgeStore(file);
    await store.write({ cases: [{ id: 'case:existing' }], evidence: [{ id: 'evidence:existing' }] });
    await new CaptureCaseEvidenceProjector(store).project(receiptId, context);
    const stored = JSON.parse(await readFile(file, 'utf8'));
    expect(stored.cases.map((item) => item.id)).toContain('case:existing');
    expect(stored.evidence.map((item) => item.id)).toContain('evidence:existing');
  });
});
