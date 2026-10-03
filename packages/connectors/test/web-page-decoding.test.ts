import { brotliCompressSync, deflateRawSync, deflateSync, gzipSync } from 'node:zlib';
import { describe, expect, test, vi } from 'vitest';
import { WebPageFetcher } from '../src/web-page';

const lookupImpl = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);
const html = '<!doctype html><html><head><title>Welcome to Python.org &#8212; News &amp; Docs</title></head>'
  + '<body><h1>Python&nbsp;is a programming language</h1><p>Caf&eacute; &#x2014; &ldquo;quotes&rdquo; &amp;lt;kept&amp;gt;</p></body></html>';

function fetcherReturning(body: Uint8Array | string, headers: Record<string, string>) {
  const seen: Record<string, string>[] = [];
  const requestImpl = vi.fn(async (_url: URL, _address: string, _signal: AbortSignal, requestHeaders: Record<string, string>) => {
    seen.push(requestHeaders);
    return new Response(body, { status: 200, headers });
  });
  return { fetcher: new WebPageFetcher({ lookupImpl: lookupImpl as never, requestImpl }), seen };
}

describe('WebPageFetcher Content-Encoding (raw pinned transport)', () => {
  test.each([
    ['gzip', gzipSync(html)],
    ['x-gzip', gzipSync(html)],
    ['br', brotliCompressSync(html)],
    ['deflate', deflateSync(html)],
    ['deflate', deflateRawSync(html)],
  ])('decodes %s before storing text', async (encoding, compressed) => {
    const { fetcher, seen } = fetcherReturning(compressed, { 'content-type': 'text/html; charset=utf-8', 'content-encoding': encoding });
    const document = await fetcher.fetch('https://www.python.org/');
    expect(document.title).toBe('Welcome to Python.org — News & Docs');
    expect(document.text).toContain('Python is a programming language'); // &nbsp; decoded, then whitespace-normalised
    expect(seen[0]['accept-encoding']).toBe('gzip, deflate, br');
  });

  test('undoes stacked codings in reverse order', async () => {
    const { fetcher } = fetcherReturning(brotliCompressSync(gzipSync(html)), { 'content-type': 'text/html', 'content-encoding': 'gzip, br' });
    expect((await fetcher.fetch('https://www.python.org/')).title).toBe('Welcome to Python.org — News & Docs');
  });

  test('regression: gzip bytes served without a Content-Encoding header are refused, not stored', async () => {
    const { fetcher } = fetcherReturning(gzipSync(html.repeat(20)), { 'content-type': 'text/html; charset=utf-8' });
    await expect(fetcher.fetch('https://www.python.org/')).rejects.toThrow('binary or undecodable');
  });

  test.each([
    ['PNG image', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]), 'image/png'],
    ['undeclared binary', Uint8Array.from({ length: 4096 }, (_, index) => (index * 151 + 7) % 256 || 1), 'application/octet-stream'],
  ])('refuses %s bodies', async (_label, body, contentType) => {
    const { fetcher } = fetcherReturning(body, { 'content-type': contentType });
    await expect(fetcher.fetch('https://example.com/file')).rejects.toThrow('binary or undecodable');
  });

  test('refuses corrupt and unsupported codings', async () => {
    await expect(fetcherReturning('not gzip at all', { 'content-encoding': 'gzip' }).fetcher.fetch('https://example.com/'))
      .rejects.toThrow('Undecodable gzip content');
    await expect(fetcherReturning('x', { 'content-encoding': 'zstd' }).fetcher.fetch('https://example.com/'))
      .rejects.toThrow('Unsupported content-encoding: zstd');
  });

  test('bounds decompressed size (decompression bomb)', async () => {
    const bomb = gzipSync(Buffer.alloc(3 * 1024 * 1024, 0x61));
    expect(bomb.byteLength).toBeLessThan(64 * 1024);
    await expect(fetcherReturning(bomb, { 'content-type': 'text/plain', 'content-encoding': 'gzip' }).fetcher.fetch('https://example.com/'))
      .rejects.toThrow('2 MiB limit');
  });

  test('honours a declared legacy charset', async () => {
    const latin1 = Buffer.from('<title>Caf\u00e9 cr\u00e8me</title><p>Men\u00fa</p>', 'latin1');
    const document = await fetcherReturning(latin1, { 'content-type': 'text/html; charset=ISO-8859-1' }).fetcher.fetch('https://example.com/');
    expect(document.title).toBe('Café crème');
    expect(document.text).toContain('Menú');
  });

  test('fetchImpl bodies are already decoded and are not decoded twice', async () => {
    const fetchImpl = vi.fn(async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' } }));
    const document = await new WebPageFetcher({ fetchImpl: fetchImpl as never, lookupImpl: lookupImpl as never }).fetch('https://www.python.org/');
    expect(document.title).toBe('Welcome to Python.org — News & Docs');
  });
});

describe('WebPageFetcher HTML entity decoding at ingest', () => {
  test('decodes numeric, hex and named entities once in title and text', async () => {
    const document = await fetcherReturning(html, { 'content-type': 'text/html; charset=utf-8' }).fetcher.fetch('https://www.python.org/');
    expect(document.title).toBe('Welcome to Python.org — News & Docs');
    expect(document.title).not.toMatch(/&#?\w+;/);
    // Single pass: an escaped entity stays a literal entity, never double-decoded into markup.
    expect(document.text).toContain('Café — “quotes” &lt;kept&gt;');
  });

  test('leaves unknown names untouched and replaces invalid code points', async () => {
    const page = '<title>A &notanentity; B &#0; C &#xD800; D &#1114112;</title>';
    const document = await fetcherReturning(page, { 'content-type': 'text/html' }).fetcher.fetch('https://example.com/');
    expect(document.title).toBe('A &notanentity; B \uFFFD C \uFFFD D \uFFFD');
  });
});
