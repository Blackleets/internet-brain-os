'use client';

import Image from 'next/image';
import {
  Bot, BrainCircuit, ChevronRight, Home, Menu, Plug, RefreshCw, Settings,
  ShieldCheck, Sparkles, SquarePen, Target, Workflow, X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { KernelClient, KernelClientError } from '../lib/kernel/client';
import type { CaseSummary, GoalIntelligencePlan, IntegrationAction, IntegrationCatalog } from '../lib/kernel/contracts';
import { loadGoalSurfaces, type GoalSurface, type GoalSurfaceWorkState } from '../lib/kernel/goal-surfaces';
import { loadGoalIntelligencePlan } from '../lib/kernel/goal-intelligence';
import { loadIntegrationCatalog } from '../lib/kernel/integrations';
import { loadOverview, type OverviewSnapshot } from '../lib/kernel/overview';
import { normalizeKernelBaseUrl } from '../lib/kernel/url';
import { connectionStore } from '../lib/session/connection-store';
import { EfestoLocaleProvider, useEfestoLocale } from '../lib/efesto-i18n';
import { loadWebGoalIntelligencePlan } from '../lib/web-runtime/client';
import { detectEfestoRuntimeMode, type EfestoRuntimeMode } from '../lib/web-runtime/runtime';
import {
  AgentsView, AutomationsView, EvidenceView, FindsView, HomeView, IntegrationsView, MissionsView, ModelsView, SettingsView,
  type BrainPhase, type CaseDetail, type ChatMessage, type EvidenceRecord, type Provider,
} from './efesto-product-views';
import { ProductValueScorecardPanel } from './overview/product-value-scorecard';

type View = 'home' | 'missions' | 'finds' | 'evidence' | 'models' | 'agents' | 'integrations' | 'automations' | 'settings';
type Connection = { baseUrl: string; token: string };
type StreamEvent = { type?: 'conversation' | 'delta' | 'done' | 'error'; delta?: string; error?: string; response?: { model?: string } };

const SESSION_CONNECTION_KEY = 'hephaestus.owner.connection.session.v1';
const DEFAULT_BASE_URL = 'http://127.0.0.1:4000';
type GitHubReadOperation = 'repository' | 'issues' | 'pull_requests' | 'checks';
const GITHUB_CAPABILITY_BY_OPERATION: Record<GitHubReadOperation, string> = {
  repository: 'github.repository.read',
  issues: 'github.issue.read',
  pull_requests: 'github.pull_request.read',
  checks: 'github.checks.read',
};
type NavItem = { id: View; labelKey: string; icon: typeof Home };
const workspaceNav: NavItem[] = [
  { id: 'home', labelKey: 'nav.home', icon: Home },
  { id: 'missions', labelKey: 'nav.missions', icon: Target },
  { id: 'finds', labelKey: 'nav.finds', icon: Sparkles },
  { id: 'evidence', labelKey: 'nav.evidence', icon: ShieldCheck },
];
const systemNav: NavItem[] = [
  { id: 'models', labelKey: 'nav.models', icon: BrainCircuit },
  { id: 'agents', labelKey: 'nav.agents', icon: Bot },
  { id: 'integrations', labelKey: 'nav.integrations', icon: Plug },
  { id: 'automations', labelKey: 'nav.automations', icon: Workflow },
];
const settingsNav: NavItem = { id: 'settings', labelKey: 'nav.settings', icon: Settings };
const navGroups = [
  { labelKey: 'nav.intelligence', items: workspaceNav },
  { labelKey: 'nav.system', items: systemNav },
];
const nav = [...workspaceNav, ...systemNav, settingsNav];

export default function EfestoProductShell() {
  return <EfestoLocaleProvider><EfestoProductShellContent /></EfestoLocaleProvider>;
}

function EfestoProductShellContent() {
  const { t } = useEfestoLocale();
  const [view, setView] = useState<View>('home');
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [runtimeMode, setRuntimeMode] = useState<EfestoRuntimeMode>('local');
  const [connection, setConnection] = useState<Connection>();
  const [snapshot, setSnapshot] = useState<OverviewSnapshot>();
  const [goalSurfaces, setGoalSurfaces] = useState<GoalSurface[]>([]);
  const [integrationCatalog, setIntegrationCatalog] = useState<IntegrationCatalog>();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [input, setInput] = useState('');
  const [preparedGoal, setPreparedGoal] = useState('');
  const [goalPlan, setGoalPlan] = useState<GoalIntelligencePlan>();
  const [goalPlanPending, setGoalPlanPending] = useState(false);
  const [goalPending, setGoalPending] = useState(false);
  const [chatMode, setChatMode] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatPending, setChatPending] = useState(false);
  const [caseDetails, setCaseDetails] = useState<Record<string, CaseDetail>>({});
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [loadingCaseId, setLoadingCaseId] = useState('');
  const [toast, setToast] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [githubBusy, setGithubBusy] = useState(false);
  const [githubAuthorizationBusy, setGithubAuthorizationBusy] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);
  const chatAbortRef = useRef<AbortController | undefined>(undefined);
  const webMode = runtimeMode === 'web';

  const selectedProvider = providers.find((item) => item.id === selectedProviderId);
  const focusedGoalSurface = goalSurfaces[0];
  const brainPhase = useMemo<BrainPhase>(() => {
    if (webMode && !connection) return 'ready';
    if (!connection || snapshot?.readiness.kernel !== 'online') return 'offline';
    if (chatPending) return 'thinking';
    return brainPhaseFromWorkState(focusedGoalSurface?.mission?.workState);
  }, [chatPending, connection, focusedGoalSurface?.mission?.workState, snapshot?.readiness.kernel, webMode]);

  useEffect(() => {
    const nextMode = detectEfestoRuntimeMode();
    setRuntimeMode(nextMode);
    if (nextMode === 'web') setChatMode(false);
  }, []);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(SESSION_CONNECTION_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<Connection>;
      if (typeof parsed.baseUrl !== 'string' || typeof parsed.token !== 'string') return;
      setRememberSession(true);
      void connectWith({ baseUrl: parsed.baseUrl, token: parsed.token }, true);
    } catch {
      window.sessionStorage.removeItem(SESSION_CONNECTION_KEY);
    }
  // connectWith is intentionally a one-time session restoration boundary.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const current = providers.find((item) => item.id === selectedProviderId);
    if (!current) {
      const first = providers[0];
      setSelectedProviderId(first?.id ?? '');
      setSelectedModel(first?.models[0] ?? '');
      return;
    }
    if (!current.models.includes(selectedModel)) setSelectedModel(current.models[0] ?? '');
  }, [providers, selectedModel, selectedProviderId]);

  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const client = new KernelClient(connection);
        const [nextSnapshot, nextGoalSurfaces, nextIntegrationCatalog] = await Promise.all([
          loadOverview(client),
          loadGoalSurfaces(client),
          loadOptionalIntegrationCatalog(client),
        ]);
        if (cancelled) return;
        setSnapshot(nextSnapshot);
        setGoalSurfaces(nextGoalSurfaces);
        setIntegrationCatalog(nextIntegrationCatalog);
      } catch {
        // The visible readiness state remains the last verified state until the next successful poll.
      }
    };
    const timer = window.setInterval(() => { void poll(); }, 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [connection]);

  function navigate(next: View) { setView(next); setNavOpen(false); }
  function toggleNavigation() {
    if (window.matchMedia('(max-width: 720px)').matches) {
      setNavOpen(true);
      return;
    }
    setSidebarCollapsed((currentValue) => !currentValue);
  }
  function newChat() {
    chatAbortRef.current?.abort();
    setChatPending(false);
    setChatMode(true);
    setChatMessages([]);
    setPreparedGoal('');
    setGoalPlan(undefined);
    setGoalPlanPending(false);
    setInput('');
    navigate('home');
  }
  function newGoal() {
    chatAbortRef.current?.abort();
    setChatPending(false);
    setChatMode(false);
    setPreparedGoal('');
    setGoalPlan(undefined);
    setGoalPlanPending(false);
    setInput('');
    navigate('home');
  }

  function navigateIntegration(action: IntegrationAction) {
    if (action === 'settings') return navigate('settings');
    if (action === 'agents') return navigate('agents');
    if (action === 'models') return navigate('models');
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const pairingCode = String(data.get('pairingCode') ?? '').trim();
    const action = String(data.get('action') ?? (pairingCode ? 'pair' : 'token'));
    const baseUrl = String(data.get('baseUrl') ?? DEFAULT_BASE_URL);
    const remember = data.get('rememberSession') === 'on';
    setRememberSession(remember);
    if (action === 'pair') {
      await pairWithCode(baseUrl, String(data.get('pairingCode') ?? ''), remember);
      return;
    }
    const tokenInput = form.elements.namedItem('token');
    const token = String(data.get('token') ?? '').trim();
    if (tokenInput instanceof HTMLInputElement) tokenInput.value = '';
    if (!token) {
      setToast(t('toast.tokenMissing'));
      return;
    }
    await connectWith({ baseUrl, token }, remember);
  }

  async function pairWithCode(baseUrl: string, code: string, remember: boolean) {
    setConnecting(true);
    setToast('');
    try {
      const verifiedBaseUrl = normalizeKernelBaseUrl(baseUrl);
      const response = await fetch(`${verifiedBaseUrl}/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
        cache: 'no-store',
      });
      const payload: unknown = await response.json().catch(() => ({}));
      const body = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : {};
      if (!response.ok || body.ok !== true || typeof body.apiToken !== 'string') {
        throw new KernelClientError('HTTP_ERROR', response.status);
      }
      if (await connectWith({ baseUrl: verifiedBaseUrl, token: body.apiToken }, remember)) {
        setToast(t('toast.pairSuccess'));
      }
    } catch (error) {
      if (error instanceof KernelClientError && error.code === 'HTTP_ERROR') {
        setToast(t('toast.pairRejected'));
      } else {
        setToast(connectionMessage(error, t));
      }
    } finally {
      setConnecting(false);
    }
  }

  async function connectWith(input: Connection, remember: boolean) {
    setConnecting(true);
    setToast('');
    try {
      const verified = { baseUrl: normalizeKernelBaseUrl(input.baseUrl), token: input.token };
      const client = new KernelClient(verified);
      const [nextSnapshot, nextProviders, nextGoalSurfaces, nextIntegrationCatalog] = await Promise.all([
        loadOverview(client),
        client.get('/api/chat/providers', parseProviders),
        loadGoalSurfaces(client),
        loadOptionalIntegrationCatalog(client),
      ]);
      if (nextSnapshot.readiness.kernel !== 'online') throw new KernelClientError('OFFLINE');
      setConnection(verified);
      setSnapshot(nextSnapshot);
      setProviders(nextProviders);
      setGoalSurfaces(nextGoalSurfaces);
      setIntegrationCatalog(nextIntegrationCatalog);
      connectionStore.set(verified);
      if (remember) window.sessionStorage.setItem(SESSION_CONNECTION_KEY, JSON.stringify(verified));
      else window.sessionStorage.removeItem(SESSION_CONNECTION_KEY);
      setToast(t('toast.connectionSuccess'));
      return true;
    } catch (error) {
      setConnection(undefined); setSnapshot(undefined); setProviders([]); setGoalSurfaces([]); setIntegrationCatalog(undefined); connectionStore.clear();
      window.sessionStorage.removeItem(SESSION_CONNECTION_KEY);
      setToast(connectionMessage(error, t));
      return false;
    } finally { setConnecting(false); }
  }

  function disconnect() {
    chatAbortRef.current?.abort();
    setConnection(undefined); setSnapshot(undefined); setProviders([]); setGoalSurfaces([]); setIntegrationCatalog(undefined); setCaseDetails({}); setSelectedCaseId(''); setChatMessages([]);
    setGoalPlan(undefined); setGoalPlanPending(false);
    connectionStore.clear(); window.sessionStorage.removeItem(SESSION_CONNECTION_KEY); setRememberSession(false);
    setToast(t('toast.disconnected'));
  }

  async function refresh() {
    if (!connection) return navigate('settings');
    try {
      const client = new KernelClient(connection);
      const [nextSnapshot, nextProviders, nextGoalSurfaces, nextIntegrationCatalog] = await Promise.all([
        loadOverview(client),
        client.get('/api/chat/providers', parseProviders),
        loadGoalSurfaces(client),
        loadOptionalIntegrationCatalog(client),
      ]);
      setSnapshot(nextSnapshot); setProviders(nextProviders); setGoalSurfaces(nextGoalSurfaces); setIntegrationCatalog(nextIntegrationCatalog); setToast(t('toast.refreshed'));
    } catch (error) { setToast(connectionMessage(error, t)); }
  }

  function updateInput(value: string) {
    setInput(value);
    if (preparedGoal && value.trim() !== preparedGoal) {
      setPreparedGoal('');
      setGoalPlan(undefined);
    }
  }

  async function prepareGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    setPreparedGoal(value);
    setGoalPlan(undefined);
    const canPlan = Boolean(connection) || webMode;
    setGoalPlanPending(canPlan);
    setToast(connection ? t('toast.goalPrepared') : webMode ? t('toast.webGoalPreparing') : t('toast.goalDraft'));
    if (!canPlan) return;
    try {
      if (webMode && !connection) {
        setGoalPlan(await loadWebGoalIntelligencePlan(value, keywordsFromGoal(value)));
      } else if (connection) {
        const client = new KernelClient({ ...connection, timeoutMs: 15_000 });
        setGoalPlan(await loadGoalIntelligencePlan(client, value, keywordsFromGoal(value)));
      }
    } catch {
      setToast(webMode && !connection ? t('toast.webGoalFailed') : t('toast.goalPlanLimited'));
    } finally {
      setGoalPlanPending(false);
    }
  }

  async function confirmGoal() {
    if (!preparedGoal || goalPending) return;
    if (!connection) {
      setToast(webMode ? t('toast.webExecutionRequiresKernel') : t('toast.goalDraft'));
      if (!webMode) navigate('settings');
      return;
    }
    setGoalPending(true);
    try {
      const client = new KernelClient({ ...connection, timeoutMs: 30_000 });
      const goalResponse = await client.request('/api/goals', {
        method: 'POST', body: JSON.stringify({ title: preparedGoal, keywords: keywordsFromGoal(preparedGoal), priority: 2 }),
      }, parseObject);
      const goal = parseObject(goalResponse.goal);
      if (typeof goal.id !== 'string' || !goal.id) throw new Error('Goal id missing');
      await client.request(`/api/goals/${encodeURIComponent(goal.id)}/missions`, {
        method: 'POST', body: JSON.stringify({ confirmed: true, agent: 'hermes', cadence: 'manual' }),
      }, parseOk);
      setInput(''); setPreparedGoal(''); await refresh(); navigate('missions');
      setToast(t('toast.goalPersisted'));
    } catch { setToast(t('toast.goalRejected')); }
    finally { setGoalPending(false); }
  }

  async function configureGithub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connection) return navigate('settings');
    const form = event.currentTarget;
    const tokenInput = form.elements.namedItem('githubToken');
    const token = String(new FormData(form).get('githubToken') ?? '').trim();
    if (tokenInput instanceof HTMLInputElement) tokenInput.value = '';
    if (!token) {
      setToast(t('toast.githubTokenMissing'));
      return;
    }
    setGithubBusy(true);
    try {
      const client = new KernelClient({ ...connection, timeoutMs: 30_000 });
      await client.request('/api/integrations/github/credentials', { method: 'POST', body: JSON.stringify({ token }) }, parseOk);
      await refresh();
      setToast(t('toast.githubConfigured'));
    } catch {
      setToast(t('toast.githubRejected'));
    } finally {
      setGithubBusy(false);
    }
  }

  async function revokeGithub() {
    if (!connection || githubBusy) return;
    setGithubBusy(true);
    try {
      const client = new KernelClient({ ...connection, timeoutMs: 30_000 });
      await client.request('/api/integrations/github/credentials', { method: 'DELETE' }, parseOk);
      await refresh();
      setToast(t('toast.githubRevoked'));
    } catch {
      setToast(t('toast.githubRevokeRejected'));
    } finally {
      setGithubBusy(false);
    }
  }

  async function revokeGithubAuthorization(authorizationId: string) {
    if (!connection || githubAuthorizationBusy) return;
    setGithubAuthorizationBusy(true);
    try {
      const client = new KernelClient({ ...connection, timeoutMs: 30_000 });
      await client.request(`/api/integrations/github/authorizations/${encodeURIComponent(authorizationId)}`, { method: 'DELETE' }, parseOk);
      if (selectedCaseId) {
        const detail = await client.get(`/api/browser/case/${encodeURIComponent(selectedCaseId)}`, parseCaseDetail);
        setCaseDetails((current) => ({ ...current, [selectedCaseId]: detail }));
      }
      await refresh();
      setToast(t('toast.githubAuthorizationRevoked'));
    } catch {
      setToast(t('toast.githubAuthorizationRevokeRejected'));
    } finally {
      setGithubAuthorizationBusy(false);
    }
  }

  async function runGithubEvidence({ owner, repo, operation, ref, consent }: { owner: string; repo: string; operation: GitHubReadOperation; ref?: string; consent: boolean }) {
    if (!connection || !preparedGoal || goalPending) {
      if (!connection) navigate('settings');
      return;
    }
    if (!consent) {
      setToast(t('toast.githubConsentRequired'));
      return;
    }
    setGoalPending(true);
    try {
      const client = new KernelClient({ ...connection, timeoutMs: 60_000 });
      const goalResponse = await client.request('/api/goals', {
        method: 'POST',
        body: JSON.stringify({ title: preparedGoal, keywords: keywordsFromGoal(preparedGoal), priority: 2 }),
      }, parseObject);
      const goal = parseObject(goalResponse.goal);
      if (typeof goal.id !== 'string' || !goal.id) throw new Error('Goal id missing');
      const authorizationResponse = await client.request('/api/integrations/github/authorizations', {
        method: 'POST',
        body: JSON.stringify({ goalId: goal.id, capabilities: [GITHUB_CAPABILITY_BY_OPERATION[operation]], resource: { owner, repo, ...(ref ? { ref } : {}) } }),
      }, parseObject);
      const authorization = parseObject(authorizationResponse.authorization);
      if (typeof authorization.id !== 'string' || !authorization.id) throw new Error('GitHub authorization missing');
      const idempotencyKey = 'github-evidence:' + goal.id + ':' + operation + ':' + owner + '/' + repo + (ref ? ':' + ref : '');
      const evidenceResponse = await client.request('/api/integrations/github/evidence', {
        method: 'POST',
        body: JSON.stringify({ goalId: goal.id, authorizationId: authorization.id, idempotencyKey, operation, owner, repo, ...(ref ? { ref } : {}) }),
      }, parseObject);
      const caseId = typeof evidenceResponse.caseId === 'string' ? evidenceResponse.caseId : '';
      if (!caseId) throw new Error('GitHub Case missing');
      const detail = await client.get('/api/browser/case/' + encodeURIComponent(caseId), parseCaseDetail);
      setCaseDetails((current) => ({ ...current, [caseId]: detail }));
      setSelectedCaseId(caseId);
      setInput('');
      setPreparedGoal('');
      setGoalPlan(undefined);
      await refresh();
      navigate('evidence');
      setToast(t('toast.githubEvidenceReady'));
    } catch {
      setToast(t('toast.githubEvidenceRejected'));
    } finally {
      setGoalPending(false);
    }
  }

  async function recordFeedback(opportunityId: string, signal: 'useful' | 'saved' | 'dismissed' | 'not_interested') {
    if (!connection) return navigate('settings');
    try {
      const client = new KernelClient(connection);
      await client.request(`/api/opportunities/${encodeURIComponent(opportunityId)}/feedback`, { method: 'POST', body: JSON.stringify({ signal }) }, parseOk);
      await refresh(); setToast(signal === 'dismissed' ? t('toast.feedbackDismissed') : t('toast.feedbackSaved'));
    } catch { setToast(t('toast.feedbackFailed')); }
  }

  async function openCase(record: CaseSummary) {
    if (!connection) return navigate('settings');
    setSelectedCaseId(record.id);
    if (caseDetails[record.id]) return;
    setLoadingCaseId(record.id);
    try {
      const client = new KernelClient(connection);
      const detail = await client.get(`/api/browser/case/${encodeURIComponent(record.id)}`, parseCaseDetail);
      setCaseDetails((current) => ({ ...current, [record.id]: detail }));
    } catch { setToast(t('toast.caseFailed')); }
    finally { setLoadingCaseId(''); }
  }

  function openEvidence(record?: CaseSummary) {
    if (!connection) {
      navigate('settings');
      return;
    }
    if (record) void openCase(record);
    navigate('evidence');
  }

  function openFinds() {
    if (!connection) {
      navigate('settings');
      return;
    }
    navigate('finds');
  }

  async function addProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connection) return navigate('settings');
    const form = event.currentTarget;
    const data = new FormData(form);
    const apiKeyInput = form.elements.namedItem('apiKey');
    const label = String(data.get('label') ?? '').trim();
    try {
      const client = new KernelClient(connection);
      await client.request('/api/chat/providers', { method: 'POST', body: JSON.stringify({
        id: slug(label), type: String(data.get('type') ?? 'openai-compatible'), label,
        baseUrl: String(data.get('baseUrl') ?? '').trim(),
        models: String(data.get('models') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
        ...(String(data.get('apiKey') ?? '').trim() ? { apiKey: String(data.get('apiKey')).trim() } : {}),
      }) }, parseOk);
      form.reset(); if (apiKeyInput instanceof HTMLInputElement) apiKeyInput.value = ''; await refresh();
      setToast(t('toast.providerSaved'));
    } catch { if (apiKeyInput instanceof HTMLInputElement) apiKeyInput.value = ''; setToast(t('toast.providerRejected')); }
  }

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || chatPending) return;
    const webChatAvailable = webMode && !connection;
    const controller = new AbortController();
    chatAbortRef.current = controller;
    const before: ChatMessage[] = [...chatMessages, { role: 'user', content }];
    setChatMessages([...before, { role: 'assistant', content: '', model: webChatAvailable ? t('composer.webPreview') : selectedModel }]); setInput(''); setChatPending(true);
    if (webChatAvailable) {
      try {
        const plan = await loadWebGoalIntelligencePlan(content, keywordsFromGoal(content), controller.signal);
        setChatMessages((current) => current.map((message, index) => index === current.length - 1
          ? {
            ...message,
            content: t('chat.webPreviewResponse', {
              count: plan.publicSearch?.results.length ?? 0,
              query: plan.publicSearch?.query ?? content,
            }),
            webSearch: plan.publicSearch,
          }
          : message));
        setToast(t('toast.webChatPrepared'));
      } catch {
        if (controller.signal.aborted) {
          setChatMessages((current) => current.slice(0, -1));
          setToast(t('toast.generationStopped'));
        } else {
          setChatMessages((current) => current.map((message, index) => index === current.length - 1
            ? { ...message, content: t('chat.webPreviewFailed'), model: t('composer.webPreview') }
            : message));
          setToast(t('toast.webChatFailed'));
        }
      } finally {
        setChatPending(false);
        if (chatAbortRef.current === controller) chatAbortRef.current = undefined;
      }
      return;
    }
    if (!connection) return navigate('settings');
    if (!selectedProvider || !selectedModel) return navigate('models');
    try {
      const client = new KernelClient({ ...connection, timeoutMs: 120_000 });
      await client.streamNdjson<StreamEvent>('/api/chat/stream', { method: 'POST', body: JSON.stringify({ providerId: selectedProvider.id, model: selectedModel, messages: before.map(({ role, content: text }) => ({ role, content: text })) }) }, (streamEvent) => {
        if (streamEvent.type === 'delta' && streamEvent.delta) setChatMessages((current) => current.map((message, index) => index === current.length - 1 ? { ...message, content: `${message.content}${streamEvent.delta}` } : message));
        if (streamEvent.type === 'done' && streamEvent.response?.model) setChatMessages((current) => current.map((message, index) => index === current.length - 1 ? { ...message, model: streamEvent.response?.model } : message));
        if (streamEvent.type === 'error') throw new Error(streamEvent.error ?? 'provider error');
      }, controller.signal);
      setToast(t('toast.chatComplete'));
    } catch { setToast(controller.signal.aborted ? t('toast.generationStopped') : t('toast.modelFailed')); }
    finally { setChatPending(false); if (chatAbortRef.current === controller) chatAbortRef.current = undefined; }
  }

  return <div className={`efesto-product ${navOpen ? 'nav-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${view === 'home' ? 'efesto-home-active' : ''} ${webMode ? 'runtime-web' : 'runtime-local'}`}>
    <aside className="efesto-sidebar" aria-label={t('nav.main')}>
      <div className="efesto-brand">
        <button type="button" onClick={() => navigate('home')} aria-label={t('nav.brandHome')}>
        <span className="brand-mark"><Image src="/efesto-smith.svg" alt="" width={36} height={36} unoptimized priority /></span>
          <span><strong>EFESTO</strong><small>The Intelligence Forge</small></span>
        </button>
        <button type="button" className="mobile-close" onClick={() => setNavOpen(false)} aria-label={t('nav.closeMenu')}><X /></button>
      </div>

      <div className="sidebar-actions" aria-label={t('nav.create')}>
        <button type="button" className="new-chat" onClick={newChat} title={t('nav.newChat')}>
          <SquarePen /><span>{t('nav.newChat')}</span>
        </button>
        <button type="button" className="new-goal" onClick={newGoal} title={t('nav.newGoal')}>
          <Target /><span>{t('nav.newGoal')}</span>
        </button>
      </div>

      {webMode && !connection ? <aside className="sidebar-runtime-card" aria-label={t('runtime.webGuideAria')}>
        <div className="sidebar-runtime-heading">
          <span className="sidebar-runtime-icon"><Sparkles /></span>
          <span><small>{t('runtime.webGuideEyebrow')}</small><strong>{t('runtime.webGuideTitle')}</strong></span>
        </div>
        <p>{t('runtime.webGuideCopy')}</p>
        <div className="sidebar-runtime-steps" aria-label={t('runtime.webGuideStepsAria')}>
          <span><b>1</b>{t('runtime.webGuideStep1')}</span>
          <span><b>2</b>{t('runtime.webGuideStep2')}</span>
          <span><b>3</b>{t('runtime.webGuideStep3')}</span>
        </div>
        <button type="button" onClick={() => navigate('settings')}>
          <Plug /><span>{t('runtime.webGuideAction')}</span><ChevronRight />
        </button>
      </aside> : null}

      <nav aria-label={t('nav.primaryAreas')}>
        {navGroups.map((group) => <div className="nav-group" key={group.labelKey}>
          <span className="nav-label">{t(group.labelKey)}</span>
          {group.items.map(({ id, labelKey, icon: Icon }) => { const label = t(labelKey); return <button type="button" key={id} className={view === id ? 'active' : ''} onClick={() => navigate(id)} aria-current={view === id ? 'page' : undefined} aria-label={label} title={label}>
            <Icon /><span>{label}</span>
            {id === 'missions' && snapshot ? <b>{snapshot.missions.length}</b> : null}
            {id === 'finds' && snapshot ? <b>{snapshot.opportunities.filter((item) => item.status === 'new').length}</b> : null}
          </button>; })}
        </div>)}
      </nav>

      <div className="sidebar-spacer" />
      <button type="button" className={'sidebar-settings ' + (view === 'settings' ? 'active' : '')} onClick={() => navigate('settings')} aria-current={view === 'settings' ? 'page' : undefined} title={t('nav.settings')}>
        <Settings /><span>{t('nav.settings')}</span>
      </button>
      <button type="button" className="kernel-summary" onClick={() => navigate('settings')}>
        <span className={`kernel-dot ${webMode && !connection ? 'online' : snapshot?.readiness.kernel === 'online' ? 'online' : 'offline'}`} />
        <span><strong>{webMode && !connection ? t('runtime.webReady') : snapshot?.readiness.kernel === 'online' ? t('kernel.connected') : t('kernel.local')}</strong><small>{webMode && !connection ? t('runtime.localOptional') : snapshot?.readiness.bootstrap?.pairing === 'paired' ? t('kernel.paired') : snapshot?.readiness.bootstrap?.pairing === 'required' ? t('kernel.pairingRequired') : t('kernel.offline')}</small></span>
        <ChevronRight />
      </button>
    </aside>
    {navOpen ? <button type="button" className="nav-scrim" onClick={() => setNavOpen(false)} aria-label={t('nav.closeMenu')} /> : null}

    <section className="efesto-stage">
      <header className="efesto-topbar">
        <div><button type="button" className="menu-button" onClick={toggleNavigation} aria-label={t('nav.toggle')}><Menu /></button><button type="button" className="top-title" onClick={() => navigate('home')}>Efesto <span>/</span> {viewLabel(view, t)}</button></div>
        <div className="top-context"><span className="local-first-status"><ShieldCheck /> {webMode && !connection ? t('top.webReady') : t('top.localDesign')}</span><span className="private-status">{webMode && !connection ? t('top.localOptional') : t('top.localProtection')}</span></div>
        <div className="top-actions"><button type="button" className="refresh-button" onClick={() => void refresh()} disabled={!connection} aria-label={t('top.refresh')}><RefreshCw /></button><button type="button" className={'connection-pill ' + (connection ? 'online' : webMode ? 'online web' : 'offline')} onClick={() => navigate('settings')}><span />{connection ? t('top.kernelReady') : webMode ? t('top.webReady') : t('top.connect')}</button></div>
      </header>
      <main className="efesto-main">
        {view === 'home' ? <HomeView phase={brainPhase} webMode={webMode && !connection} chatMode={chatMode} messages={chatMessages} preparedGoal={preparedGoal} goalPlan={goalPlan} goalPlanPending={goalPlanPending} connected={Boolean(connection)} goalPending={goalPending} input={input} onInputChange={updateInput} onSubmit={(event) => { if (chatMode) void sendChat(event); else void prepareGoal(event); }} onToggleChat={setChatMode} chatPending={chatPending} onStopChat={() => chatAbortRef.current?.abort()} chatAvailable={Boolean((connection && selectedProvider && selectedModel) || (webMode && !connection))} submitDisabled={!input.trim() || (chatMode && !(webMode && !connection) && (!connection || !selectedProvider || !selectedModel))} onConfirmGoal={() => void confirmGoal()} onRunGitHubEvidence={(githubInput) => void runGithubEvidence(githubInput)} onEditGoal={() => { setPreparedGoal(''); setGoalPlan(undefined); }} onOpenModels={() => navigate('models')} modelLabel={selectedProvider && selectedModel ? selectedProvider.label + ' · ' + selectedModel : 'Sin modelo'} providers={providers} selectedProviderId={selectedProviderId} selectedModel={selectedModel} onSelectModel={(providerId, model) => { setSelectedProviderId(providerId); setSelectedModel(model); }} onOpenSettings={() => navigate('settings')} onOpenAgents={() => navigate('agents')} onOpenNav={toggleNavigation} valueSurface={<ProductValueScorecardPanel scorecard={snapshot?.productScorecard} unavailable={!snapshot || !snapshot.productScorecard || snapshot.issues.some((issue) => issue.endpoint === 'scorecard')} />} /> : null}
        {view === 'missions' ? <MissionsView snapshot={snapshot} onNew={newGoal} /> : null}
        {view === 'finds' ? <FindsView opportunities={snapshot?.opportunities ?? []} connected={Boolean(connection)} onFeedback={(id, signal) => void recordFeedback(id, signal)} /> : null}
        {view === 'evidence' ? <EvidenceView cases={snapshot?.cases ?? []} selectedId={selectedCaseId} detail={selectedCaseId ? caseDetails[selectedCaseId] : undefined} loadingId={loadingCaseId} connected={Boolean(connection)} githubAuthorizationBusy={githubAuthorizationBusy} onOpen={(record) => void openCase(record)} onRevokeGithubAuthorization={(authorizationId) => void revokeGithubAuthorization(authorizationId)} /> : null}
        {view === 'models' ? <ModelsView providers={providers} selectedProviderId={selectedProviderId} selectedModel={selectedModel} modelForge={snapshot?.readiness.modelForge} connected={Boolean(connection)} onSelect={(providerId, model) => { setSelectedProviderId(providerId); setSelectedModel(model); setChatMode(true); navigate('home'); }} onAdd={addProvider} /> : null}
        {view === 'agents' ? <AgentsView snapshot={snapshot} onSettings={() => navigate('settings')} onNewGoal={newGoal} /> : null}
        {view === 'integrations' ? <IntegrationsView catalog={integrationCatalog} connected={Boolean(connection)} onNavigate={navigateIntegration} onRefresh={() => void refresh()} onBack={() => navigate('home')} /> : null}
        {view === 'automations' ? <AutomationsView missions={snapshot?.missions ?? []} connected={Boolean(connection)} onNewGoal={newGoal} /> : null}
        {view === 'settings' ? <SettingsView connected={Boolean(connection)} connecting={connecting} rememberSession={rememberSession} snapshot={snapshot} catalog={integrationCatalog} githubBusy={githubBusy} onConnect={connect} onDisconnect={disconnect} onRefresh={() => void refresh()} onConfigureGithub={configureGithub} onRevokeGithub={() => void revokeGithub()} /> : null}
      </main>

      {toast ? <div className="efesto-toast" role="status"><ShieldCheck /><span>{toast}</span><button type="button" onClick={() => setToast('')} aria-label={t('toast.close')}><X /></button></div> : null}
    </section>
  </div>;
}

function brainPhaseFromWorkState(workState: GoalSurfaceWorkState | undefined): BrainPhase {
  if (workState === 'verifying') return 'verifying';
  if (workState === 'investigating' || workState === 'running') return 'investigating';
  if (workState === 'waiting_for_agent' || workState === 'queued') return 'queued';
  if (workState === 'forged') return 'forged';
  if (workState === 'failed') return 'failed';
  return 'ready';
}
function keywordsFromGoal(value: string) { return Array.from(new Set(value.toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((word) => word.length > 2))).slice(0, 8); }
function slug(value: string) { return value.toLocaleLowerCase('en').replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || `provider-${Date.now()}`; }
function viewLabel(view: View, t: (key: string) => string) { return t(nav.find((item) => item.id === view)?.labelKey ?? 'nav.home'); }
async function loadOptionalIntegrationCatalog(client: KernelClient): Promise<IntegrationCatalog | undefined> {
  try { return await loadIntegrationCatalog(client); }
  catch { return undefined; }
}
function connectionMessage(error: unknown, t: (key: string) => string) { if (error instanceof KernelClientError && error.code === 'UNAUTHORIZED') return t('error.unauthorized'); if (error instanceof KernelClientError && error.code === 'TIMEOUT') return t('error.timeout'); if (error instanceof KernelClientError && error.code === 'OFFLINE') return t('error.offline'); return t('error.connection'); }
function parseObject(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid response'); return value as Record<string, unknown>; }
function parseOk(value: unknown) { const body = parseObject(value); if (body.ok !== true) throw new Error('Invalid response'); return body; }
function parseProviders(value: unknown): Provider[] { const body = parseOk(value); if (!Array.isArray(body.providers)) throw new Error('Invalid providers'); return body.providers.map((value) => { const item = parseObject(value); if (typeof item.id !== 'string' || typeof item.label !== 'string' || !Array.isArray(item.models) || !item.models.every((model) => typeof model === 'string')) throw new Error('Invalid provider'); return item as unknown as Provider; }); }
function parseCaseDetail(value: unknown): CaseDetail {
  const body = parseOk(value);
  const caseRecord = parseObject(body.case);
  if (!Array.isArray(body.evidence)) throw new Error('Invalid Evidence');
  const githubAuthorization = body.githubAuthorization === undefined ? undefined : parseGithubAuthorization(body.githubAuthorization);
  return { case: caseRecord, evidence: body.evidence.map((item) => parseObject(item) as EvidenceRecord), ...(githubAuthorization ? { githubAuthorization } : {}) };
}
function parseGithubAuthorization(value: unknown): NonNullable<CaseDetail['githubAuthorization']> {
  const item = parseObject(value);
  if (typeof item.id !== 'string' || typeof item.goalId !== 'string' || typeof item.scope !== 'string' || typeof item.issuedAt !== 'string' || typeof item.expiresAt !== 'string') throw new Error('Invalid GitHub authorization');
  if (!Array.isArray(item.approvedCapabilities) || !item.approvedCapabilities.every((capability) => typeof capability === 'string')) throw new Error('Invalid GitHub capabilities');
  if (!['active', 'expired', 'revoked', 'invalid'].includes(item.status as string)) throw new Error('Invalid GitHub authorization status');
  return { id: item.id, goalId: item.goalId, scope: item.scope, approvedCapabilities: item.approvedCapabilities as string[], issuedAt: item.issuedAt, expiresAt: item.expiresAt, status: item.status as NonNullable<CaseDetail['githubAuthorization']>['status'], ...(typeof item.revokedAt === 'string' ? { revokedAt: item.revokedAt } : {}) };
}
