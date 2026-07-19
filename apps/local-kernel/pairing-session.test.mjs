import { describe, expect, it } from 'vitest';
import { PairingSession } from './pairing-session.mjs';

const token = 'persistent-token-that-is-at-least-32-characters';

describe('PairingSession', () => {
  it('delivers the credential once with normalized code input', () => {
    const session = new PairingSession(token, { code: 'ABCD2345', expiresAt: 2_000, now: () => 1_000 });
    expect(session.consume('abcd-2345')).toEqual({ apiToken: token });
    expect(() => session.consume('ABCD2345')).toThrow(expect.objectContaining({ code: 'PAIRING_ALREADY_USED', status: 410 }));
  });

  it('expires and locks after bounded invalid attempts', () => {
    const expired = new PairingSession(token, { code: 'ABCD2345', expiresAt: 1_000, now: () => 1_000 });
    expect(() => expired.consume('ABCD2345')).toThrow(expect.objectContaining({ code: 'PAIRING_EXPIRED' }));

    const session = new PairingSession(token, { code: 'ABCD2345', expiresAt: 2_000, now: () => 1_000, maximumAttempts: 2 });
    expect(() => session.consume('WRONG111')).toThrow(expect.objectContaining({ code: 'PAIRING_INVALID' }));
    expect(() => session.consume('WRONG222')).toThrow(expect.objectContaining({ code: 'PAIRING_LOCKED', status: 429 }));
    expect(() => session.consume('ABCD2345')).toThrow(expect.objectContaining({ code: 'PAIRING_LOCKED' }));
  });
});
