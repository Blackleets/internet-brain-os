import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CaptureCaseEvidenceProjector, LocalKnowledgeStore } from './capture-projector.mjs';
import { InboxError, MAX_BODY_BYTES, PageContextInbox } from './page-context-inbox.mjs';
import { ObsidianKnowledgeProjector } from './obsidian-projector.mjs';
import { OptionalEvidenceSummarizer } from './optional-evidence-summarizer.mjs';
import { loadOrCreateApiToken, validateApiToken } from './api-token-store.mjs';
import { PairingError, PairingSession } from './pairing-session.mjs';
import { ExtensionIdentityRegistry } from './extension-identity-registry.mjs';
import { createHermesLocalIngestionRoute } from './hermes-route-factory.mjs';
import { HermesImportError } from './hermes-import-service.mjs';
import { replayLabPageHtml } from './replay-lab-page.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';
import { GoalManager } from './goals.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { interactiveMissionConfirmationActor } from './mission-confirmation-boundary.mjs';
import { GoalSurfaceReaderError, createGoalSurfaceReader } from './goal-surface-reader.mjs';
import { PreferenceLearner } from './preference-learner.mjs';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';
import { ModelForge } from './model-forge.mjs';
import { ModelProviderError, ModelProviderRegistry } from './model-provider-registry.mjs';
import { ChatServiceError, KernelChatService } from './chat-service.mjs';
import { ChatConversationError, ChatConversationStore } from './chat-conversation-store.mjs';
import { defaultEfestoPaths, inspectEfestoBootstrap, readLauncherConfig } from '../../scripts/efesto-bootstrap.mjs';

const host = process.env.HEPHAESTUS_HOST ?? '127.0.0.1';
const port = Number(process.env.HEPHAESTUS_PORT ?? 4000);
const dataDir = resolve(process.env.HEPHAESTUS_DATA_DIR ?? '.hephaestus');
const isMain = Boolean(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href);
const launcherPaths = defaultEfestoPaths(process.env, process.cwd());
const launcherConfig = isMain ? await readLauncherConfig({ paths: launcherPaths, env: process.env, cwd: process.cwd() }) : {};
const tokenRecord = isMain
  ? await loadOrCreateApiToken(resolve(dataDir, 'kernel-api-token'), {
    envToken: process.env.HEPHAESTUS_API_TOKEN,
    rotate: process.env.HEPHAESTUS_ROTATE_API_TOKEN === '1',
  })
  : { token: validateApiToken('import-only-token-that-is-never-used'), source: 'import' };
const apiToken = tokenRecord.token;
const pairingSession = isMain && (tokenRecord.source === 'created' || tokenRecord.source === 'rotated' || process.env.HEPHAESTUS_PAIRING === '1')
  ? new PairingSession(apiToken)
  : undefined;
const extensionRegistry = new ExtensionIdentityRegistry(resolve(dataDir, 'authorized-extensions.json'));
if (isMain && tokenRecord.source === 'rotated') await extensionRegistry.clear();
const dataFile = resolve(dataDir, 'page-context-inbox.jsonl');
const inbox = new PageContextInbox(dataFile);
const knowledgeStore = new LocalKnowledgeStore(resolve(dataDir, 'store.json'));
const projector = new CaptureCaseEvidenceProjector(knowledgeStore);
const opportunityProjector = new OpportunityProjector(knowledgeStore);
const goalManager = new GoalManager(knowledgeStore);
const obsidian = new ObsidianKnowledgeProjector(
  knowledgeStore,
  resolve(process.env.HEPHAESTUS_OBSIDIAN_DIR ?? launcherConfig.obsidianDir ?? '.hephaestus/obsidian-vault'),
);
const summarizer = new OptionalEvidenceSummarizer(knowledgeStore, {
  model: process.env.HEPHAESTUS_OLLAMA_MODEL,
  baseUrl: process.env.HEPHAESTUS_OLLAMA_URL,
  timeoutMs: Number(process.env.HEPHAESTUS_OLLAMA_TIMEOUT_MS ?? 20_000),
});
const hermes = isMain
  ? await createHermesLocalIngestionRoute({
    dataDir,
    secret: process.env.IBOS_HERMES_SECRET ?? process.env.HEPHAESTUS_HERMES_SECRET,
  })
  : undefined;
const hermesWorkerReady = process.env.HEPHAESTUS_HERMES_READY === '1';
const agentMissionManager = new AgentMissionManager(knowledgeStore, { isAgentReady: (agent) => agent === 'hermes' && (hermesWorkerReady || Boolean(hermes)) });
const goalSurfaceReader = isMain ? await createGoalSurfaceReader(knowledgeStore) : undefined;
const preferenceLearner = new PreferenceLearner(knowledgeStore);
const agentMissionExecutor = new AgentMissionExecutor(knowledgeStore, opportunityProjector);
const modelForge = new ModelForge({
  baseUrl: process.env.HEPHAESTUS_OLLAMA_URL,
  activeModel: process.env.HEPHAESTUS_OLLAMA_MODEL,
});
const modelProviders = new ModelProviderRegistry(resolve(dataDir, 'model-providers.json'), {
  defaults: environmentModelProviders(process.env),
});
const chatService = new KernelChatService(modelProviders);
const chatConversations = new ChatConversationStore(resolve(dataDir, 'chat-conversations.json'));
const dashboardOrigins = dashboardOriginsFrom(process.env.HEPHAESTUS_DASHBOARD_ORIGINS);

function environmentModelProviders(env) {
  const providers = [];
  const ollamaModel = env.HEPHAESTUS_OLLAMA_MODEL?.trim();
  if (ollamaModel) providers.push({
    id: 'ollama-local',
    type: 'ollama',
    label: 'Ollama local',
    baseUrl: env.HEPHAESTUS_OLLAMA_URL ?? 'http://127.0.0.1:11434',
    models: [ollamaModel],
    managedBy: 'environment',
  });
  const openAiKey = env.OPENAI_API_KEY?.trim();
  const openAiModel = env.HEPHAESTUS_OPENAI_MODEL?.trim();
  if (openAiKey && openAiModel) providers.push({
    id: 'openai',
    type: 'openai-compatible',
    label: 'OpenAI',
    baseUrl: env.HEPHAESTUS_OPENAI_BASE_URL ?? 'https://api.openai.com',
    models: [openAiModel],
    apiKey: openAiKey,
    managedBy: 'environment',
  });
  return providers;
}

export function createLocalKernelServer(captureInbox, captureProjector, obsidianProjector, evidenceSummarizer, options = {}) {
  const requiredToken = options.apiToken === undefined ? undefined : validateApiToken(options.apiToken);
  const activePairing = options.pairingSession;
  const identities = options.extensionRegistry;
  const hermesRoute = options.hermesRoute;
  const replayLabQuery = options.replayLabQuery;
  const hermesImportService = options.hermesImportService;
  const opportunities = options.opportunityProjector;
  const goals = options.goalManager;
  const agentMissions = options.agentMissionManager;
  const goalSurfaces = options.goalSurfaceReader;
  const preferences = options.preferenceLearner;
  const missionExecutor = options.agentMissionExecutor;
  const models = options.modelForge;
  const providers = options.modelProviderRegistry;
  const chat = options.chatService;
  const conversations = options.chatConversationStore;
  const bootstrapStatus = options.bootstrapStatus;
  const allowedDashboardOrigins = new Set(options.allowedDashboardOrigins ?? []);
  const hermesMaxBodyBytes = Number(options.hermesMaxBodyBytes ?? 256 * 1024);
  return createServer(async (request, response) => {
    if (!isLoopbackHost(request.headers.host)) {
      return send(response, 403, { ok: false, code: 'HOST_FORBIDDEN' });
    }
    const origin = request.headers.origin;
    if (typeof origin === 'string' && !isAllowedOrigin(origin, allowedDashboardOrigins)) {
      return send(response, 403, { ok: false, code: 'ORIGIN_FORBIDDEN' });
    }
    setCors(origin, response, allowedDashboardOrigins);
    if (request.method === 'OPTIONS') return send(response, 204);
    if (request.method === 'GET' && request.url === '/health') {
      return send(response, 200, { ok: true, service: 'hephaestus-local-kernel', hermes: Boolean(hermesRoute), replayLab: Boolean(replayLabQuery) });
    }
    if (request.method === 'GET' && request.url === '/status') {
      return send(response, 200, {
        ok: true,
        service: 'hephaestus-local-kernel',
        kernel: 'ready',
        hermes: hermesRoute ? 'ready' : 'disabled',
        replayLab: replayLabQuery ? 'ready' : 'disabled',
        ollama: evidenceSummarizer?.isConfigured?.() === true ? 'configured' : 'not_configured',
        obsidian: obsidianProjector ? 'configured' : 'not_configured',
      });
    }
    if (request.method === 'GET' && request.url === '/bootstrap/status') {
      try {
        const body = bootstrapStatus
          ? await bootstrapStatus()
          : await inspectEfestoBootstrap({
            ...(options.bootstrapProbeOptions ?? {}),
            env: options.bootstrapProbeOptions?.env ?? process.env,
            cwd: options.bootstrapProbeOptions?.cwd ?? process.cwd(),
          });
        return send(response, 200, body);
      } catch {
        return send(response, 500, { ok: false, code: 'BOOTSTRAP_STATUS_FAILED' });
      }
    }
    if (request.method === 'GET' && request.url === '/replay-lab') {
      return sendHtml(response, 200, replayLabPageHtml);
    }
    if (request.url === '/hermes/ingestions') {
      if (!hermesRoute) return send(response, 404, { ok: false, code: 'HERMES_INGESTION_DISABLED' });
      try {
        const rawBody = request.method === 'POST' && String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')
          ? await readRaw(request, hermesMaxBodyBytes)
          : '';
        const routed = await hermesRoute.handle({
          method: request.method ?? 'GET',
          url: request.url,
          headers: request.headers,
          remoteAddress: request.socket.remoteAddress ?? '',
          rawBody,
        });
        return send(response, routed.status, routed.body);
      } catch (error) {
        if (error instanceof InboxError) return send(response, error.status, { ok: false, code: error.code, error: error.message });
        return send(response, 500, { ok: false, code: 'HERMES_INGESTION_FAILED' });
      }
    }
    if (request.method === 'POST' && request.url === '/pair') {
      if (!isExtensionOrigin(origin)) return send(response, 403, { ok: false, code: 'PAIRING_ORIGIN_REQUIRED' });
      if (!activePairing) return send(response, 404, { ok: false, code: 'PAIRING_UNAVAILABLE' });
      if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
        return send(response, 415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
      }
      try {
        const body = await readJson(request);
        const paired = activePairing.consume(body?.code);
        if (identities) await identities.authorize(origin);
        return send(response, 200, { ok: true, ...paired });
      } catch (error) {
        if (error instanceof PairingError) return send(response, error.status, { ok: false, code: error.code });
        if (error instanceof InboxError) return send(response, error.status, { ok: false, code: error.code });
        return send(response, 500, { ok: false, code: 'INTERNAL_ERROR' });
      }
    }
    if (request.url?.startsWith('/api/') && !hasValidToken(request.headers['x-hephaestus-token'], requiredToken)) {
      return send(response, 401, { ok: false, code: 'AUTH_REQUIRED' });
    }
    if (request.url?.startsWith('/api/') && isExtensionOrigin(origin) && identities) {
      try {
        if (!(await identities.allows(origin))) return send(response, 403, { ok: false, code: 'EXTENSION_NOT_AUTHORIZED' });
      } catch {
        return send(response, 500, { ok: false, code: 'IDENTITY_REGISTRY_UNAVAILABLE' });
      }
    }
    if (request.method === 'GET' && request.url === '/api/cases' && captureProjector) {
      try {
        return send(response, 200, { ok: true, cases: await captureProjector.listCases() });
      } catch {
        return send(response, 500, { ok: false, code: 'INTERNAL_ERROR' });
      }
    }
    if (request.method === 'GET' && request.url?.startsWith('/api/browser/case/') && captureProjector) {
      const caseId = decodeURIComponent(request.url.slice('/api/browser/case/'.length));
      try {
        const result = await captureProjector.getCaseById(caseId);
        return send(response, 200, { ok: true, ...result });
      } catch (error) {
        if (error instanceof InboxError) return send(response, error.status ?? 400, { ok: false, code: error.code, error: error.message });
        return send(response, 500, { ok: false, code: 'INTERNAL_ERROR' });
      }
    }
    if (request.method === 'GET' && request.url === '/api/model-forge') {
      if (!models) return send(response, 404, { ok: false, code: 'MODEL_FORGE_UNAVAILABLE' });
      try { return send(response, 200, { ok: true, forge: await models.inspect() }); }
      catch { return send(response, 500, { ok: false, code: 'MODEL_FORGE_INSPECTION_FAILED' }); }
    }
    if (request.method === 'GET' && request.url === '/api/chat/providers') {
      if (!providers) return send(response, 404, { ok: false, code: 'MODEL_PROVIDERS_UNAVAILABLE' });
      try { return send(response, 200, { ok: true, providers: await providers.list() }); }
      catch { return send(response, 500, { ok: false, code: 'MODEL_PROVIDERS_FAILED' }); }
    }
    if (request.method === 'POST' && request.url === '/api/chat/providers') {
      if (!providers) return send(response, 404, { ok: false, code: 'MODEL_PROVIDERS_UNAVAILABLE' });
      if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) return send(response, 415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
      try { return send(response, 201, { ok: true, provider: await providers.save(await readJson(request)) }); }
      catch (error) {
        if (error instanceof ModelProviderError) return send(response, error.status, { ok: false, code: error.code, error: error.message });
        return send(response, 500, { ok: false, code: 'MODEL_PROVIDER_SAVE_FAILED' });
      }
    }
    if (request.method === 'DELETE' && request.url?.startsWith('/api/chat/providers/')) {
      if (!providers) return send(response, 404, { ok: false, code: 'MODEL_PROVIDERS_UNAVAILABLE' });
      try {
        const providerId = decodeURIComponent(request.url.slice('/api/chat/providers/'.length));
        await providers.remove(providerId);
        return send(response, 200, { ok: true });
      } catch (error) {
        if (error instanceof ModelProviderError) return send(response, error.status, { ok: false, code: error.code, error: error.message });
        return send(response, 500, { ok: false, code: 'MODEL_PROVIDER_DELETE_FAILED' });
      }
    }
    if (request.method === 'POST' && request.url === '/api/chat/completions') {
      if (!chat) return send(response, 404, { ok: false, code: 'CHAT_UNAVAILABLE' });
      if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) return send(response, 415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
      try { return send(response, 200, { ok: true, response: await chat.complete(await readJson(request, hermesMaxBodyBytes)) }); }
      catch (error) {
        if (error instanceof ChatServiceError || error instanceof ModelProviderError) return send(response, error.status, { ok: false, code: error.code, error: error.message });
        return send(response, 500, { ok: false, code: 'CHAT_FAILED' });
      }
    }
    if (request.method === 'GET' && request.url === '/api/chat/conversations') {
      if (!conversations) return send(response, 404, { ok: false, code: 'CHAT_HISTORY_UNAVAILABLE' });
      try { return send(response, 200, { ok: true, conversations: await conversations.list() }); }
      catch { return send(response, 500, { ok: false, code: 'CHAT_HISTORY_FAILED' }); }
    }
    if (request.method === 'POST' && request.url === '/api/chat/conversations') {
      if (!conversations) return send(response, 404, { ok: false, code: 'CHAT_HISTORY_UNAVAILABLE' });
      if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) return send(response, 415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
      try { return send(response, 201, { ok: true, conversation: await conversations.create(await readJson(request)) }); }
      catch (error) {
        if (error instanceof ChatConversationError) return send(response, error.status, { ok: false, code: error.code, error: error.message });
        return send(response, 500, { ok: false, code: 'CHAT_HISTORY_FAILED' });
      }
    }
    if (request.method === 'POST' && request.url === '/api/chat/stream') {
      if (!chat || !conversations) return send(response, 404, { ok: false, code: 'CHAT_UNAVAILABLE' });
      if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) return send(response, 415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
      let input;
      try { input = await readJson(request, hermesMaxBodyBytes); }
      catch { return send(response, 400, { ok: false, code: 'INVALID_JSON' }); }
      const abort = new AbortController();
      response.once('close', () => {
        if (!response.writableEnded) abort.abort();
      });
      try {
        const lastUserMessage = [...(Array.isArray(input?.messages) ? input.messages : [])]
          .reverse()
          .find((item) => item?.role === 'user')?.content;
        let conversation = input?.conversationId
          ? await conversations.get(input.conversationId)
          : undefined;
        response.writeHead(200, {
          'content-type': 'application/x-ndjson; charset=utf-8',
          'cache-control': 'no-store, no-transform',
          connection: 'keep-alive',
          'x-content-type-options': 'nosniff',
        });
        if (conversation) await writeStreamEvent(response, { type: 'conversation', conversationId: conversation.id });
        const completion = await chat.stream(input, {
          signal: abort.signal,
          onDelta: async (delta) => {
            if (!conversation) {
              conversation = await conversations.create({ providerId: input?.providerId, model: input?.model, title: lastUserMessage });
              await writeStreamEvent(response, { type: 'conversation', conversationId: conversation.id });
            }
            await writeStreamEvent(response, { type: 'delta', delta });
          },
        });
        if (!conversation) throw new ChatServiceError('CHAT_INVALID_RESPONSE', 'The model returned an invalid response.', 502);
        await conversations.appendExchange(conversation.id, {
          providerId: completion.providerId,
          model: completion.model,
          user: lastUserMessage,
          assistant: completion.content,
        });
        await writeStreamEvent(response, { type: 'done', response: completion, conversationId: conversation.id });
        return response.end();
      } catch (error) {
        const known = error instanceof ChatServiceError || error instanceof ModelProviderError || error instanceof ChatConversationError;
        const status = known ? error.status : 500;
        const payload = { type: 'error', code: known ? error.code : 'CHAT_FAILED', error: known ? error.message : 'Chat failed.' };
        if (!response.headersSent) return send(response, status === 499 ? 400 : status, { ok: false, ...payload });
        if (!response.writableEnded && !response.destroyed) {
          await writeStreamEvent(response, payload);
          response.end();
        }
        return undefined;
      }
    }
    if ((request.method === 'GET' || request.method === 'DELETE') && request.url?.startsWith('/api/chat/conversations/')) {
      if (!conversations) return send(response, 404, { ok: false, code: 'CHAT_HISTORY_UNAVAILABLE' });
      const conversationId = decodeURIComponent(request.url.slice('/api/chat/conversations/'.length));
      try {
        if (request.method === 'DELETE') {
          await conversations.remove(conversationId);
          return send(response, 200, { ok: true });
        }
        return send(response, 200, { ok: true, conversation: await conversations.get(conversationId) });
      } catch (error) {
        if (error instanceof ChatConversationError) return send(response, error.status, { ok: false, code: error.code, error: error.message });
        return send(response, 500, { ok: false, code: 'CHAT_HISTORY_FAILED' });
      }
    }
    if (request.method === 'GET' && request.url === '/api/opportunities') {
      if (!opportunities) return send(response, 404, { ok: false, code: 'OPPORTUNITY_INBOX_UNAVAILABLE' });
      try {
        return send(response, 200, { ok: true, opportunities: await opportunities.list() });
      } catch {
        return send(response, 500, { ok: false, code: 'OPPORTUNITY_INBOX_FAILED' });
      }
    }
    if (request.method === 'POST' && request.url?.startsWith('/api/opportunities/') && request.url.endsWith('/feedback')) {
      if (!preferences) return send(response, 404, { ok: false, code: 'PREFERENCE_LEARNING_UNAVAILABLE' });
      if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) return send(response, 415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
      try {
        const opportunityId = decodeURIComponent(request.url.slice('/api/opportunities/'.length, -'/feedback'.length));
        return send(response, 201, { ok: true, feedback: await preferences.record(opportunityId, await readJson(request)) });
      } catch (error) {
        if (error instanceof InboxError) return send(response, error.status, { ok: false, code: error.code, error: error.message });
        return send(response, 500, { ok: false, code: 'PREFERENCE_FEEDBACK_FAILED' });
      }
    }
    if (request.method === 'GET' && request.url === '/api/preferences') {
      if (!preferences) return send(response, 404, { ok: false, code: 'PREFERENCE_LEARNING_UNAVAILABLE' });
      try { return send(response, 200, { ok: true, profile: await preferences.profile() }); }
      catch { return send(response, 500, { ok: false, code: 'PREFERENCE_PROFILE_FAILED' }); }
    }
    if (request.method === 'DELETE' && request.url === '/api/preferences') {
      if (!preferences) return send(response, 404, { ok: false, code: 'PREFERENCE_LEARNING_UNAVAILABLE' });
      try { return send(response, 200, { ok: true, ...(await preferences.reset()) }); }
      catch { return send(response, 500, { ok: false, code: 'PREFERENCE_RESET_FAILED' }); }
    }
    if (request.method === 'GET' && request.url === '/api/goal-surfaces') {
      if (!goalSurfaces) return send(response, 404, { ok: false, code: 'GOAL_SURFACES_UNAVAILABLE' });
      try { return send(response, 200, { ok: true, surfaces: await goalSurfaces.list() }); }
      catch { return send(response, 500, { ok: false, code: 'GOAL_SURFACES_FAILED' }); }
    }
    if (request.method === 'GET' && request.url?.startsWith('/api/goal-surfaces/')) {
      if (!goalSurfaces) return send(response, 404, { ok: false, code: 'GOAL_SURFACES_UNAVAILABLE' });
      try {
        const goalId = decodeURIComponent(request.url.slice('/api/goal-surfaces/'.length));
        const surface = await goalSurfaces.get(goalId);
        return surface
          ? send(response, 200, { ok: true, surface })
          : send(response, 404, { ok: false, code: 'GOAL_SURFACE_NOT_FOUND' });
      } catch (error) {
        if (error instanceof GoalSurfaceReaderError) {
          return send(response, 400, { ok: false, code: error.code, error: error.message });
        }
        return send(response, 500, { ok: false, code: 'GOAL_SURFACE_FAILED' });
      }
    }
    if (request.url === '/api/goals' && request.method === 'GET') {
      if (!goals) return send(response, 404, { ok: false, code: 'GOALS_UNAVAILABLE' });
      try { return send(response, 200, { ok: true, goals: await goals.list() }); }
      catch { return send(response, 500, { ok: false, code: 'GOALS_FAILED' }); }
    }
    if (request.url === '/api/goals' && request.method === 'POST') {
      if (!goals) return send(response, 404, { ok: false, code: 'GOALS_UNAVAILABLE' });
      if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) return send(response, 415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
      try {
        const goal = await goals.create(await readJson(request));
        const obsidianNotes = obsidianProjector?.syncGoals ? await obsidianProjector.syncGoals() : undefined;
        return send(response, 201, { ok: true, goal, obsidianNotes });
      }
      catch (error) {
        if (error instanceof InboxError) return send(response, error.status, { ok: false, code: error.code, error: error.message });
        return send(response, 500, { ok: false, code: 'GOAL_CREATE_FAILED' });
      }
    }
    if (request.url === '/api/agent-missions' && request.method === 'GET') {
      if (!agentMissions) return send(response, 404, { ok: false, code: 'AGENT_MISSIONS_UNAVAILABLE' });
      try { return send(response, 200, { ok: true, missions: await agentMissions.list() }); }
      catch { return send(response, 500, { ok: false, code: 'AGENT_MISSIONS_FAILED' }); }
    }
    if (request.method === 'POST' && request.url?.startsWith('/api/goals/') && request.url.endsWith('/missions')) {
      if (!agentMissions) return send(response, 404, { ok: false, code: 'AGENT_MISSIONS_UNAVAILABLE' });
      if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) return send(response, 415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
      try {
        const goalId = decodeURIComponent(request.url.slice('/api/goals/'.length, -'/missions'.length));
        const input = await readJson(request);
        const confirmationActor = interactiveMissionConfirmationActor(origin, allowedDashboardOrigins);
        return send(response, 201, { ok: true, mission: await agentMissions.create(goalId, input, { confirmationActor }) });
      } catch (error) {
        if (error instanceof InboxError) return send(response, error.status, { ok: false, code: error.code, error: error.message });
        return send(response, 500, { ok: false, code: 'AGENT_MISSION_CREATE_FAILED' });
      }
    }
    if (request.method === 'POST' && request.url === '/api/agent-missions/claim') {
      if (!missionExecutor) return send(response, 404, { ok: false, code: 'AGENT_EXECUTOR_UNAVAILABLE' });
      try {
        const contentType = String(request.headers['content-type'] ?? '').toLowerCase();
        const body = contentType.startsWith('application/json') ? await readJson(request) : undefined;
        const requestedId = body?.missionId;
        if (requestedId !== undefined && (typeof requestedId !== 'string' || !requestedId || requestedId.length > 200)) {
          return send(response, 400, { ok: false, code: 'INVALID_MISSION_ID' });
        }
        const mission = await missionExecutor.claim('hermes', requestedId);
        return send(response, mission ? 200 : 204, mission ? { ok: true, mission } : undefined);
      } catch { return send(response, 500, { ok: false, code: 'AGENT_MISSION_CLAIM_FAILED' }); }
    }
    if (request.method === 'POST' && request.url?.startsWith('/api/agent-missions/') && request.url.endsWith('/results')) {
      if (!missionExecutor) return send(response, 404, { ok: false, code: 'AGENT_EXECUTOR_UNAVAILABLE' });
      if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) return send(response, 415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
      try {
        const missionId = decodeURIComponent(request.url.slice('/api/agent-missions/'.length, -'/results'.length));
        const completed = await missionExecutor.complete(missionId, await readJson(request));
        const obsidianReceipt = await syncMissionObsidian(completed, obsidianProjector);
        const mission = await attachMissionObsidianReceipt(missionExecutor.store, missionId, obsidianReceipt);
        return send(response, 202, { ok: true, ...completed, mission, obsidianReceipt });
      } catch (error) {
        if (error instanceof InboxError) return send(response, error.status, { ok: false, code: error.code, error: error.message });
        return send(response, 500, { ok: false, code: 'AGENT_RESULT_INGESTION_FAILED' });
      }
    }
    if (request.method === 'POST' && request.url?.startsWith('/api/agent-missions/') && request.url.endsWith('/failures')) {
      if (!missionExecutor) return send(response, 404, { ok: false, code: 'AGENT_EXECUTOR_UNAVAILABLE' });
      if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) return send(response, 415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
      try {
        const missionId = decodeURIComponent(request.url.slice('/api/agent-missions/'.length, -'/failures'.length));
        return send(response, 202, { ok: true, mission: await missionExecutor.fail(missionId, await readJson(request)) });
      } catch (error) {
        if (error instanceof InboxError) return send(response, error.status, { ok: false, code: error.code, error: error.message });
        return send(response, 500, { ok: false, code: 'AGENT_FAILURE_REPORT_FAILED' });
      }
    }
    if (request.method === 'GET' && request.url === '/api/replay-lab/cases') {
      if (!replayLabQuery) return send(response, 404, { ok: false, code: 'REPLAY_LAB_UNAVAILABLE' });
      try {
        return send(response, 200, { ok: true, cases: await replayLabQuery.listCases() });
      } catch {
        return send(response, 500, { ok: false, code: 'REPLAY_LAB_QUERY_FAILED' });
      }
    }
    if (request.method === 'GET' && request.url?.startsWith('/api/replay-lab/cases/')) {
      if (!replayLabQuery) return send(response, 404, { ok: false, code: 'REPLAY_LAB_UNAVAILABLE' });
      try {
        const caseId = decodeURIComponent(request.url.slice('/api/replay-lab/cases/'.length));
        return send(response, 200, { ok: true, case: await replayLabQuery.getCase(caseId) });
      } catch {
        return send(response, 404, { ok: false, code: 'REPLAY_LAB_CASE_NOT_FOUND' });
      }
    }
    if (request.method === 'POST' && ['/api/replay-lab/imports/validate', '/api/replay-lab/imports'].includes(request.url)) {
      if (!hermesImportService) return send(response, 404, { ok: false, code: 'HERMES_IMPORT_UNAVAILABLE' });
      if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
        return send(response, 415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
      }
      try {
        const body = await readJson(request, hermesMaxBodyBytes);
        if (request.url.endsWith('/validate')) {
          const validated = hermesImportService.validate(body);
          return send(response, 200, { ok: true, runId: validated.runOutput.runId, idempotencyKey: validated.idempotencyKey, eventCount: validated.events.length });
        }
        return send(response, 202, { ok: true, ...(await hermesImportService.ingest(body)) });
      } catch (error) {
        if (error instanceof HermesImportError) return send(response, error.status, { ok: false, code: error.code, error: error.message, details: error.details });
        if (error instanceof InboxError) return send(response, error.status, { ok: false, code: error.code });
        return send(response, 500, { ok: false, code: 'HERMES_IMPORT_FAILED' });
      }
    }
    if (request.method !== 'POST' || request.url !== '/api/browser/page-context') {
      return send(response, 404, { ok: false, code: 'NOT_FOUND' });
    }
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      return send(response, 415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
    }

    try {
      const body = await readJson(request);
      const receipt = await captureInbox.accept(body);
      const projection = captureProjector
        ? await captureProjector.project(receipt.receiptId, body)
        : undefined;
      const intelligence = projection && evidenceSummarizer
        ? await evidenceSummarizer.summarize(projection.evidenceId)
        : undefined;
      const opportunity = projection && opportunities
        ? await opportunities.project(body, projection)
        : undefined;
      const obsidianNotes = projection && obsidianProjector
        ? await obsidianProjector.syncCase(projection.caseId)
        : undefined;
      return send(response, 202, { ok: true, ...receipt, ...projection, intelligence, opportunity, obsidianNotes });
    } catch (error) {
      const known = error instanceof InboxError;
      return send(response, known ? error.status : 500, {
        ok: false,
        code: known ? error.code : 'INTERNAL_ERROR',
        error: known ? error.message : 'Unable to store page context',
      });
    }
  });
}

export const server = createLocalKernelServer(inbox, projector, obsidian, summarizer, {
  apiToken,
  pairingSession,
  extensionRegistry,
  hermesRoute: hermes?.route,
  replayLabQuery: hermes?.replayLabQuery,
  hermesImportService: hermes?.importService,
  opportunityProjector,
  goalManager,
  agentMissionManager,
  goalSurfaceReader,
  preferenceLearner,
  agentMissionExecutor,
  modelForge,
  modelProviderRegistry: modelProviders,
  chatService,
  chatConversationStore: chatConversations,
  allowedDashboardOrigins: dashboardOrigins,
});

if (isMain) {
  if (!isLoopbackHostname(host)) throw new Error('HEPHAESTUS_HOST must be a loopback address');
  server.listen(port, host, () => {
    console.log(`Hephaestus local Kernel listening on http://${host}:${port}`);
    if (tokenRecord.source === 'created') console.log(`Extension token created privately at ${tokenRecord.filePath}`);
    else if (tokenRecord.source === 'rotated') console.log(`Extension token rotated privately at ${tokenRecord.filePath}`);
    else if (tokenRecord.source === 'file') console.log(`Using persistent extension token from ${tokenRecord.filePath}`);
    if (hermes?.route) {
      console.log('Hermes local ingestion enabled at /hermes/ingestions');
      console.log('Replay Lab API enabled at /api/replay-lab/cases');
      console.log('Replay Lab UI available at /replay-lab');
      console.log(`Hermes startup reconciliation: ${JSON.stringify(hermes.reconciled)}`);
    }
    if (pairingSession) {
      const pairing = pairingSession.details();
      console.log(`Extension pairing code: ${pairing.code} (expires ${pairing.expiresAt}, one use, five attempts)`);
    }
  });
}

async function readJson(request, maxBodyBytes = MAX_BODY_BYTES) {
  const raw = await readRaw(request, maxBodyBytes);
  try { return JSON.parse(raw); }
  catch { throw new InboxError('INVALID_JSON', 'Request body must be valid JSON'); }
}

async function readRaw(request, maxBodyBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new InboxError('PAYLOAD_TOO_LARGE', `Payload exceeds ${maxBodyBytes} bytes`, 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function isAllowedOrigin(origin, allowedDashboardOrigins = new Set()) {
  return isExtensionOrigin(origin)
    || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    || allowedDashboardOrigins.has(origin);
}

function isExtensionOrigin(origin) {
  return typeof origin === 'string' && /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
}

function isLoopbackHost(value) {
  if (typeof value !== 'string') return false;
  try { return isLoopbackHostname(new URL(`http://${value}`).hostname); }
  catch { return false; }
}

function isLoopbackHostname(value) {
  return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(String(value).toLowerCase());
}

function hasValidToken(value, requiredToken) {
  if (!requiredToken || typeof value !== 'string') return false;
  const supplied = Buffer.from(value);
  const expected = Buffer.from(requiredToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function setCors(origin, response, allowedDashboardOrigins = new Set()) {
  if (typeof origin === 'string' && isAllowedOrigin(origin, allowedDashboardOrigins)) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'Origin');
  }
  response.setHeader('access-control-allow-methods', 'POST, GET, DELETE, OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type, x-hephaestus-token, x-ibos-idempotency-key, x-ibos-timestamp, x-ibos-signature');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('cache-control', 'no-store');
}

function dashboardOriginsFrom(value) {
  const configured = String(value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured.length
    ? configured
    : ['https://internet-brain-os.leerenmos.chatgpt.site'];
}

function send(response, status, body) {
  response.statusCode = status;
  if (body === undefined) return response.end();
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

async function writeStreamEvent(response, event) {
  if (response.destroyed || response.writableEnded) return;
  if (response.write(`${JSON.stringify(event)}\n`)) return;
  await new Promise((resolve) => response.once('drain', resolve));
}

function sendHtml(response, status, html) {
  response.statusCode = status;
  response.setHeader('content-type', 'text/html; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(html);
}

async function syncMissionObsidian(completed, obsidianProjector) {
  if (!obsidianProjector) return { status: 'not_configured', notesWritten: 0, vaultRelativePath: null, lastSyncedAt: null };
  const paths = new Set();
  const syncedAt = new Date().toISOString();
  try {
    for (const finding of completed.findings) {
      if (!finding.caseId) continue;
      const notes = await obsidianProjector.syncCase(finding.caseId);
      for (const value of Object.values(notes)) {
        if (Array.isArray(value)) value.forEach((item) => paths.add(item));
        else if (typeof value === 'string') paths.add(value);
      }
    }
    return { status: 'synced', notesWritten: paths.size, vaultRelativePath: obsidianProjector.vaultPath, lastSyncedAt: syncedAt };
  } catch {
    return { status: paths.size ? 'partial' : 'failed', notesWritten: paths.size, vaultRelativePath: obsidianProjector.vaultPath, lastSyncedAt: syncedAt };
  }
}

async function attachMissionObsidianReceipt(store, missionId, obsidianReceipt) {
  return store.project(async (data) => {
    const missions = data.agentMissions ?? [];
    const index = missions.findIndex((item) => item.id === missionId);
    if (index < 0) return { changed: false, data, result: undefined };
    const current = missions[index];
    const updatedMission = {
      ...current,
      obsidianReceipt,
      resultSummary: { ...(current.resultSummary ?? {}), obsidianNotesWritten: obsidianReceipt.notesWritten },
    };
    const updated = [...missions];
    updated[index] = updatedMission;
    return { changed: true, data: { ...data, agentMissions: updated }, result: updatedMission };
  });
}
