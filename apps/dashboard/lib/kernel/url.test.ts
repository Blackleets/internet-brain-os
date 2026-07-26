import { describe, expect, it } from 'vitest';
import { KernelUrlError, normalizeKernelBaseUrl } from './url';

describe('normalizeKernelBaseUrl', () => {
  it('removes a trailing slash from an accepted localhost address to prevent distinct Kernel origins', () => {
    expect(normalizeKernelBaseUrl('http://localhost:4000/')).toBe('http://localhost:4000');
  });

  it('keeps an accepted IPv4 loopback address as its origin', () => {
    expect(normalizeKernelBaseUrl('http://127.0.0.1:4000')).toBe('http://127.0.0.1:4000');
  });

  it('rejects credentials so a Kernel secret cannot be embedded in its address', () => {
    expect(() => normalizeKernelBaseUrl('http://user:pass@localhost:4000')).toThrowError('INVALID_KERNEL_URL');
    try {
      normalizeKernelBaseUrl('http://user:pass@localhost:4000');
    } catch (error) {
      expect(error).toMatchObject({
      code: 'INVALID_KERNEL_URL',
      } satisfies Pick<KernelUrlError, 'code'>);
    }
  });

  it.each([
    ['a path', 'http://localhost:4000/api'],
    ['a query', 'http://localhost:4000/?token=secret'],
    ['a fragment', 'http://localhost:4000/#settings'],
  ])('rejects %s so the Kernel connection remains an origin-only address', (_breakName, value) => {
    expect(() => normalizeKernelBaseUrl(value)).toThrowError('INVALID_KERNEL_URL');
  });

  it.each([
    ['an HTTPS public host', 'https://example.com'],
    ['a wildcard binding', 'http://0.0.0.0:4000'],
  ])('rejects %s so the dashboard cannot connect beyond loopback', (_breakName, value) => {
    expect(() => normalizeKernelBaseUrl(value)).toThrowError('NON_LOOPBACK_KERNEL_URL');
  });
});
