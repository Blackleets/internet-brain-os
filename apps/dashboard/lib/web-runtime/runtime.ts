export type EfestoRuntimeMode = 'local' | 'web';

/**
 * The hosted surface is intentionally selected from the browser origin. Local
 * development and the existing Kernel-backed tests stay on the private path;
 * a deployed origin gets the zero-setup web shell. The query override is a
 * non-secret QA switch so the hosted path can be verified locally.
 */
export function detectEfestoRuntimeMode(): EfestoRuntimeMode {
  if (typeof window !== 'undefined') {
    const requested = new URLSearchParams(window.location.search).get('runtime');
    if (requested === 'local' || requested === 'web') return requested;
  }

  const configured = process.env.NEXT_PUBLIC_EFESTO_RUNTIME_MODE;
  if (configured === 'local' || configured === 'web') return configured;
  if (typeof window === 'undefined') return 'local';

  return isLoopbackHost(window.location.hostname) ? 'local' : 'web';
}

function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}
