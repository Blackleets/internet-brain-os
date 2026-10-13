import { describe, expect, it } from 'vitest';
import { attemptFailureCopy, missionFailureCopy } from './forge-model';

const raw = 'Hermes adapter exited with code 1: Hermes exited with code 1: session_id:<redacted-session>';

describe('mission failure copy', () => {
  it('never shows raw adapter diagnostics (exit code, session id) to the user', () => {
    expect(attemptFailureCopy(raw)).toBe('Hermes no devolvió candidatos utilizables');
    const copy = missionFailureCopy(raw);
    expect(copy).not.toMatch(/exited with code|session_id|adapter/);
    expect(copy).toMatch(/^La misión falló: Hermes no devolvió candidatos utilizables\./);
  });
  it('keeps the existing readable mappings', () => {
    expect(attemptFailureCopy('Hermes adapter exited with code 1: Hermes one-shot timed out')).toBe('Hermes tardó demasiado');
    expect(attemptFailureCopy('Local model selection could not reach Ollama')).toBe('no se pudo usar el modelo local');
    expect(missionFailureCopy(undefined)).toBe('La misión falló.');
  });
});
