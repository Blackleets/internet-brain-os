import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { statusEs } from './efesto-product-views';

const file = ['components/efesto-product-views.tsx', 'apps/dashboard/components/efesto-product-views.tsx'].find((p) => existsSync(p))!;
const src = readFileSync(file, 'utf8');

describe('first-run copy is Spanish and jargon-free by default', () => {
  it('translates readiness states', () => {
    expect(statusEs('ready')).toBe('listo');
    expect(statusEs('offline')).toBe('sin conexión');
    expect(statusEs('paired')).toBe('emparejada');
    expect(statusEs('sin configurar')).toBe('sin configurar');
  });
  it('drops English jargon from the default flow', () => {
    for (const s of ['Kernel-gated', 'Configura un modelo', 'READINESS REAL', 'KERNEL-OWNED', 'Mission Watchtower', 'bridge autenticado']) expect(src).not.toContain(s);
  });
  it('keeps Replay Lab behind Avanzado', () => {
    expect(src).toMatch(/<summary>Avanzado<\/summary><a href=\{replayLabHref/);
  });
});

describe('settings readiness never asks for the optional extension', () => {
  it('maps needs_setup and required to Spanish', () => {
    expect(statusEs('needs_setup')).toBe('falta configurar algo');
    expect(src).toContain("bootstrap?.pairing === 'paired' ? 'emparejada' : 'no usada'");
  });
});
