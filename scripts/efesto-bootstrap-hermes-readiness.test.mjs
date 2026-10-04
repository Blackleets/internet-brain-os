import { describe, expect, it, vi } from 'vitest';
import { probeHermes } from './efesto-bootstrap.mjs';

const executable = process.platform === 'win32'
  ? 'C:\\fake\\hermes.exe'
  : '/tmp/fake-hermes';

describe('Efesto bootstrap Hermes readiness', () => {
  it('fails closed when the one-click runtime did not certify search-only Hermes', async () => {
    const runHermesValidation = vi.fn();
    await expect(probeHermes({
      HEPHAESTUS_HERMES_EXECUTABLE: executable,
      HEPHAESTUS_HERMES_READ_ONLY_READY: '0',
    }, { runHermesValidation })).resolves.toEqual({
      found: true,
      valid: false,
      executable,
      error: 'runtime_read_only_unverified',
    });
    expect(runHermesValidation).not.toHaveBeenCalled();
  });

  it('reports ready only when the one-click runtime already certified search-only Hermes', async () => {
    await expect(probeHermes({
      HEPHAESTUS_HERMES_EXECUTABLE: executable,
      HEPHAESTUS_HERMES_READ_ONLY_READY: '1',
    })).resolves.toEqual({
      found: true,
      valid: true,
      executable,
      mode: 'bounded_isolated_search_only',
    });
  });

  it('keeps legacy standalone bootstrap probing unchanged when no one-click certification is present', async () => {
    await expect(probeHermes({ HEPHAESTUS_HERMES_EXECUTABLE: executable }, {
      validateHermes: false,
    })).resolves.toEqual({ found: true, valid: true, executable });
  });
});
