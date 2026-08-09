// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EfestoProductShell from './efesto-product-shell';

const token = 'test-token-that-is-long-enough-for-kernel-validation';
const requests: Request[] = [];

const base = {
  '/health': { ok: true, service: 'hephaestus-local-kernel', hermes: true, replayLab: true },
  '/status': { ok: true, service: 'hephaestus-local-kernel', kernel: 'ready', hermes: 'ready', replayLab: 'ready', ollama: 'configured', obsidian: 'configured' },
  '/bootstrap/status': { schemaVersion: 'efesto.bootstrap-status.v1', ok: true, kernel: 'ready', hermes: 'ready', obsidian: 'ready', pairing: 'paired', overall: 'ready', message: 'ready', diagnostics: {}, actions: [] },
  '/api/cases': { ok: true, cases: [{ id: 'case-1', title: 'Supplier research', status: 'active' }] },
  '/api/goals': { ok: true, goals: [{ id: 'goal-1', title: 'Existing goal', priority: 2, status: 'active', createdAt: '2026-08-09T08:00:00.000Z' }] },
  '/api/agent-missions': { ok: true, missions: [{ id: 'mission-1', goalId: 'goal-1', status: 'completed', executionPhase: 'forged', attempt: 1, createdAt: '2026-08-09T08:01:00.000Z' }] },
  '/api/opportunities': { ok: true, opportunities: [{ id: 'opp-1', title: 'Taladro 21 €', category: 'shopping', categoryLabel: 'Compra', benefitType: 'saving', sourceHost: 'shop.example', relevance: 0.92, nextAction: 'Abrir la fuente y comparar', status: 'new', detectedAt: '2026-08-09T08:02:00.000Z' }] },
  '/api/chat/providers': { ok: true, providers: [{ id: 'fixture-local', type: 'ollama', label: 'Ollama local', models: ['qwen3:4b'], managedBy: 'environment' }] },
  '/api/model-forge': { ok: true, forge: { runtime: 'available', hardware: { ramGiB: 32, cpuCores: 12, tier: 'powerful' }, activeModel: 'qwen3:4b', recommended: 'qwen3:4b', models: [{ id: 'qwen3:4b', label: 'Qwen 3 4B', minRamGiB: 8, tier: 'light', uses: ['chat'], multilingual: true, compatible: true, installed: true, active: true }], setup: { action: 'configure', command: null, setting: null, restartRequired: false } } },
} as const;

function responseFor(path: string, method: string): Response {
  if (method === 'POST' && path === '/api/goals') return Response.json({ ok: true, goal: { id: 'goal-created' } });
  if (method === 'POST' && path === '/api/goals/goal-created/missions') return Response.json({ ok: true, mission: { id: 'mission-created' } });
  if (method === 'POST' && path === '/api/opportunities/opp-1/feedback') return Response.json({ ok: true });
  if (method === 'POST' && path === '/api/chat/providers') return Response.json({ ok: true });
  if (method === 'POST' && path === '/api/chat/stream') {
    const body = new ReadableStream({ start(controller) { const encoder = new TextEncoder(); controller.enqueue(encoder.encode('{"type":"delta","delta":"Respuesta real del fixture."}\n')); controller.enqueue(encoder.encode('{"type":"done","response":{"model":"qwen3:4b"}}\n')); controller.close(); } });
    return new Response(body, { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
  }
  if (path === '/api/browser/case/case-1') return Response.json({ ok: true, case: { id: 'case-1', title: 'Supplier research' }, evidence: [{ id: 'ev-1', summary: 'Precio publicado por vendedor', sourceUrl: 'https://shop.example/drill', confidence: 0.91, capturedAt: '2026-08-09T08:03:00.000Z' }] });
  const body = (base as Record<string, unknown>)[path];
  return body ? Response.json(body) : Response.json({ ok: false }, { status: 404 });
}

async function connect(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));
  fireEvent.change(screen.getByLabelText('Token privado'), { target: { value: token } });
  fireEvent.click(screen.getByRole('button', { name: 'Autorizar dispositivo' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Kernel ready/ })).toBeTruthy());
}

beforeEach(() => {
  requests.length = 0;
  window.sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, { ...init, signal: undefined });
    requests.push(request);
    return responseFor(new URL(request.url).pathname, request.method);
  }));
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.sessionStorage.clear(); });

describe('Efesto goal-first product shell', () => {
  it('starts honest and goal-first without simulating Kernel activity', () => {
    render(<EfestoProductShell />);
    expect(screen.getByRole('heading', { name: '¿Qué quieres conseguir?' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Modo local desconectado/ })).toBeTruthy();
    expect(screen.getByLabelText('Goal')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Conectar' })).toBeTruthy();
    expect(requests).toHaveLength(0);
  });

  it('prepares a Goal locally and mutates the Kernel only after explicit confirmation', async () => {
    render(<EfestoProductShell />);
    await connect();
    const goal = 'Encuéntrame un taladro bueno por 18 a 25 euros';
    fireEvent.change(screen.getByLabelText('Goal'), { target: { value: goal } });
    fireEvent.click(screen.getByRole('button', { name: 'Preparar Goal' }));
    expect(screen.getByText('PLAN PROPUESTO · AÚN NO EJECUTADO')).toBeTruthy();
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y ejecutar' }));
    await waitFor(() => expect(requests.filter((request) => request.method === 'POST').map((request) => new URL(request.url).pathname)).toEqual(['/api/goals', '/api/goals/goal-created/missions']));
    expect(await screen.findByRole('heading', { name: 'Missions' })).toBeTruthy();
  });

  it('wires Finds feedback and Evidence source inspection to real Kernel routes', async () => {
    render(<EfestoProductShell />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: /Finds/ }));
    expect(screen.getByText('Taladro 21 €')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Útil' }));
    await waitFor(() => expect(requests.some((request) => request.method === 'POST' && new URL(request.url).pathname === '/api/opportunities/opp-1/feedback')).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: /Evidence/ }));
    fireEvent.click(screen.getByRole('button', { name: /Supplier research/ }));
    const source = await screen.findByRole('link', { name: /Abrir fuente/ });
    expect(source.getAttribute('href')).toBe('https://shop.example/drill');
    expect(requests.some((request) => new URL(request.url).pathname === '/api/browser/case/case-1')).toBe(true);
  });

  it('uses a configured model for Chat while keeping model output outside Evidence', async () => {
    render(<EfestoProductShell />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: /Models/ }));
    fireEvent.click(screen.getByRole('button', { name: /qwen3:4b/ }));
    fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Resume el estado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Respuesta real del fixture.')).toBeTruthy();
    expect(screen.getByText('No admitido en memoria')).toBeTruthy();
    expect(requests.some((request) => request.method === 'POST' && new URL(request.url).pathname === '/api/chat/stream')).toBe(true);
    expect(window.sessionStorage.getItem('hephaestus.owner.connection.session.v1')).toBeNull();
  });
});
