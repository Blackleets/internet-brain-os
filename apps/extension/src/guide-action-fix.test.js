import { describe, expect, it } from 'vitest';
import { pairingReadinessView } from './guide-action-fix.js';

describe('extension pairing readiness copy', () => {
  it('does not call a merely reachable Kernel ready before extension pairing', () => {
    expect(pairingReadinessView(false)).toEqual({
      label: 'PAIR KERNEL',
      ready: false,
      status: 'Kernel found. Enter the one-time pairing code below to authorize this extension.',
    });
  });

  it('shows Kernel ready only after a local extension credential exists', () => {
    expect(pairingReadinessView(true)).toMatchObject({ label: 'KERNEL READY', ready: true });
  });
});
