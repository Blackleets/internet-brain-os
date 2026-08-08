import { describe, expect, it } from 'vitest';
import { PublicWebSearchClient, parseDuckDuckGoHtml } from '../src';

const fixture = `
<html><body>
<div class="result">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdrill">Quality drill deal</a>
  <a class="result__snippet">Cordless drill for 24.99 EUR with warranty.</a>
</div>
<div class="result">
  <a class="result__a" href="https://shop.example.org/item">Second drill</a>
  <div class="result__snippet">Alternative product listing.</div>
</div>
</body></html>`;

describe('PublicWebSearchClient', () => {
  it('queries the fixed public provider and returns bounded normalized results', async () => {
    let requested = '';
    const client = new PublicWebSearchClient({
      now: () => new Date('2026-08-08T15:00:00.000Z'),
      fetchImpl: (async (input: URL | RequestInfo) => {
        requested = String(input);
        return new Response(fixture, { status: 200, headers: { 'content-type': 'text/html' } });
      }) as typeof fetch,
    });

    const result = await client.search('  quality   drill 18 25 euro ', 1);

    expect(result).toMatchObject({ query: 'quality drill 18 25 euro', provider: 'duckduckgo-html', searchedAt: '2026-08-08T15:00:00.000Z' });
    expect(requested).toContain('html.duckduckgo.com/html/');
    expect(decodeURIComponent(requested)).toContain('q=quality+drill+18+25+euro');
    expect(result.results).toEqual([expect.objectContaining({ rank: 1, title: 'Quality drill deal', url: 'https://example.com/drill', sourceHost: 'example.com' })]);
  });

  it('rejects invalid queries before performing a network call', async () => {
    let calls = 0;
    const client = new PublicWebSearchClient({ fetchImpl: (async () => { calls += 1; return new Response(fixture); }) as typeof fetch });
    await expect(client.search(' ')).rejects.toThrow('Search query is invalid');
    await expect(client.search('x'.repeat(301))).rejects.toThrow('Search query is invalid');
    expect(calls).toBe(0);
  });

  it('fails closed for provider errors and non-html responses', async () => {
    const failed = new PublicWebSearchClient({ fetchImpl: (async () => new Response('no', { status: 503 })) as typeof fetch });
    await expect(failed.search('drill deals')).rejects.toThrow('HTTP 503');
    const json = new PublicWebSearchClient({ fetchImpl: (async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch });
    await expect(json.search('drill deals')).rejects.toThrow('non-HTML');
  });
});

describe('parseDuckDuckGoHtml', () => {
  it('unwraps provider redirect links, deduplicates URLs and skips unsafe schemes', () => {
    const html = fixture + `
      <a class="result__a" href="https://example.com/drill">Duplicate</a><div class="result__snippet">dup</div>
      <a class="result__a" href="javascript:alert(1)">Unsafe</a><div class="result__snippet">unsafe</div>`;
    const results = parseDuckDuckGoHtml(html, 10);
    expect(results.map((item) => item.url)).toEqual(['https://example.com/drill', 'https://shop.example.org/item']);
  });
});
