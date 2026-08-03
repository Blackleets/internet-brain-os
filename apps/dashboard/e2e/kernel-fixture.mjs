import { createServer } from 'node:http';

const host = '127.0.0.1';
const port = 4100;
const token = 'test-token-that-is-long-enough-for-kernel-validation';

// ESM-safe representation of the Phase 1 dashboard fixtures.
const fixtures = {
  health: { ok: true, service: 'hephaestus-local-kernel', hermes: false, replayLab: false },
  status: { ok: true, service: 'hephaestus-local-kernel', kernel: 'ready', hermes: 'disabled', replayLab: 'disabled', ollama: 'not_configured', obsidian: 'not_configured' },
  bootstrap: {
    schemaVersion: 'efesto.bootstrap-status.v1', ok: true, kernel: 'ready', hermes: 'ready', obsidian: 'ready', pairing: 'paired', overall: 'ready',
    message: 'Efesto is ready. Open the extension and press the central orb.', diagnostics: { kernel: { reachable: true }, hermes: { found: true }, obsidian: { configured: true }, pairing: { paired: true } },
    actions: [{ id: 'open_efesto', label: 'Open Efesto', recoverable: false }],
  },
  cases: { ok: true, cases: [{ id: 'case-1', title: 'Supplier research', status: 'active' }] },
  goals: { ok: true, goals: [{ id: 'goal-1', title: 'Find AI clients', priority: 3, status: 'active', createdAt: '2026-07-26T10:00:00.000Z' }] },
  missions: { ok: true, missions: [{ id: 'mission-1', goalId: 'goal-1', goalTitle: 'Find AI clients', status: 'running', executionPhase: 'investigating', attempt: 1, createdAt: '2026-07-26T10:00:00.000Z' }] },
  opportunities: {
    ok: true,
    opportunities: [{ id: 'opportunity-1', category: 'client', categoryLabel: 'Potential client', benefitType: 'income', title: 'AI automation project', sourceHost: 'clients.example', relevance: 72, nextAction: 'Qualify the need before contacting', status: 'new', detectedAt: '2026-07-26T10:00:00.000Z' }],
  },
  providers: { ok: true, providers: [{ id: 'fixture-local', type: 'ollama', label: 'Ollama local', baseUrl: 'http://127.0.0.1:11434', models: ['qwen3:4b'], hasCredential: true, managedBy: 'environment' }] },
  conversations: { ok: true, conversations: [] },
};

const routes = new Map([
  ['/health', fixtures.health],
  ['/status', fixtures.status],
  ['/bootstrap/status', fixtures.bootstrap],
  ['/api/cases', fixtures.cases],
  ['/api/goals', fixtures.goals],
  ['/api/agent-missions', fixtures.missions],
  ['/api/opportunities', fixtures.opportunities],
  ['/api/chat/providers', fixtures.providers],
  ['/api/chat/conversations', fixtures.conversations],
]);

const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', `http://${host}:${port}`).pathname;
  const headers = {
    'access-control-allow-origin': 'http://127.0.0.1:3000',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'accept, content-type, x-hephaestus-token',
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  };

  if (request.method === 'OPTIONS') {
    response.writeHead(204, headers).end();
    return;
  }

  if (path.startsWith('/api/') && request.headers['x-hephaestus-token'] !== token) {
    response.writeHead(401, headers).end(JSON.stringify({ ok: false }));
    return;
  }

  if (request.method === 'POST' && path === '/api/chat/completions') {
    response.writeHead(200, headers).end(JSON.stringify({ ok: true, response: { content: 'Fixture response from the selected local model.', model: 'qwen3:4b', evidenceStatus: 'unverified_model_output', memoryStatus: 'not_admitted' } }));
    return;
  }
  if (request.method === 'POST' && path === '/api/goals') {
    response.writeHead(200, headers).end(JSON.stringify({ ok: true, goal: { id: 'goal-e2e', title: 'Auditar fuentes públicas' } }));
    return;
  }
  if (request.method === 'POST' && path === '/api/goals/goal-e2e/missions') {
    response.writeHead(200, headers).end(JSON.stringify({ ok: true, mission: { id: 'mission-e2e', status: 'queued' } }));
    return;
  }
  if (request.method === 'POST' && path === '/api/chat/stream') {
    response.writeHead(200, { ...headers, 'content-type': 'application/x-ndjson; charset=utf-8' });
    response.write(`${JSON.stringify({ type: 'conversation', conversationId: 'conversation-fixture' })}\n`);
    response.write(`${JSON.stringify({ type: 'delta', delta: 'Fixture response ' })}\n`);
    response.write(`${JSON.stringify({ type: 'delta', delta: 'from the selected local model.' })}\n`);
    response.end(`${JSON.stringify({ type: 'done', conversationId: 'conversation-fixture', response: { model: 'qwen3:4b', evidenceStatus: 'unverified_model_output', memoryStatus: 'not_admitted' } })}\n`);
    return;
  }
  if (request.method !== 'GET') {
    response.writeHead(405, headers).end();
    return;
  }

  if (path === '/api/model-forge') {
    response.writeHead(404, headers).end(JSON.stringify({ ok: false, code: 'MODEL_FORGE_UNAVAILABLE' }));
    return;
  }

  const body = routes.get(path);
  if (!body) {
    response.writeHead(404, headers).end(JSON.stringify({ ok: false }));
    return;
  }

  response.writeHead(200, headers).end(JSON.stringify(body));
});

server.once('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => process.exit(0)));
}

server.listen(port, host);
