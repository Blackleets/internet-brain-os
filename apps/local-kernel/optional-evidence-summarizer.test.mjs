import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { OptionalEvidenceSummarizer } from './optional-evidence-summarizer.mjs';

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'hephaestus-summary-'));
  const store = new LocalKnowledgeStore(join(dir, 'store.json'));
  await store.write({
    cases: [{ id: 'case:test' }],
    evidence: [{
      id: 'evidence:test', caseId: 'case:test', sourceUrl: 'https://example.com/',
      rawText: 'A public source states that the product costs 20 euros.',
      capturedAt: '2026-07-19T11:00:00.000Z', confidence: 0.5,
    }],
  });
  return { store };
}

describe('optional local Evidence summarizer', () => {
  it('skips cleanly when no local model is configured', async () => {
    const { store } = await fixture();
    await expect(new OptionalEvidenceSummarizer(store).summarize('evidence:test')).resolves.toEqual({
      status: 'skipped', reason: 'OLLAMA_MODEL_NOT_CONFIGURED',
    });
  });

  it('persists conservative structured output without replacing raw Evidence', async () => {
    const { store } = await fixture();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        model: 'qwen2.5:3b',
        message: { content: JSON.stringify({
          summary: 'The captured source lists a price of 20 euros.',
          hypotheses: ['The price may change after capture.'],
          limitations: ['Only one public source was captured.'],
        }) },
      }),
    }));
    const result = await new OptionalEvidenceSummarizer(store, {
      model: 'qwen2.5:3b', fetchImpl, now: () => '2026-07-19T12:00:00.000Z',
    }).summarize('evidence:test');
    const stored = await store.read();
    expect(result).toEqual({ status: 'completed', duplicate: false, model: 'qwen2.5:3b' });
    expect(stored.evidence[0].rawText).toContain('costs 20 euros');
    expect(stored.evidence[0].aiSummary).toMatchObject({
      provider: 'ollama', promptVersion: '1.0.0', skillId: 'skill:evidence-summarization',
    });
  });

  it('falls back safely on unavailable or invalid model output', async () => {
    const { store } = await fixture();
    const unavailable = new OptionalEvidenceSummarizer(store, {
      model: 'qwen2.5:3b', fetchImpl: async () => { throw new Error('offline'); },
    });
    const invalid = new OptionalEvidenceSummarizer(store, {
      model: 'qwen2.5:3b', fetchImpl: async () => ({ ok: true, json: async () => ({ model: 'x', message: { content: 'not-json' } }) }),
    });
    await expect(unavailable.summarize('evidence:test')).resolves.toMatchObject({ status: 'unavailable' });
    await expect(invalid.summarize('evidence:test')).resolves.toEqual({ status: 'invalid', reason: 'INVALID_SUMMARY_OUTPUT' });
    expect((await store.read()).evidence[0].aiSummary).toBeUndefined();
  });

  it('rejects non-loopback Ollama endpoints', async () => {
    const { store } = await fixture();
    expect(() => new OptionalEvidenceSummarizer(store, { model: 'x', baseUrl: 'https://remote.example' })).toThrow(/loopback/);
  });
});
