export type KernelUrlErrorCode = 'INVALID_KERNEL_URL' | 'NON_LOOPBACK_KERNEL_URL';

export class KernelUrlError extends Error {
  constructor(readonly code: KernelUrlErrorCode) {
    super(code);
    this.name = 'KernelUrlError';
  }
}

const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

export function normalizeKernelBaseUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new KernelUrlError('INVALID_KERNEL_URL');
  }

  if (url.protocol !== 'http:' || !allowedHosts.has(url.hostname)) {
    throw new KernelUrlError('NON_LOOPBACK_KERNEL_URL');
  }

  const valid = url.username === ''
    && url.password === ''
    && (url.pathname === '/' || url.pathname === '')
    && url.search === ''
    && url.hash === '';

  if (!valid) {
    throw new KernelUrlError('INVALID_KERNEL_URL');
  }

  return url.origin;
}
