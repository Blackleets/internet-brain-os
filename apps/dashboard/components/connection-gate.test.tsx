// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectionGate } from './connection-gate';
import { connectionStore } from '../lib/session/connection-store';
import {
  bootstrapResponse,
  casesResponse,
  goalsResponse,
  healthResponse,
  missionsResponse,
  modelForgeResponse,
  opportunitiesResponse,
  statusResponse,
} from '../test/fixtures';

const token = 'secret-token-that-must-not-render';

afterEach(() => {
  cleanup();
  connectionStore.clear();
  vi.unstubAllGlobals();
});

describe('ConnectionGate', () => {
  it('opens the overview after public health and protected Kernel reads succeed', async () => {
    const requests: Request[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      const bodies: Record<string, unknown> = {
        '/health': healthResponse,
        '/status': statusResponse,
        '/bootstrap/status': bootstrapResponse,
        '/api/cases': casesResponse,
        '/api/goals': goalsResponse,
        '/api/agent-missions': missionsResponse,
        '/api/opportunities': opportunitiesResponse,
        '/api/model-forge': modelForgeResponse,
      };
      return Response.json(bodies[new URL(request.url).pathname]);
    }));

    render(<ConnectionGate />);
    fireEvent.change(screen.getByLabelText('Token local'), { target: { value: token } });
    fireEvent.submit(screen.getByRole('button', { name: 'Conectar al Kernel' }).closest('form')!);

    await waitFor(() => expect(screen.getByText('Kernel conectado')).toBeTruthy());
    const healthIndex = requests.findIndex((request) => new URL(request.url).pathname === '/health');
    const protectedIndex = requests.findIndex((request) => new URL(request.url).pathname === '/api/cases');
    expect(healthIndex).toBeGreaterThanOrEqual(0);
    expect(protectedIndex).toBeGreaterThan(healthIndex);
    expect(requests.some((request) => new URL(request.url).pathname === '/api/cases' && request.headers.get('x-hephaestus-token') === token)).toBe(true);
  });

  it('shows a Spanish reconnection message for a 401 without rendering the token', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(input.toString()).pathname;
      if (path === '/api/cases') return new Response(null, { status: 401 });
      const bodies: Record<string, unknown> = {
        '/health': healthResponse,
        '/status': statusResponse,
        '/bootstrap/status': bootstrapResponse,
        '/api/goals': goalsResponse,
        '/api/agent-missions': missionsResponse,
        '/api/opportunities': opportunitiesResponse,
        '/api/model-forge': modelForgeResponse,
      };
      return Response.json(bodies[path]);
    }));

    render(<ConnectionGate />);
    fireEvent.change(screen.getByLabelText('Token local'), { target: { value: token } });
    fireEvent.submit(screen.getByRole('button', { name: 'Conectar al Kernel' }).closest('form')!);

    await waitFor(() => expect(screen.getByText('El token no es válido. Vuelve a conectarte al Kernel.')).toBeTruthy());
    expect(document.body.textContent).not.toContain(token);
  });

  it('uses a non-autocompleting password field for the token', () => {
    render(<ConnectionGate />);

    const input = screen.getByLabelText('Token local') as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input.autocomplete).toBe('off');
  });
});
