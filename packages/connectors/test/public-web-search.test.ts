import { describe, expect, it } from 'vitest';
import { PublicWebSearchClient, parseBingHtml, parseBraveHtml, parseDuckDuckGoHtml, parseDuckDuckGoLiteHtml, parseJinaSearchMarkdown } from '../src';

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
    await expect(json.search('drill deals')).rejects.toThrow('unsupported response');
  });

  it('tries the fast Brave fallback before the slower public reader', async () => {
    const requests: string[] = [];
    const client = new PublicWebSearchClient({
      fetchImpl: (async (input: URL | RequestInfo) => {
        const url = String(input);
        requests.push(url);
        if (url.includes('duckduckgo.com')) return new Response('<html><body>challenge</body></html>', { status: 202, headers: { 'content-type': 'text/html' } });
        if (url.includes('brave.com')) return new Response('<a href="https://example.com/iphone"><div class="title search-snippet-title">Used iPhone</div></a><div class="generic-snippet"><div class="content">Good used iPhone listing.</div></div>', { status: 200, headers: { 'content-type': 'text/html' } });
        throw new Error('a slower fallback should not be called');
      }) as typeof fetch,
    });

    const result = await client.search('used iphone', 3);

    expect(result).toMatchObject({ provider: 'brave-html', results: [expect.objectContaining({ url: 'https://example.com/iphone' })] });
    expect(requests).toEqual([
      expect.stringContaining('html.duckduckgo.com/html/'),
      expect.stringContaining('lite.duckduckgo.com/lite/'),
      expect.stringContaining('search.brave.com/search'),
    ]);
  });

  it('falls back to Bing when DuckDuckGo returns no parseable results', async () => {
    const requests: string[] = [];
    const client = new PublicWebSearchClient({
      fetchImpl: (async (input: URL | RequestInfo) => {
        const url = String(input);
        requests.push(url);
        if (url.includes('duckduckgo.com') || url.includes('brave.com')) return new Response('<html><body>challenge</body></html>', { status: 202, headers: { 'content-type': 'text/html' } });
        return new Response(`<li class="b_algo"><h2><a href="https://www.bing.com/ck/a/?u=a1aHR0cHM6Ly9leGFtcGxlLmNvbS9pcGhvbmU">Used iPhone</a></h2><div class="b_caption"><p>Public listing.</p></div></li>`, { status: 200, headers: { 'content-type': 'text/html' } });
      }) as typeof fetch,
    });

    const result = await client.search('used iphone', 3);

    expect(result.provider).toBe('bing-html');
    expect(result.results).toEqual([expect.objectContaining({ url: 'https://example.com/iphone', sourceHost: 'example.com' })]);
    expect(requests).toHaveLength(5);
  });

  it('rejects unrelated provider pages instead of presenting them as matches', async () => {
    const client = new PublicWebSearchClient({
      fetchImpl: (async (input: URL | RequestInfo) => {
        const url = String(input);
        if (url.includes('duckduckgo.com') || url.includes('brave.com')) return new Response('<html><body>challenge</body></html>', { status: 202, headers: { 'content-type': 'text/html' } });
        return new Response('<li class="b_algo"><h2><a href="https://support.example.com/hotmail">Hotmail help</a></h2><div class="b_caption"><p>Unrelated page.</p></div></li>', { status: 200, headers: { 'content-type': 'text/html' } });
      }) as typeof fetch,
    });

    const result = await client.search('used iphone', 3);

    expect(result.provider).toBe('bing-html');
    expect(result.results).toEqual([]);
  });

  it('requires two topic matches for multi-word queries', async () => {
    const client = new PublicWebSearchClient({
      fetchImpl: (async (input: URL | RequestInfo) => {
        const url = String(input);
        if (url.includes('duckduckgo.com') || url.includes('brave.com')) return new Response('<html><body>challenge</body></html>', { status: 202, headers: { 'content-type': 'text/html' } });
        return new Response('<li class="b_algo"><h2><a href="https://example.com/opportunities">Opportunities</a></h2><div class="b_caption"><p>Generic opportunity directory.</p></div></li>', { status: 200, headers: { 'content-type': 'text/html' } });
      }) as typeof fetch,
    });

    const result = await client.search('remote jobs madrid', 3);

    expect(result.results).toEqual([]);
  });

  it('uses the public reader fallback when direct search pages are challenged', async () => {
    const client = new PublicWebSearchClient({
      fetchImpl: (async (input: URL | RequestInfo) => {
        const url = String(input);
        if (url.includes('duckduckgo.com') || url.includes('brave.com')) return new Response('<html><body>challenge</body></html>', { status: 202, headers: { 'content-type': 'text/html' } });
        if (url.includes('r.jina.ai')) return new Response('## [Used iPhone](https://example.com/iphone)\n\nGood used iPhone listing.', { status: 200, headers: { 'content-type': 'text/plain' } });
        throw new Error('direct Bing should not be called');
      }) as typeof fetch,
    });

    const result = await client.search('used iphone', 3);

    expect(result).toMatchObject({ provider: 'jina-bing', results: [expect.objectContaining({ url: 'https://example.com/iphone' })] });
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

describe('parseBingHtml', () => {
  it('extracts bounded result cards and rejects provider tracking URLs', () => {
    const results = parseBingHtml(`<li class="b_algo"><h2><a href="https://example.com/one">One</a></h2><div class="b_caption"><p>First result.</p></div></li><li class="b_algo"><h2><a href="https://www.bing.com/ck/a?u=a1aHR0cHM6Ly9leGFtcGxlLmNvbS90d28">Two</a></h2><div class="b_caption"><p>Second result.</p></div></li>`, 2);

    expect(results.map((result) => result.url)).toEqual(['https://example.com/one', 'https://example.com/two']);
  });
});

describe('parseDuckDuckGoLiteHtml', () => {
  it('extracts external result links and their adjacent snippets', () => {
    const results = parseDuckDuckGoLiteHtml(`<tr><td><a class="result-link" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fiphone">Used iPhone</a></td></tr><tr><td class="result-snippet">Good <b>used</b> iPhone listing.</td></tr><tr class="result-sponsored"><td><a class="result-link" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fduckduckgo.com%2Fy.js%3Fad%3D1">Ad</a></td></tr>`, 5);

    expect(results).toEqual([expect.objectContaining({ title: 'Used iPhone', url: 'https://example.com/iphone', snippet: 'Good used iPhone listing.' })]);
  });
});

describe('parseBraveHtml', () => {
  it('extracts external result cards and adjacent snippets', () => {
    const results = parseBraveHtml(`<a href="https://example.com/iphone"><div class="title search-snippet-title">Used iPhone</div></a><div class="generic-snippet"><div class="content">Good <strong>used</strong> iPhone listing.</div></div>`, 5);

    expect(results).toEqual([expect.objectContaining({ title: 'Used iPhone', url: 'https://example.com/iphone', snippet: 'Good used iPhone listing.' })]);
  });
});

describe('parseJinaSearchMarkdown', () => {
  it('unwraps Bing links from the public reader response', () => {
    const results = parseJinaSearchMarkdown(`Title: query - Bing\n\n## [Used iPhone](https://example.com/iphone)\n\nGood **used** iPhone listing.`, 5);

    expect(results).toEqual([expect.objectContaining({ title: 'Used iPhone', url: 'https://example.com/iphone', snippet: 'Good used iPhone listing.' })]);
  });
});
