import { createServer } from 'node:http';

const host = '127.0.0.1';
const port = 4100;
const token = 'test-token-that-is-long-enough-for-kernel-validation';

const fixtures = {
  health: { ok: true, service: 'hephaestus-local-kernel', hermes: false, replayLab: false },
  status: { ok: true, service: 'hephaestus-local-kernel', kernel: 'ready', hermes: 'disabled', replayLab: 'disabled', ollama: 'not_configured', obsidian: 'not_configured' },
  bootstrap: {
    schemaVersion: 'efesto.bootstrap-status.v1', ok: true, kernel: 'ready', hermes: 'ready', obsidian: 'ready', pairing: 'paired', overall: 'ready',
    message: 'Efesto is ready.', diagnostics: { kernel: { reachable: true }, hermes: { found: true }, obsidian: { configured: true }, pairing: { paired: true } },
    actions: [{ id: 'open_efesto', label: 'Open Efesto', recoverable: false }],
  },
  cases: { ok: true, cases: [{ id: 'case-1', title: 'Supplier research', status: 'active' }] },
  goals: { ok: true, goals: [{ id: 'goal-1', title: 'Find AI clients', priority: 3, status: 'active', createdAt: '2026-07-26T10:00:00.000Z' }] },
  missions: { ok: true, missions: [{ id: 'mission-1', goalId: 'goal-1', goalTitle: 'Find AI clients', status: 'running', executionPhase: 'investigating', attempt: 1, createdAt: '2026-07-26T10:00:00.000Z', verificationResults: [{ candidateId: 'cand-1', status: 'verified', evidenceId: 'evidence-1', sourceUrl: 'https://clients.example/projects/ai-automation', supported: true, supportReason: 'supported' }] }, { id: 'mission-forged', goalId: 'goal-1', goalTitle: 'Find AI clients', status: 'completed', executionPhase: 'forged', attempt: 1, createdAt: '2026-07-26T10:01:00.000Z', verificationResults: [{ candidateId: 'cand-1', status: 'verified', evidenceId: 'evidence-1', sourceUrl: 'https://clients.example/projects/ai-automation', supported: true, supportReason: 'supported' }] }] },
  goalSurfaces: { ok: true, surfaces: [{
    schemaVersion: 'efesto.goal-surface.v1', sourceOfTruth: 'kernel', observedAt: '2026-07-26T10:03:00.000Z',
    goal: {
      id: 'goal-1', title: 'Find AI clients', status: 'active', revision: 1,
      createdAt: '2026-07-26T10:00:00.000Z', updatedAt: '2026-07-26T10:00:00.000Z', compatibility: 'legacy_radar',
      policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' },
    },
    mission: {
      id: 'mission-1', status: 'running', executionPhase: 'investigating', workState: 'investigating',
      createdAt: '2026-07-26T10:00:00.000Z', updatedAt: '2026-07-26T10:03:00.000Z', attempt: 1,
    },
  }] },
  opportunities: { ok: true, opportunities: [{ id: 'opportunity-snippet', category: 'client', categoryLabel: 'Potential client', benefitType: 'income', title: 'Hermes snippet drill', sourceHost: 'search.example', relevance: 40, nextAction: 'Ignore snippet', status: 'new', detectedAt: '2026-07-26T09:59:00.000Z' }, { id: 'opportunity-1', category: 'client', categoryLabel: 'Potential client', benefitType: 'income', title: 'AI automation project', sourceHost: 'clients.example', relevance: 72, nextAction: 'Qualify the need before contacting', status: 'new', detectedAt: '2026-07-26T10:00:00.000Z', evidenceId: 'evidence-1', caseId: 'case-1', sourceUrl: 'https://clients.example/projects/ai-automation', supported: true }] },
  providers: { ok: true, providers: [{ id: 'fixture-local', type: 'ollama', label: 'Ollama local', baseUrl: 'http://127.0.0.1:11434', models: ['qwen3:4b'], hasCredential: true, managedBy: 'environment' }] },
  modelForge: { ok: true, forge: { runtime: 'available', hardware: { ramGiB: 32, cpuCores: 12, tier: 'powerful' }, activeModel: 'qwen3:4b', recommended: 'qwen3:4b', models: [{ id: 'qwen3:4b', label: 'Qwen 3 4B', minRamGiB: 8, tier: 'light', uses: ['chat'], multilingual: true, compatible: true, installed: true, active: true }], setup: { action: 'configure', command: null, setting: null, restartRequired: false } } },
  preferences: {
    ok: true,
    profile: {
      categories: {}, benefitTypes: {}, sources: {}, eventCount: 2,
      productScorecard: {
        schemaVersion: 'efesto.product-scorecard.v1', sourceOfTruth: 'local_kernel', observedAt: '2026-08-10T16:00:00.000Z',
        privacy: { mode: 'local_only', externalTelemetry: false },
        primary: {
          goalUsefulFindRate: { status: 'measured', unit: 'ratio', value: 0.5, reason: null, numerator: 1, denominator: 2 },
          timeToFirstUsefulFind: { status: 'measured', unit: 'milliseconds', value: 300000, reason: null, sampleCount: 1 },
          repeatGoalUsage: { status: 'measured', unit: 'ratio', value: 1, reason: null, numerator: 1, denominator: 1, cohortUnit: 'local_installation', localExecutedGoalCount: 2, localRepeatGoalObserved: true },
        },
        drivers: {
          missionCompletionRate: { status: 'measured', unit: 'ratio', value: 0.5, reason: null, numerator: 1, denominator: 2 },
          findsPerCompletedGoal: { status: 'measured', unit: 'count_per_goal', value: 1, reason: null, numerator: 1, denominator: 1 },
          usefulSavedFindShare: { status: 'measured', unit: 'ratio', value: 0.5, reason: null, numerator: 1, denominator: 2 },
          installationToFirstGoalActivationRate: { status: 'measured', unit: 'ratio', value: 1, reason: null, numerator: 1, denominator: 1, cohortUnit: 'local_installation' },
          goalToNotificationDeliveryRate: { status: 'not_measurable', unit: 'ratio', value: null, reason: 'notification_delivery_ledger_unavailable' },
        },
        guardrails: {
          missionFailureRate: { status: 'measured', unit: 'ratio', value: 0.5, reason: null, numerator: 1, denominator: 2 },
          findDismissalNotInterestedRate: { status: 'measured', unit: 'ratio', value: 0.5, reason: null, numerator: 1, denominator: 2 },
          alteredReplayAcceptance: { status: 'not_measurable', unit: 'count', value: null, reason: 'security_event_ledger_unavailable', target: 0 },
          unauthorizedMemoryAdmission: { status: 'not_measurable', unit: 'count', value: null, reason: 'security_event_ledger_unavailable', target: 0 },
          credentialPrivacyLeakageIncidents: { status: 'not_measurable', unit: 'count', value: null, reason: 'security_incident_ledger_unavailable', target: 0 },
          packagedInstallRepairSuccess: { status: 'not_measurable', unit: 'ratio', value: null, reason: 'release_ci_evidence_not_in_local_store', target: 1 },
        },
        coverage: { executedGoals: 2, completedGoals: 1, goalLinkedFinds: 2, feedbackEvents: 2, orphanFeedbackEvents: 0, invalidTimestampEvents: 0 },
      },
    },
  },
};

const routes = new Map([
  ['/health', fixtures.health], ['/status', fixtures.status], ['/bootstrap/status', fixtures.bootstrap],
  ['/api/cases', fixtures.cases], ['/api/goals', fixtures.goals], ['/api/agent-missions', fixtures.missions], ['/api/goal-surfaces', fixtures.goalSurfaces],
  ['/api/opportunities', fixtures.opportunities], ['/api/chat/providers', fixtures.providers], ['/api/model-forge', fixtures.modelForge], ['/api/preferences', fixtures.preferences],
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

  if (request.method === 'OPTIONS') { response.writeHead(204, headers).end(); return; }
  if (path.startsWith('/api/') && request.headers['x-hephaestus-token'] !== token) { response.writeHead(401, headers).end(JSON.stringify({ ok: false })); return; }

  if (request.method === 'POST' && path === '/api/goals') {
    response.writeHead(200, headers).end(JSON.stringify({ ok: true, goal: { id: 'goal-e2e', title: 'Auditar fuentes públicas' } })); return;
  }
  if (request.method === 'POST' && path === '/api/goals/goal-e2e/missions') {
    response.writeHead(200, headers).end(JSON.stringify({ ok: true, mission: { id: 'mission-e2e', status: 'queued' } })); return;
  }
  if (request.method === 'POST' && path === '/api/opportunities/opportunity-1/feedback') {
    response.writeHead(200, headers).end(JSON.stringify({ ok: true })); return;
  }
  if (request.method === 'POST' && path === '/api/chat/providers') {
    response.writeHead(200, headers).end(JSON.stringify({ ok: true })); return;
  }
  if (request.method === 'POST' && path === '/api/chat/stream') {
    response.writeHead(200, { ...headers, 'content-type': 'application/x-ndjson; charset=utf-8' });
    response.write(`${JSON.stringify({ type: 'conversation', conversationId: 'conversation-fixture' })}\n`);
    response.write(`${JSON.stringify({ type: 'delta', delta: 'Fixture response ' })}\n`);
    response.write(`${JSON.stringify({ type: 'delta', delta: 'from the selected local model.' })}\n`);
    response.end(`${JSON.stringify({ type: 'done', conversationId: 'conversation-fixture', response: { model: 'qwen3:4b', evidenceStatus: 'unverified_model_output', memoryStatus: 'not_admitted' } })}\n`);
    return;
  }
  if (request.method !== 'GET') { response.writeHead(405, headers).end(); return; }

  if (path === '/api/browser/case/case-1') {
    response.writeHead(200, headers).end(JSON.stringify({ ok: true, case: { id: 'case-1', title: 'Supplier research' }, evidence: [{ id: 'evidence-1', summary: 'Public supplier evidence', sourceUrl: 'https://supplier.example/source', confidence: 0.93, capturedAt: '2026-07-26T10:02:00.000Z', tags: ['public'] }] })); return;
  }

  const body = routes.get(path);
  if (!body) { response.writeHead(404, headers).end(JSON.stringify({ ok: false })); return; }
  response.writeHead(200, headers).end(JSON.stringify(body));
});

server.once('error', (error) => { console.error(error); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) server.once(signal, () => server.close(() => process.exit(0)));
server.listen(port, host);
