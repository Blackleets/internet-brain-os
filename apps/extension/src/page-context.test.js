import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

async function loadExtractor() {
  const source = await readFile(new URL('./page-context.js', import.meta.url), 'utf8');
  const sandbox = { URL, Date };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox);
  return sandbox.HephaestusPageContext;
}

function makeDocument(overrides = {}) {
  const values = {
    canonical: '/canonical',
    description: 'A useful public page',
    ...overrides,
  };
  return {
    title: values.title ?? 'Example Page',
    documentElement: { lang: values.lang ?? 'en' },
    body: { innerText: values.text ?? 'Visible page text' },
    querySelector(selector) {
      if (selector === 'link[rel="canonical"]' && values.canonical) {
        return { getAttribute: () => values.canonical };
      }
      if (selector === 'meta[name="description"]' && values.description) {
        return { getAttribute: () => values.description };
      }
      return null;
    },
  };
}

describe('Hephaestus page context capture', () => {
  it('returns normalized structured context', async () => {
    const extractor = await loadExtractor();
    const result = extractor.capturePageContext(
      makeDocument(),
      { href: 'https://example.com/product' },
      ' selected   text ',
      () => '2026-07-19T11:00:00.000Z',
    );

    expect(result).toEqual({
      schemaVersion: 'hephaestus.page-context.v1',
      url: 'https://example.com/product',
      title: 'Example Page',
      canonicalUrl: 'https://example.com/canonical',
      description: 'A useful public page',
      language: 'en',
      visibleText: 'Visible page text',
      selection: 'selected text',
      capturedAt: '2026-07-19T11:00:00.000Z',
    });
  });

  it('bounds captured page and selection text', async () => {
    const extractor = await loadExtractor();
    const result = extractor.capturePageContext(
      makeDocument({ text: 'x'.repeat(13000), canonical: '', description: '' }),
      { href: 'https://example.com/' },
      'y'.repeat(3000),
    );

    expect(result.visibleText.length).toBe(extractor.MAX_TEXT);
    expect(result.selection.length).toBe(extractor.MAX_SELECTION);
    expect(result.canonicalUrl).toBeUndefined();
    expect(result.description).toBeUndefined();
  });
});
