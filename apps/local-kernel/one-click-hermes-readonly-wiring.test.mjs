import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('one-click Hermes read-only readiness wiring', () => {
  const source = readFileSync(resolve('apps/local-kernel/one-click-kernel.mjs'), 'utf8');

  it('keeps installation detection separate from automatic read-only certification', () => {
    expect(source).toContain('detectHermesRuntime, probeHermesReadOnlyRuntime');
    expect(source).toContain('await probeHermesReadOnlyRuntime(hermesRuntime)');
    expect(source).toContain("HEPHAESTUS_HERMES_READY: hermesRuntime.available ? '1' : '0'");
    expect(source).toContain("HEPHAESTUS_HERMES_READ_ONLY_READY: hermesReadOnlyRuntime.ready ? '1' : '0'");
    expect(source).not.toContain("HEPHAESTUS_HERMES_READ_ONLY_READY: hermesRuntime.available ? '1' : '0'");
  });

  it('reports incompatible installed Hermes as blocked rather than silently broadening tools', () => {
    expect(source).toContain('Hermes is installed, but automatic research is blocked');
    expect(source).toContain('certified Hermes safe search-only discovery');
  });
});
