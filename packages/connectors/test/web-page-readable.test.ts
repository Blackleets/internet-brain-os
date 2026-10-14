import { describe, expect, it, vi } from 'vitest';
import { htmlToText, WebPageFetcher } from '../src/web-page';

const lookupImpl = (async () => [{ address: '93.184.215.14', family: 4 }]) as never;

describe('readable text extraction', () => {
  it('drops nav/footer chrome and prefers <main>', () => {
    const body = 'Real content sentence. '.repeat(12);
    const text = htmlToText(`<nav>Home Pricing Login</nav><main><h1>Title</h1><p>${body}</p></main><footer>Cookies</footer>`);
    expect(text).toContain('Real content sentence.');
    expect(text).not.toMatch(/Pricing|Cookies/);
  });
  it('falls back to the whole page when the region is tiny', () => {
    expect(htmlToText('<main>x</main><div>' + 'Body text here. '.repeat(10) + '</div>')).toContain('Body text here.');
  });
});

describe('WebPageFetcher retries', () => {
  it('retries a transient 503 once, then returns the page', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503, headers: { 'content-type': 'text/plain' } }))
      .mockResolvedValueOnce(new Response('ok page', { status: 200, headers: { 'content-type': 'text/plain' } }));
    const doc = await new WebPageFetcher({ fetchImpl: fetchImpl as never, lookupImpl, retryDelayMs: 1 }).fetch('https://public.example');
    expect(doc.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('never retries a private-network refusal', async () => {
    const fetchImpl = vi.fn();
    const lookupPrivate = (async () => [{ address: '10.0.0.1', family: 4 }]) as never;
    await expect(new WebPageFetcher({ fetchImpl: fetchImpl as never, lookupImpl: lookupPrivate, retryDelayMs: 1 }).fetch('https://evil.example')).rejects.toThrow('Private network');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
