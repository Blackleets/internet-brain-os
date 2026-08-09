import { describe, expect, it } from 'vitest';
import { interactiveMissionConfirmationActor } from './mission-confirmation-boundary.mjs';

describe('interactive mission confirmation boundary', () => {
  it('recognizes an extension origin only as an interactive UI class, not as a forged user id', () => {
    expect(interactiveMissionConfirmationActor(`chrome-extension://${'a'.repeat(32)}`)).toEqual({
      actorType: 'interactive_user',
      decidedBy: 'extension-ui',
    });
  });

  it.each(['http://127.0.0.1:4173', 'http://localhost:4173'])('recognizes local Control Center origin %s', (origin) => {
    expect(interactiveMissionConfirmationActor(origin)).toEqual({ actorType: 'interactive_user', decidedBy: 'dashboard-ui' });
  });

  it('recognizes an explicitly configured dashboard origin', () => {
    expect(interactiveMissionConfirmationActor('https://efesto.example', new Set(['https://efesto.example']))).toEqual({
      actorType: 'interactive_user',
      decidedBy: 'dashboard-ui',
    });
  });

  it.each([undefined, '', 'https://malicious.example', 'chrome-extension://invalid'])('does not infer user authority from untrusted origin %#', (origin) => {
    expect(interactiveMissionConfirmationActor(origin, new Set(['https://efesto.example']))).toBeUndefined();
  });
});
