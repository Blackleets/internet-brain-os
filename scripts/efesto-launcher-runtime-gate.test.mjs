import { describe, expect, it } from 'vitest';
import { launcherRuntimeNeedsAttention } from './efesto-launcher.mjs';

describe('Efesto launcher runtime gate', () => {
  it('does not fail an otherwise healthy runtime only because pairing/optional setup remains', () => {
    expect(launcherRuntimeNeedsAttention({ overall: 'needs_setup', hermes: 'ready' })).toBe(false);
  });

  it.each(['missing', 'invalid', 'failed'])('fails closed when Hermes is %s', (hermes) => {
    expect(launcherRuntimeNeedsAttention({ overall: 'needs_setup', hermes })).toBe(true);
  });

  it('fails closed on an overall failed launcher state', () => {
    expect(launcherRuntimeNeedsAttention({ overall: 'failed', hermes: 'ready' })).toBe(true);
  });
});
