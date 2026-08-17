// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectEfestoRuntimeMode } from './runtime';

afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState({}, '', '/');
});

describe('Efesto runtime selection', () => {
  it('lets an explicit URL mode select the hosted preview', () => {
    vi.stubEnv('NEXT_PUBLIC_EFESTO_RUNTIME_MODE', 'local');
    window.history.replaceState({}, '', '/?runtime=web');

    expect(detectEfestoRuntimeMode()).toBe('web');
  });

  it('uses the configured mode when there is no URL override', () => {
    vi.stubEnv('NEXT_PUBLIC_EFESTO_RUNTIME_MODE', 'web');

    expect(detectEfestoRuntimeMode()).toBe('web');
  });
});
