// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EfestoProductShell from './efesto-product-shell';
import { connectionStore } from '../lib/session/connection-store';

const token = 'test-token-that-is-long-enough-for-kernel-validation';
const bodies: Record<string, unknown> = {
  '/health': { ok: true, service: 'hephaestus-local-kernel', hermes: false, replayLab: false },
  '/status': { ok: true, service: 'hephaestus-local-kernel', kernel: 'ready', hermes: 'missing', replayLab: 'missing', ollama: 'missing', obsidian: 'missing' },
  '/bootstrap/status': { schemaVersion: 'efesto.bootstrap-status.v1', ok: true, kernel: 'ready', hermes: 'missing', obsidian: 'missing', pairing: 'required', overall: 'needs_setup', message: 'x', diagnostics: {}, actions: [] },
  '/api/cases': { ok: true, cases: [] },
  '/api/goals': { ok: true, goals: [] },
  '/api/agent-missions': { ok: true, missions: [] },
  '/api/opportunities': { ok: true, opportunities: [] },
  '/api/chat/providers': { ok: true, providers: [] },
};

beforeEach(() => {
  connectionStore.clear();
  window.sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(new Request(input, { ...init, signal: undefined }).url).pathname;
    if (path === '/api/goal-surfaces') return Response.json({ ok: false, code: 'GOAL_SURFACES_FAILED' }, { status: 500 });
    const body = bodies[path];
    return body ? Response.json(body) : Response.json({ ok: false }, { status: 404 });
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('goal surfaces are optional for the connection', () => {
  it('connects even when /api/goal-surfaces fails, without a misleading token error', async () => {
    render(<EfestoProductShell />);
    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));
    fireEvent.change(screen.getByLabelText('Token privado'), { target: { value: token } });
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar dispositivo' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Kernel listo/ })).toBeTruthy());
    expect(screen.queryByText(/Revisa la URL local y el token/)).toBeNull();
  });
});
