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
  '/api/agent-missions': { ok: true, missions: [{ id: 'mission-1', goalId: 'goal-1', status: 'completed', executionPhase: 'forged', attempt: 1, createdAt: '2026-08-09T08:01:00.000Z', verificationResults: [{ candidateId: 'cand-1', status: 'verified', evidenceId: 'ev-1', supported: true, supportReason: 'supported' }] }] },
  '/api/goal-surfaces': { ok: true, surfaces: [{ schemaVersion: 'efesto.goal-surface.v1', sourceOfTruth: 'kernel', observedAt: '2026-08-09T08:04:00.000Z', goal: { id: 'goal-1', title: 'Existing goal', status: 'active', revision: 1, createdAt: '2026-08-09T08:00:00.000Z', updatedAt: '2026-08-09T08:00:00.000Z', compatibility: 'legacy_radar', policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' } }, mission: { id: 'mission-1', status: 'running', executionPhase: 'verifying', workState: 'verifying', createdAt: '2026-08-09T08:01:00.000Z', updatedAt: '2026-08-09T08:04:00.000Z', attempt: 1 } }] },
  '/api/opportunities': { ok: true, opportunities: [{ id: 'opp-snippet', title: 'Hermes snippet drill', category: 'shopping', categoryLabel: 'Compra', benefitType: 'saving', sourceHost: 'search.example', relevance: 0.4, nextAction: 'Ignorar snippet', status: 'new', detectedAt: '2026-08-09T08:01:00.000Z' }, { id: 'opp-1', title: 'Taladro 21 €', category: 'shopping', categoryLabel: 'Compra', benefitType: 'saving', sourceHost: 'shop.example', relevance: 0.92, nextAction: 'Abrir la fuente y comparar', status: 'new', detectedAt: '2026-08-09T08:02:00.000Z', evidenceId: 'ev-1', caseId: 'case-1', sourceUrl: 'https://shop.example/drill', supported: true }] },
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
  await waitFor(() => expect(screen.getByRole('button', { name: /Kernel listo/ })).toBeTruthy());
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
    expect(screen.getByRole('heading', { name: '¿Qué estás buscando?' })).toBeTruthy();
    const stateAction = screen.getByRole('button', { name: 'Conectar Kernel' });
    expect(stateAction.className).toContain('phase-offline');
    expect(screen.getAllByText('Privado por diseño').length).toBeGreaterThan(0);
    expect(screen.getByText('Controlado por el Kernel')).toBeTruthy();
    expect(screen.getByText('Confirmación humana')).toBeTruthy();
    expect(screen.getByLabelText('Goal')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Modo de trabajo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chat', exact: true }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Goal', exact: true }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Conectar' })).toBeTruthy();
    expect(requests).toHaveLength(0);
  });
  it('fills the Goal composer from example chips without mutating the Kernel', () => {
    render(<EfestoProductShell />);
    fireEvent.click(screen.getByRole('button', { name: 'Investiga esta empresa' }));
    expect((screen.getByLabelText('Goal') as HTMLTextAreaElement).value).toBe('Investiga esta empresa');
    expect(requests).toHaveLength(0);
  });

  it('drives the Home forge from Shared Goal Truth when legacy Mission state conflicts', async () => {
    render(<EfestoProductShell />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: 'Inicio', exact: true }));
    // Shared Goal Truth wins: the goal-surface mission reports workState
    // 'verifying' while the legacy agent-mission record says 'forged'.
    const stateAction = await screen.findByText('Verificando Evidence');
    expect(stateAction).toBeTruthy();
    expect(screen.getByText('Taladro 21 €')).toBeTruthy();
    expect(screen.getByText('Kernel SUPPORT')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Abrir fuente/ }).getAttribute('href')).toBe('https://shop.example/drill');
    expect(screen.queryByText('Hermes snippet drill')).toBeNull();
    expect(screen.queryByText(/completado/i)).toBeNull();
    expect(requests.some((request) => request.method === 'GET' && new URL(request.url).pathname === '/api/goal-surfaces')).toBe(true);
    expect((base['/api/agent-missions'].missions[0] as { executionPhase: string }).executionPhase).toBe('forged');
  });

  it('prepares a Goal locally and mutates the Kernel only after explicit confirmation', async () => {
    render(<EfestoProductShell />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: 'Inicio', exact: true }));
    const goal = 'Encuéntrame un taladro bueno por 18 a 25 euros';
    fireEvent.change(screen.getByLabelText('Goal'), { target: { value: goal } });
    fireEvent.click(screen.getByRole('button', { name: 'Preparar Goal' }));
    expect(screen.getByText('PLAN PROPUESTO · AÚN NO EJECUTADO')).toBeTruthy();
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y ejecutar' }));
    await waitFor(() => expect(requests.filter((request) => request.method === 'POST').map((request) => new URL(request.url).pathname)).toEqual(['/api/goals', '/api/goals/goal-created/missions']));
    expect(await screen.findByText('Goal persistido y misión confirmada para Hermes.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Goal', exact: true }).getAttribute('aria-pressed')).toBe('true');
  });

  it('wires Finds feedback and Evidence source inspection to real Kernel routes', async () => {
    render(<EfestoProductShell />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: /^Hallazgos/ }));
    expect(screen.getByText('Taladro 21 €')).toBeTruthy();
    expect(screen.getByText('Kernel SUPPORT')).toBeTruthy();
    expect(screen.queryByText('Hermes snippet drill')).toBeNull();
    expect(screen.queryByText('Lead no verificado')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Útil' }));
    await waitFor(() => expect(requests.some((request) => request.method === 'POST' && new URL(request.url).pathname === '/api/opportunities/opp-1/feedback')).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: /^Evidencia/ }));
    fireEvent.click(screen.getByRole('button', { name: /Supplier research/ }));
    const source = await screen.findByRole('link', { name: /Abrir fuente/ });
    expect(source.getAttribute('href')).toBe('https://shop.example/drill');
    expect(requests.some((request) => new URL(request.url).pathname === '/api/browser/case/case-1')).toBe(true);
  });

  it('uses a configured model for Chat while keeping model output outside Evidence', async () => {
    render(<EfestoProductShell />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: /^Modelos/ }));
    fireEvent.click(screen.getByRole('button', { name: /qwen3:4b/ }));
    fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Resume el estado' } });
    expect(screen.getByLabelText('Mensaje').getAttribute('aria-pressed')).toBeNull(); // chat composer is a textarea, not a toggle
    expect(screen.getByText('La conversación permanece separada de Evidence y memoria.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/ }));
    expect(await screen.findByText('Respuesta real del fixture.')).toBeTruthy();
    // Model output boundary: the forge marks assistant messages as private
    // (outside Evidence and memory) instead of the legacy "No admitido" copy.
    expect(screen.getByText('Privado')).toBeTruthy();
    expect(requests.some((request) => request.method === 'POST' && new URL(request.url).pathname === '/api/chat/stream')).toBe(true);
    expect(window.sessionStorage.getItem('hephaestus.owner.connection.session.v1')).toBeNull();
  });
  it('keeps Memory honest and never treats chat as durable memory', async () => {
    render(<EfestoProductShell />);
    fireEvent.click(screen.getByRole('button', { name: /^Memoria/ }));
    expect(screen.getByRole('heading', { name: 'Memoria' })).toBeTruthy();
    expect(screen.getByText('Kernel sin conexión')).toBeTruthy();
    await connect();
    fireEvent.click(screen.getByRole('button', { name: /^Memoria/ }));
    expect(screen.getByText('Memoria no disponible')).toBeTruthy();
    expect(screen.queryByText('Respuesta real del fixture.')).toBeNull();
  });
});
