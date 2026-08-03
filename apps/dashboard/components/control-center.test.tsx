// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ControlCenter from './control-center';

const token = 'test-token-that-is-long-enough-for-kernel-validation';
const ownerConnectionKey = 'hephaestus.owner.connection.v1';

const responses: Record<string, unknown> = {
  '/health': { ok: true, service: 'hephaestus-local-kernel', hermes: false, replayLab: false },
  '/bootstrap/status': {
    schemaVersion: 'efesto.bootstrap-status.v1', ok: true, kernel: 'ready', hermes: 'ready',
    obsidian: 'ready', pairing: 'paired', overall: 'ready', message: 'Efesto ready', diagnostics: {}, actions: [],
  },
  '/api/chat/providers': {
    ok: true,
    providers: [{ id: 'fixture-local', type: 'ollama', label: 'Ollama local', models: ['qwen3:4b'], managedBy: 'environment' }],
  },
  '/api/cases': { ok: true, cases: [{ id: 'case-1', title: 'Supplier research', status: 'active' }] },
  '/api/agent-missions': {
    ok: true,
    missions: [{ id: 'mission-1', goalId: 'goal-1', agent: 'hermes', status: 'running', executionPhase: 'investigating' }],
  },
  '/api/chat/conversations': { ok: true, conversations: [] },
};

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('Sites visual Control Center migration', () => {
  it('renders the ChatGPT-style forge without inventing Kernel activity', () => {
    render(<ControlCenter />);

    expect(screen.getByText('Internet Brain')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '¿Qué quieres investigar hoy?' })).toBeTruthy();
    expect(screen.getByText('Esperando Kernel')).toBeTruthy();
    expect(screen.getByText(/Sin datos inventados/)).toBeTruthy();
    expect(screen.getByLabelText('Mensaje')).toBeTruthy();
  });

  it('rejects a non-loopback Kernel URL before sending the private token', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<ControlCenter />);

    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));
    fireEvent.change(screen.getByLabelText('URL del Kernel'), { target: { value: 'https://attacker.example' } });
    fireEvent.change(screen.getByLabelText('Token privado'), { target: { value: token } });
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar dispositivo' }));

    await waitFor(() => expect(screen.getByText(/No se pudo alcanzar el Kernel/)).toBeTruthy());
    expect(fetcher).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(token);
  });

  it('connects to the real Kernel contract while keeping the token in tab memory by default', async () => {
    const requests: Request[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, { ...init, signal: undefined });
      requests.push(request);
      const path = new URL(request.url).pathname;
      return Response.json(responses[path]);
    }));
    render(<ControlCenter />);

    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));
    const remember = screen.getByRole('checkbox', { name: /Recordar solo en este dispositivo/ }) as HTMLInputElement;
    expect(remember.checked).toBe(false);
    fireEvent.change(screen.getByLabelText('Token privado'), { target: { value: token } });
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar dispositivo' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Kernel online/ })).toBeTruthy());
    expect(window.localStorage.getItem(ownerConnectionKey)).toBeNull();
    expect(requests.some((request) => new URL(request.url).pathname === '/api/cases'
      && request.headers.get('x-hephaestus-token') === token)).toBe(true);
    expect(document.body.textContent).not.toContain(token);
    expect(screen.getByRole('button', { name: 'Desconectar' })).toBeTruthy();
  });
});
