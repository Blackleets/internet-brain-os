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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function responseFor(path: string): Response {
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
  return Response.json(bodies[path]);
}

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

  it('does not issue protected reads before the health probe resolves', async () => {
    const health = deferred<Response>();
    const paths: string[] = [];
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const path = new URL(input.toString()).pathname;
      paths.push(path);
      return path === '/health' ? health.promise : Promise.resolve(responseFor(path));
    }));

    render(<ConnectionGate />);
    fireEvent.change(screen.getByLabelText('Token local'), { target: { value: token } });
    fireEvent.submit(screen.getByRole('button', { name: 'Conectar al Kernel' }).closest('form')!);

    await waitFor(() => expect(paths).toContain('/health'));
    expect(paths.some((path) => path.startsWith('/api/'))).toBe(false);

    health.resolve(responseFor('/health'));
    await waitFor(() => expect(screen.getByText('Kernel conectado')).toBeTruthy());
  });

  it('keeps a newer successful connection when an older request fails later', async () => {
    const oldHealth = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      if (url.port === '4000' && url.pathname === '/health') return oldHealth.promise;
      return Promise.resolve(responseFor(url.pathname));
    }));

    render(<ConnectionGate />);
    const form = screen.getByRole('button', { name: 'Conectar al Kernel' }).closest('form')!;
    fireEvent.change(screen.getByLabelText('Token local'), { target: { value: 'old-token' } });
    fireEvent.submit(form);
    fireEvent.change(screen.getByLabelText('URL del Kernel'), { target: { value: 'http://127.0.0.1:4001' } });
    fireEvent.change(screen.getByLabelText('Token local'), { target: { value: 'new-token' } });
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText('Kernel conectado')).toBeTruthy());
    oldHealth.resolve(new Response(null, { status: 401 }));

    await waitFor(() => expect(connectionStore.get()?.token).toBe('new-token'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not retain a token when an in-flight connection unmounts', async () => {
    const health = deferred<Response>();
    const paths: string[] = [];
    const signals: AbortSignal[] = [];
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(input.toString()).pathname;
      paths.push(path);
      if (init?.signal) signals.push(init.signal as AbortSignal);
      return path === '/health' ? health.promise : Promise.resolve(responseFor(path));
    }));

    const view = render(<ConnectionGate />);
    fireEvent.change(screen.getByLabelText('Token local'), { target: { value: token } });
    fireEvent.submit(screen.getByRole('button', { name: 'Conectar al Kernel' }).closest('form')!);
    view.unmount();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    health.resolve(responseFor('/health'));

    await waitFor(() => expect(paths).toContain('/api/cases'));
    expect(connectionStore.get()).toBeUndefined();
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
