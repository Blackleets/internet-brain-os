import { describe, expect, test, vi } from 'vitest';
import { WebPageFetcher } from '../src/web-page';

describe('WebPageFetcher public-network boundary', () => {
  test.each(['http://127.0.0.1/admin', 'http://169.254.169.254/latest', 'http://[::1]/'])('blocks private target %s', async (url) => {
    const fetchImpl = vi.fn();
    await expect(new WebPageFetcher({ fetchImpl }).fetch(url)).rejects.toThrow('Private network URLs');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('blocks DNS resolutions and redirects into private networks', async () => {
    const lookupImpl = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } }));
    await expect(new WebPageFetcher({ fetchImpl: fetchImpl as typeof fetch, lookupImpl: lookupImpl as never }).fetch('https://example.com'))
      .rejects.toThrow('Private network URLs');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('bounds response bodies to prevent memory exhaustion', async () => {
    const lookupImpl = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);
    const fetchImpl = vi.fn(async () => new Response('x', { headers: { 'content-length': String(3 * 1024 * 1024) } }));
    await expect(new WebPageFetcher({ fetchImpl: fetchImpl as typeof fetch, lookupImpl: lookupImpl as never }).fetch('https://example.com'))
      .rejects.toThrow('exceeds 2 MiB');
  });
});
