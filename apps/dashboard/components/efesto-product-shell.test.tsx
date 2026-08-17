// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preferencesResponse } from '../test/fixtures';
import { EFESTO_LOCALE_STORAGE_KEY } from '../lib/efesto-i18n';
import EfestoProductShell from './efesto-product-shell';

const token = 'test-token-that-is-long-enough-for-kernel-validation';
const requests: Request[] = [];
let githubFixtureMode = false;
let githubGoalMode = false;
let githubAuthorizationRevoked = false;

const base = {
  '/health': { ok: true, service: 'hephaestus-local-kernel', hermes: true, replayLab: true },
  '/status': { ok: true, service: 'hephaestus-local-kernel', kernel: 'ready', hermes: 'ready', replayLab: 'ready', ollama: 'configured', obsidian: 'configured' },
  '/bootstrap/status': { schemaVersion: 'efesto.bootstrap-status.v1', ok: true, kernel: 'ready', hermes: 'ready', obsidian: 'ready', pairing: 'paired', overall: 'ready', message: 'ready', diagnostics: {}, actions: [] },
  '/api/cases': { ok: true, cases: [{ id: 'case-1', title: 'Supplier research', status: 'active' }] },
  '/api/goals': { ok: true, goals: [{ id: 'goal-1', title: 'Existing goal', priority: 2, status: 'active', createdAt: '2026-08-09T08:00:00.000Z' }] },
  '/api/agent-missions': { ok: true, missions: [{ id: 'mission-1', goalId: 'goal-1', status: 'completed', executionPhase: 'forged', attempt: 1, createdAt: '2026-08-09T08:01:00.000Z' }] },
  '/api/goal-surfaces': { ok: true, surfaces: [{ schemaVersion: 'efesto.goal-surface.v1', sourceOfTruth: 'kernel', observedAt: '2026-08-09T08:04:00.000Z', goal: { id: 'goal-1', title: 'Existing goal', status: 'active', revision: 1, createdAt: '2026-08-09T08:00:00.000Z', updatedAt: '2026-08-09T08:00:00.000Z', compatibility: 'legacy_radar', policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' } }, mission: { id: 'mission-1', status: 'running', executionPhase: 'verifying', workState: 'verifying', createdAt: '2026-08-09T08:01:00.000Z', updatedAt: '2026-08-09T08:04:00.000Z', attempt: 1 } }] },
  '/api/opportunities': { ok: true, opportunities: [{ id: 'opp-1', title: 'Taladro 21 €', category: 'shopping', categoryLabel: 'Compra', benefitType: 'saving', sourceHost: 'shop.example', relevance: 0.92, nextAction: 'Abrir la fuente y comparar', status: 'new', detectedAt: '2026-08-09T08:02:00.000Z' }] },
  '/api/chat/providers': { ok: true, providers: [{ id: 'fixture-local', type: 'ollama', label: 'Ollama local', models: ['qwen3:4b'], managedBy: 'environment' }] },
  '/api/model-forge': { ok: true, forge: { runtime: 'available', hardware: { ramGiB: 32, cpuCores: 12, tier: 'powerful' }, activeModel: 'qwen3:4b', recommended: 'qwen3:4b', models: [{ id: 'qwen3:4b', label: 'Qwen 3 4B', minRamGiB: 8, tier: 'light', uses: ['chat'], multilingual: true, compatible: true, installed: true, active: true }], setup: { action: 'configure', command: null, setting: null, restartRequired: false } } },
  '/api/preferences': preferencesResponse,
  '/api/integrations': { ok: true, schemaVersion: 'efesto.integration-catalog.v1', authority: 'kernel', generatedAt: '2026-08-09T08:05:00.000Z', integrations: [
    { id: 'kernel', kind: 'core', adapter: 'native', status: 'ready', capabilities: ['goal.prepare', 'mission.confirm', 'evidence.read'], scopes: ['local'], action: 'settings' },
    { id: 'hermes', kind: 'agent', adapter: 'native', status: 'ready', capabilities: ['mission.execute'], scopes: ['public.read'], action: 'agents' },
    { id: 'obsidian', kind: 'memory', adapter: 'native', status: 'ready', capabilities: ['memory.project'], scopes: ['local.memory'], action: 'settings' },
    { id: 'browser-extension', kind: 'capture', adapter: 'native', status: 'ready', capabilities: ['capture.public_page'], scopes: ['public.read'], action: 'settings' },
    { id: 'model-providers', kind: 'model', adapter: 'native', status: 'ready', capabilities: ['chat.generate'], scopes: ['model.input'], action: 'models', count: 1 },
    { id: 'mcp-gateway', kind: 'transport', adapter: 'mcp', status: 'not_configured', capabilities: [], scopes: ['scoped.tool'], action: 'settings', readOnly: true, requiresExplicitConsent: true, statusReason: 'gateway_not_configured' },
    { id: 'github', kind: 'transport', adapter: 'native', status: 'not_configured', capabilities: [], scopes: ['github.read'], action: 'settings', readOnly: true, requiresExplicitConsent: true, statusReason: 'credential_required' },
    { id: 'gmail', kind: 'transport', adapter: 'mcp', status: 'not_configured', capabilities: [], scopes: ['gmail.read'], action: 'settings', readOnly: true, requiresExplicitConsent: true, statusReason: 'gateway_not_configured' },
    { id: 'google-drive', kind: 'transport', adapter: 'mcp', status: 'not_configured', capabilities: [], scopes: ['drive.read'], action: 'settings', readOnly: true, requiresExplicitConsent: true, statusReason: 'gateway_not_configured' },
    { id: 'notion', kind: 'transport', adapter: 'mcp', status: 'not_configured', capabilities: [], scopes: ['notion.read'], action: 'settings', readOnly: true, requiresExplicitConsent: true, statusReason: 'gateway_not_configured' },
    { id: 'google-calendar', kind: 'transport', adapter: 'mcp', status: 'not_configured', capabilities: [], scopes: ['calendar.read'], action: 'settings', readOnly: true, requiresExplicitConsent: true, statusReason: 'gateway_not_configured' },
  ] },
  '/api/goals/plan': { ok: true, schemaVersion: 'efesto.goal-intelligence.v1', authority: 'kernel', generatedAt: '2026-08-09T08:05:00.000Z', goal: { title: 'Encuéntrame un taladro bueno por 18 a 25 euros', categories: ['tool', 'offer'], keywords: ['18', '25'] }, intent: { primaryCategory: 'tool', mode: 'public_research' }, sources: [{ id: 'hermes', adapter: 'native', selected: true, required: true, reason: 'public_research', status: 'ready', scopes: ['public.read'], requiredCapabilities: ['mission.execute', 'public.read'], activeCapabilities: ['mission.execute', 'public.read'], action: 'agents' }], readiness: 'ready', nextAction: 'confirm_goal', limitations: ['read_only_sources'] },
} as const;

function responseFor(path: string, method: string): Response {
  if (method === 'POST' && path === '/api/efesto/plan') {
    const plan = JSON.parse(JSON.stringify(base['/api/goals/plan'])) as Record<string, unknown> & { sources: Array<Record<string, unknown>> };
    plan.authority = 'web-runtime';
    plan.readiness = 'ready';
    plan.nextAction = 'confirm_goal';
    plan.limitations = ['preview_only', 'kernel_required_for_execution', 'read_only_sources'];
    plan.sources = [{ id: 'public-web', adapter: 'native', selected: true, required: true, reason: 'public_research', status: 'ready', scopes: ['public.read'], requiredCapabilities: ['web.search', 'public.read'], activeCapabilities: ['web.search', 'public.read'], action: null }];
    plan.publicSearch = { provider: 'bing-html', query: 'Audita un repositorio de GitHub', searchedAt: '2026-08-15T10:00:00.000Z', status: 'ready', results: [{ rank: 1, title: 'Resultado público de prueba', url: 'https://example.com/result', snippet: 'Fuente pública devuelta por el proveedor.', sourceHost: 'example.com' }] };
    return Response.json({ ok: true, ...plan });
  }
  if (method === 'POST' && path === '/api/goals') return Response.json({ ok: true, goal: { id: 'goal-created' } });
  if (method === 'POST' && path === '/api/goals/goal-created/missions') return Response.json({ ok: true, mission: { id: 'mission-created' } });
  if (method === 'POST' && path === '/api/integrations/github/credentials') return Response.json({ ok: true, id: 'github', adapter: 'native', status: 'ready', configured: true, capabilities: ['github.repository.read'], scopes: ['github.read'] });
  if (method === 'DELETE' && path === '/api/integrations/github/credentials') return Response.json({ ok: true, id: 'github', adapter: 'native', status: 'not_configured', configured: false, capabilities: [], scopes: ['github.read'] });
  if (method === 'POST' && path === '/api/integrations/github/authorizations') return Response.json({ ok: true, authorization: { id: 'github-auth-created', goalId: 'goal-created', scope: 'github.read', approvedCapabilities: ['github.repository.read'] } });
  if (method === 'DELETE' && path === '/api/integrations/github/authorizations/github-auth-created') {
    githubAuthorizationRevoked = true;
    return Response.json({ ok: true, authorization: { id: 'github-auth-created', status: 'revoked' } });
  }
  if (method === 'POST' && path === '/api/integrations/github/evidence') return Response.json({ ok: true, schemaVersion: 'efesto.github-evidence.v1', replayed: false, duplicate: false, caseId: 'case-github-created', evidenceId: 'evidence-github-created', receiptId: 'github-read-created' }, { status: 201 });
  if (method === 'POST' && path === '/api/opportunities/opp-1/feedback') return Response.json({ ok: true });
  if (method === 'POST' && path === '/api/chat/providers') return Response.json({ ok: true });
  if (method === 'POST' && path === '/api/chat/stream') {
    const body = new ReadableStream({ start(controller) { const encoder = new TextEncoder(); controller.enqueue(encoder.encode('{"type":"delta","delta":"Respuesta real del fixture."}\n')); controller.enqueue(encoder.encode('{"type":"done","response":{"model":"qwen3:4b"}}\n')); controller.close(); } });
    return new Response(body, { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
  }
  if (path === '/api/browser/case/case-1') return Response.json({ ok: true, case: { id: 'case-1', title: 'Supplier research' }, evidence: [{ id: 'ev-1', summary: 'Precio publicado por vendedor', sourceUrl: 'https://shop.example/drill', confidence: 0.91, capturedAt: '2026-08-09T08:03:00.000Z' }] });
  if (path === '/api/browser/case/case-github-created') return Response.json({ ok: true, case: { id: 'case-github-created', title: 'GitHub · Blackleets/internet-brain-os' }, githubAuthorization: { id: 'github-auth-created', goalId: 'goal-created', scope: 'github.read', approvedCapabilities: ['github.repository.read'], issuedAt: '2026-08-14T12:00:00.000Z', expiresAt: '2026-08-14T12:15:00.000Z', status: githubAuthorizationRevoked ? 'revoked' : 'active' }, evidence: [{ id: 'evidence-github-created', summary: 'GitHub repository read · Blackleets/internet-brain-os', sourceUrl: 'https://github.com/Blackleets/internet-brain-os', confidence: 1, capturedAt: '2026-08-14T12:00:00.000Z', tags: ['github', 'read-only', 'repository'], integration: 'github', authorizationId: 'github-auth-created', scope: 'github.read' }] });
  if (path === '/api/integrations') {
    const catalog = JSON.parse(JSON.stringify(base[path]));
    if (githubFixtureMode) {
      const github = catalog.integrations.find((integration: { id: string }) => integration.id === 'github');
      if (github) {
        github.adapter = 'native';
        github.status = 'ready';
        github.capabilities = ['github.repository.read', 'github.issue.read', 'github.pull_request.read', 'github.checks.read'];
        github.requiresExplicitConsent = true;
      }
    }
    return Response.json(catalog);
  }
  if (path === '/api/goals/plan' && githubGoalMode) {
    const plan = JSON.parse(JSON.stringify(base[path]));
    plan.goal.title = 'Audita un repositorio de GitHub';
    plan.intent.mode = 'connector_research';
    plan.sources.push({ id: 'github', adapter: 'native', selected: true, required: true, reason: 'goal_signal', status: 'ready', scopes: ['github.read'], requiredCapabilities: ['github.repository.read'], activeCapabilities: ['github.repository.read'], action: 'settings' });
    return Response.json(plan);
  }
  const body = (base as Record<string, unknown>)[path];
  return body ? Response.json(body) : Response.json({ ok: false }, { status: 404 });
}

async function connect(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Conectar Kernel' }));
  fireEvent.change(screen.getByLabelText('Token privado'), { target: { value: token } });
  fireEvent.click(screen.getByRole('button', { name: 'Autorizar dispositivo' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Kernel listo/ })).toBeTruthy());
}

beforeEach(() => {
  requests.length = 0;
  githubFixtureMode = false;
  githubGoalMode = false;
  githubAuthorizationRevoked = false;
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const resolvedInput = typeof input === 'string' && input.startsWith('/') ? new URL(input, window.location.href) : input;
    const request = new Request(resolvedInput, { ...init, signal: undefined });
    requests.push(request);
    return responseFor(new URL(request.url).pathname, request.method);
  }));
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.sessionStorage.clear(); window.localStorage.clear(); window.history.replaceState({}, '', '/'); });

describe('Efesto conversation-first product shell', () => {
  it('starts honest and conversation-first without simulating Kernel activity', () => {
    render(<EfestoProductShell />);
    expect(screen.getByRole('heading', { name: '¿En qué trabajamos?' })).toBeTruthy();
    expect(screen.getByText('EFESTO · INTELLIGENCE FORGE')).toBeTruthy();
    expect(screen.getByLabelText('Mensaje')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Nueva conversación' }).textContent).toContain('Privado por diseño');
    expect(screen.getByRole('button', { name: /^Goal$/ }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: /^Chat$/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Conectar Kernel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Configurar modelo' })).toBeTruthy();
    expect(screen.getByText('Enter para enviar')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Sugerencia/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cambiar sugerencia' })).toBeNull();
    expect(screen.getByLabelText('Mensaje').getAttribute('placeholder')).toBe('Configura un modelo para empezar…');
    fireEvent.click(screen.getByRole('button', { name: /^Goal$/ }));
    expect(screen.getByLabelText('Goal').getAttribute('placeholder')).toMatch(/Encuéntrame|Busca trabajos|Investiga una empresa|Encuentra oportunidades/);
    expect(requests).toHaveLength(0);
  });

  it('opens the zero-setup web mode and keeps the preview non-authoritative', async () => {
    window.history.replaceState({}, '', '/?runtime=web');
    render(<EfestoProductShell />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Modo web listo' }).length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: /^Goal$/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('EFESTO · TRABAJO DESDE LA WEB')).toBeTruthy();
    const webGuide = screen.getByRole('complementary', { name: 'Guía del modo web' });
    expect(webGuide.textContent).toContain('Explora resultados públicos aquí');
    expect(screen.getByRole('button', { name: 'Abrir modo privado' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Sugerencias para empezar' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Usar sugerencia: Encuéntrame un taladro/ }));
    expect((screen.getByLabelText('Goal') as HTMLTextAreaElement).value).toContain('taladro');

    fireEvent.change(screen.getByLabelText('Goal'), { target: { value: 'Audita un repositorio de GitHub' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preparar Goal' }));
    await waitFor(() => expect(screen.getByText('Resultados encontrados en la web')).toBeTruthy());
    expect(screen.getByText('Resultados públicos no verificados · sin credenciales, escritura ni ejecución.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Resultado público de prueba/ })).toHaveProperty('href', 'https://example.com/result');
    expect(screen.getByRole('button', { name: 'Conectar modo privado para ejecutar' })).toHaveProperty('disabled', false);
    expect(requests.filter((request) => request.method === 'POST').map((request) => new URL(request.url).pathname)).toEqual(['/api/efesto/plan']);
    fireEvent.click(screen.getByRole('button', { name: 'Conectar modo privado para ejecutar' }));
    expect(screen.getByRole('heading', { name: /^Ajustes$/ })).toBeTruthy();
  });

  it('makes a web Chat order produce a bounded preview without a Kernel or model', async () => {
    window.history.replaceState({}, '', '/?runtime=web');
    render(<EfestoProductShell />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Modo web listo' }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: /^Chat$/ }));
    fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Encuentra oportunidades de negocio en Madrid' } });
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toHaveProperty('disabled', false);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() => expect(screen.getByText(/He consultado la búsqueda pública/)).toBeTruthy());
    expect(screen.getAllByText('Web pública · búsqueda real · solo lectura').length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: 'Resultados de búsqueda pública' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Resultado público de prueba/ })).toHaveProperty('href', 'https://example.com/result');
    expect(screen.getByText(/no se han usado credenciales ni se ha ejecutado ninguna acción/)).toBeTruthy();
    expect(requests.filter((request) => request.method === 'POST').map((request) => new URL(request.url).pathname)).toEqual(['/api/efesto/plan']);
  });

  it('switches the interface language from the gear settings and persists it locally', async () => {
    render(<EfestoProductShell />);
    fireEvent.click(screen.getByRole('button', { name: /^Ajustes$/ }));
    expect(screen.getByRole('heading', { name: /^Ajustes$/ })).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: /^Idioma de la interfaz$/ }), { target: { value: 'en' } });
    await waitFor(() => expect(screen.getByRole('heading', { name: /^Settings$/ })).toBeTruthy());
    expect(window.localStorage.getItem(EFESTO_LOCALE_STORAGE_KEY)).toBe('en');
    expect(screen.getByRole('button', { name: /^Home$/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^Home$/ }));
    expect(screen.getByRole('heading', { name: /^What are we working on\?$/ })).toBeTruthy();
    expect(screen.getByText('Enter to send', { exact: true })).toBeTruthy();
  });

  it('drives the Home forge from Shared Goal Truth when legacy Mission state conflicts', async () => {
    render(<EfestoProductShell />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: /^Inicio$/ }));
    expect(screen.getByRole('button', { name: 'Kernel conectado' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Valor del producto' })).toBeTruthy();
    expect(screen.getByText('Solo local · sin telemetría externa')).toBeTruthy();
    expect(requests.some((request) => request.method === 'GET' && new URL(request.url).pathname === '/api/goal-surfaces')).toBe(true);
    expect((base['/api/agent-missions'].missions[0] as { executionPhase: string }).executionPhase).toBe('forged');
  });

  it('prepares a Goal locally and mutates the Kernel only after explicit confirmation', async () => {
    render(<EfestoProductShell />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: /^Inicio$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Goal$/ }));
    const goal = 'Encuéntrame un taladro bueno por 18 a 25 euros';
    fireEvent.change(screen.getByLabelText('Goal'), { target: { value: goal } });
    fireEvent.click(screen.getByRole('button', { name: 'Preparar Goal' }));
    expect(screen.getByText('PLAN PROPUESTO · AÚN NO EJECUTADO')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Ruta de investigación')).toBeTruthy());
    expect(screen.getByText('Hermes Agent')).toBeTruthy();
    expect(requests.filter((request) => request.method === 'POST').map((request) => new URL(request.url).pathname)).toEqual(['/api/goals/plan']);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y ejecutar' }));
    await waitFor(() => expect(requests.filter((request) => request.method === 'POST').map((request) => new URL(request.url).pathname)).toEqual(['/api/goals/plan', '/api/goals', '/api/goals/goal-created/missions']));
    expect(await screen.findByRole('heading', { name: 'Misiones' })).toBeTruthy();
  });

  it('wires Finds feedback and Evidence source inspection to real Kernel routes', async () => {
    render(<EfestoProductShell />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: /^Hallazgos$/ }));
    expect(screen.getByText('Taladro 21 €')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Útil' }));
    await waitFor(() => expect(requests.some((request) => request.method === 'POST' && new URL(request.url).pathname === '/api/opportunities/opp-1/feedback')).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: /^Evidencia$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Supplier research/ }));
    const source = await screen.findByRole('link', { name: /Abrir fuente/ });
    expect(source.getAttribute('href')).toBe('https://shop.example/drill');
    expect(requests.some((request) => new URL(request.url).pathname === '/api/browser/case/case-1')).toBe(true);
  });

  it('surfaces the authenticated integration catalog and routes actions to real views', async () => {
    render(<EfestoProductShell />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: /^Integraciones$/ }));
    expect(screen.getByRole('heading', { name: 'Integraciones' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Efesto Kernel' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'MCP Gateway' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'GitHub' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Gmail' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Google Drive' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Notion' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Google Calendar' })).toBeTruthy();
    expect(screen.getAllByTestId('integration-logo-github').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('integration-logo-gmail').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Resumen de conexiones')).toBeTruthy();
    expect(screen.getByText('Accesos rápidos')).toBeTruthy();
    expect(screen.getAllByText('sin acceso activo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MCP Gateway aún no configurado')).toHaveLength(5);
    expect(screen.getByText('Falta una credencial autorizada')).toBeTruthy();
    expect(requests.some((request) => request.method === 'GET' && new URL(request.url).pathname === '/api/integrations')).toBe(true);

    fireEvent.change(screen.getByRole('combobox', { name: 'Directorio' }), { target: { value: 'local' } });
    expect(screen.getByRole('heading', { name: 'Obsidian' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Efesto Kernel' })).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Directorio' }), { target: { value: 'all' } });

    const integrationReadsBeforeRefresh = requests.filter((request) => new URL(request.url).pathname === '/api/integrations').length;
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar catálogo' }));
    await waitFor(() => expect(requests.filter((request) => new URL(request.url).pathname === '/api/integrations').length).toBeGreaterThan(integrationReadsBeforeRefresh));

    fireEvent.click(screen.getByRole('button', { name: 'Abrir modelos' }));
    expect(screen.getByRole('heading', { name: 'Modelos' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^Integraciones$/ }));
    expect(screen.getAllByRole('button', { name: 'Configurar complemento' }).length).toBe(5);
    fireEvent.click(screen.getAllByRole('button', { name: 'Configurar complemento' })[0]);
    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeTruthy();
    expect(screen.getByText('Conectores externos')).toBeTruthy();
  });

  it('uses a configured model for Chat while keeping model output outside Evidence', async () => {
    render(<EfestoProductShell />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: /^Modelos$/ }));
    fireEvent.click(screen.getByRole('button', { name: /qwen3:4b/ }));
    fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Resume el estado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByText('Respuesta real del fixture.')).toBeTruthy();
    expect(screen.getByText('La conversación permanece separada de la evidencia y la memoria.')).toBeTruthy();
    expect(requests.some((request) => request.method === 'POST' && new URL(request.url).pathname === '/api/chat/stream')).toBe(true);
    expect(window.sessionStorage.getItem('hephaestus.owner.connection.session.v1')).toBeNull();
  });

  it('configures the native GitHub adapter without exposing its credential', async () => {
    render(<EfestoProductShell />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: /^Ajustes$/ }));
    expect(screen.getByText('GitHub', { exact: true })).toBeTruthy();
    const tokenInput = screen.getByLabelText('Token privado de GitHub') as HTMLInputElement;
    fireEvent.change(tokenInput, { target: { value: 'github-test-token-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar y conectar' }));
    await waitFor(() => expect(requests.some((request) => request.method === 'POST' && new URL(request.url).pathname === '/api/integrations/github/credentials')).toBe(true));
    expect(tokenInput.value).toBe('');
    expect(screen.getByText('GitHub verificado y conectado en el Kernel.')).toBeTruthy();
  });

  it('authorizes a GitHub repository read from the Goal brief and opens its Evidence Case', async () => {
    githubFixtureMode = true;
    githubGoalMode = true;
    render(<EfestoProductShell />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: /^Inicio$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Goal$/ }));
    fireEvent.change(screen.getByLabelText('Goal'), { target: { value: 'Audita un repositorio de GitHub' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preparar Goal' }));
    await waitFor(() => expect(screen.getByText('Analizar un repositorio', { exact: true })).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Propietario'), { target: { value: 'Blackleets' } });
    fireEvent.change(screen.getByLabelText('Repositorio'), { target: { value: 'internet-brain-os' } });
    fireEvent.click(screen.getByLabelText(/Autorizo a Efesto/));
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar y crear Evidence' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Evidencia' })).toBeTruthy());
    expect(requests.filter((request) => request.method === 'POST').map((request) => new URL(request.url).pathname)).toEqual([
      '/api/goals/plan',
      '/api/goals',
      '/api/integrations/github/authorizations',
      '/api/integrations/github/evidence',
    ]);
    expect(requests.some((request) => request.method === 'GET' && new URL(request.url).pathname === '/api/browser/case/case-github-created')).toBe(true);
    expect(screen.getByText('GitHub repository read · Blackleets/internet-brain-os')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Revocar autorización' }));
    expect(screen.getByText('Confirma que quieres cerrar este permiso de lectura.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar revocación' }));
    await waitFor(() => expect(requests.some((request) => request.method === 'DELETE' && new URL(request.url).pathname === '/api/integrations/github/authorizations/github-auth-created')).toBe(true));
    expect(await screen.findByText('Esta autorización ya está revocada.')).toBeTruthy();
  });

  it('maps a GitHub checks read to its capability and reference payload', async () => {
    githubFixtureMode = true;
    githubGoalMode = true;
    render(<EfestoProductShell />);
    await connect();
    fireEvent.click(screen.getByRole('button', { name: /^Inicio$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Goal$/ }));
    fireEvent.change(screen.getByLabelText('Goal'), { target: { value: 'Audita los checks de un repositorio de GitHub' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preparar Goal' }));
    await waitFor(() => expect(screen.getByText('Analizar un repositorio', { exact: true })).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Propietario'), { target: { value: 'Blackleets' } });
    fireEvent.change(screen.getByLabelText('Repositorio'), { target: { value: 'internet-brain-os' } });
    fireEvent.change(screen.getByLabelText('Lectura'), { target: { value: 'checks' } });
    fireEvent.change(screen.getByLabelText('Rama, tag o commit'), { target: { value: 'main' } });
    fireEvent.click(screen.getByLabelText(/Autorizo a Efesto/));
    await waitFor(() => expect(screen.getByText(/github\.checks\.read/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar y crear Evidence' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Evidencia' })).toBeTruthy());
    const authorizationRequest = requests.find((request) => request.method === 'POST' && new URL(request.url).pathname === '/api/integrations/github/authorizations');
    const evidenceRequest = requests.find((request) => request.method === 'POST' && new URL(request.url).pathname === '/api/integrations/github/evidence');
    expect(await authorizationRequest?.clone().json()).toMatchObject({ capabilities: ['github.checks.read'], resource: { owner: 'Blackleets', repo: 'internet-brain-os', ref: 'main' } });
    expect(await evidenceRequest?.clone().json()).toMatchObject({ operation: 'checks', ref: 'main' });
  });
});
