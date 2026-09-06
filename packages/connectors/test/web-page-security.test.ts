import { describe, expect, test, vi } from 'vitest';
import { WebPageFetcher } from '../src/web-page';

describe('WebPageFetcher public-network boundary', () => {
  test.each([
    'http://127.0.0.1/admin',
    'http://169.254.169.254/latest',
    'http://[::1]/',
    // WHATWG serializes dotted IPv4-mapped to hex (::ffff:7f00:1). Must not bypass private gate.
    'http://[::ffff:127.0.0.1]/mapped-loopback',
    'http://[::ffff:7f00:1]/hex-mapped-loopback',
    'http://[::ffff:169.254.169.254]/mapped-metadata',
    'http://[::ffff:a9fe:a9fe]/hex-mapped-metadata',
    'http://[::ffff:10.0.0.1]/mapped-rfc1918',
    'http://[::ffff:a00:1]/hex-mapped-rfc1918',
    // IPv4-translated / SIIT (::ffff:0:x:y) must not bypass the private gate either.
    'http://[::ffff:0:127.0.0.1]/translated-loopback',
    'http://[::ffff:0:7f00:1]/hex-translated-loopback',
    'http://[::ffff:0:169.254.169.254]/translated-metadata',
    'http://[::ffff:0:a9fe:a9fe]/hex-translated-metadata',
    'http://[::ffff:0:10.0.0.1]/translated-rfc1918',
    'http://[::ffff:0:a00:1]/hex-translated-rfc1918',
    // NAT64 well-known prefix 64:ff9b::/96 (RFC 6052) must not bypass the private gate.
    'http://[64:ff9b::127.0.0.1]/nat64-loopback',
    'http://[64:ff9b::7f00:1]/hex-nat64-loopback',
    'http://[64:ff9b::169.254.169.254]/nat64-metadata',
    'http://[64:ff9b::a9fe:a9fe]/hex-nat64-metadata',
    'http://[64:ff9b::10.0.0.1]/nat64-rfc1918',
    'http://[64:ff9b::a00:1]/hex-nat64-rfc1918',
  ])('blocks private target %s', async (url) => {
    const fetchImpl = vi.fn();
    await expect(new WebPageFetcher({ fetchImpl }).fetch(url)).rejects.toThrow('Private network URLs');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test.each([
    'http://user:pass@example.com/',
    'https://token@example.com/path',
  ])('blocks embedded credentials %s', async (url) => {
    const fetchImpl = vi.fn();
    await expect(new WebPageFetcher({ fetchImpl }).fetch(url)).rejects.toThrow('without credentials');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('blocks DNS resolutions and redirects into private networks', async () => {
    const lookupImpl = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } }));
    await expect(new WebPageFetcher({ fetchImpl: fetchImpl as typeof fetch, lookupImpl: lookupImpl as never }).fetch('https://example.com'))
      .rejects.toThrow('Private network URLs');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('blocks DNS answers that resolve to hex-form IPv4-mapped loopback', async () => {
    const lookupImpl = vi.fn(async () => [{ address: '::ffff:7f00:1', family: 6 }]);
    const fetchImpl = vi.fn();
    await expect(new WebPageFetcher({ fetchImpl, lookupImpl: lookupImpl as never }).fetch('https://evil.example'))
      .rejects.toThrow('Private network URLs');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('blocks DNS answers that resolve to hex-form IPv4-translated loopback', async () => {
    const lookupImpl = vi.fn(async () => [{ address: '::ffff:0:7f00:1', family: 6 }]);
    const fetchImpl = vi.fn();
    await expect(new WebPageFetcher({ fetchImpl, lookupImpl: lookupImpl as never }).fetch('https://evil.example'))
      .rejects.toThrow('Private network URLs');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('blocks DNS answers that resolve to hex-form NAT64 loopback', async () => {
    const lookupImpl = vi.fn(async () => [{ address: '64:ff9b::7f00:1', family: 6 }]);
    const fetchImpl = vi.fn();
    await expect(new WebPageFetcher({ fetchImpl, lookupImpl: lookupImpl as never }).fetch('https://evil.example'))
      .rejects.toThrow('Private network URLs');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('bounds response bodies to prevent memory exhaustion', async () => {
    const lookupImpl = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);
    const fetchImpl = vi.fn(async () => new Response('x', { headers: { 'content-length': String(3 * 1024 * 1024) } }));
    await expect(new WebPageFetcher({ fetchImpl: fetchImpl as typeof fetch, lookupImpl: lookupImpl as never }).fetch('https://example.com'))
      .rejects.toThrow('exceeds 2 MiB');
  });

  test('pins the validated DNS address into the connection adapter', async () => {
    const lookupImpl = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);
    const requestImpl = vi.fn(async () => new Response('<title>Safe</title>', { status: 200, headers: { 'content-type': 'text/html' } }));
    const result = await new WebPageFetcher({ lookupImpl: lookupImpl as never, requestImpl }).fetch('https://example.com/page');
    expect(result.title).toBe('Safe');
    expect(requestImpl).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: 'example.com' }),
      '93.184.216.34',
      expect.any(AbortSignal),
      expect.any(Object),
    );
  });
});
