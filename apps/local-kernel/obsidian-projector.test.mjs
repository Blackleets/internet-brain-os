import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { ObsidianKnowledgeProjector } from './obsidian-projector.mjs';

describe('Obsidian knowledge projector', () => {
  it('writes linked Case, Evidence, and evidence-report notes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-obsidian-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    await store.write({
      cases: [{
        id: 'case:test', title: 'Supplier investigation', objective: 'Compare public suppliers',
        status: 'active', createdAt: '2026-07-19T11:00:00.000Z', updatedAt: '2026-07-19T11:00:00.000Z',
      }],
      evidence: [{
        id: 'evidence:test', caseId: 'case:test', sourceReceiptId: 'receipt:test',
        sourceUrl: 'https://example.com/', contentHash: 'a'.repeat(64), rawText: 'Public source text',
        summary: 'Supplier page', capturedAt: '2026-07-19T11:00:00.000Z',
        extractionMethod: 'browser-visible-text-v1', confidence: 0.5,
      }],
    });
    const vault = join(dir, 'vault');
    const result = await new ObsidianKnowledgeProjector(store, vault).syncCase('case:test');
    const caseNote = await readFile(join(vault, result.caseNote), 'utf8');
    const evidenceNote = await readFile(join(vault, result.evidenceNotes[0]), 'utf8');
    const reportNote = await readFile(join(vault, result.reportNote), 'utf8');

    expect(caseNote).toContain('[[Evidence/evidence-test|Supplier page]]');
    expect(evidenceNote).toContain('source_receipt_id: "receipt:test"');
    expect(evidenceNote).toContain('[[Cases/case-test|Supplier investigation]]');
    expect(reportNote).toContain('## Limitations');
    expect(reportNote).toContain('Absence of Evidence is not Evidence of absence.');
  });

  it('refreshes a Case note when more Evidence is attached', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-obsidian-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    const caseRecord = { id: 'case:test', title: 'Test', objective: 'Test', status: 'draft' };
    await store.write({ cases: [caseRecord], evidence: [] });
    const vault = join(dir, 'vault');
    const projector = new ObsidianKnowledgeProjector(store, vault);
    await projector.syncCase('case:test');
    await store.write({ cases: [caseRecord], evidence: [{ id: 'evidence:new', caseId: 'case:test', confidence: 0.5 }] });
    await projector.syncCase('case:test');
    expect(await readFile(join(vault, 'Cases', 'case-test.md'), 'utf8')).toContain('Evidence/evidence-new');
  });
});
