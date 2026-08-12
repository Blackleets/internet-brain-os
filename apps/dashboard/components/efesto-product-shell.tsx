'use client';

import {
  BrainCircuit, ChevronRight, Home, Menu, MessageSquare, Pause, RefreshCw, Send,
  Settings, ShieldCheck, Sparkles, Target, Workflow, Bot, X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { KernelClient, KernelClientError } from '../lib/kernel/client';
import type { CaseSummary } from '../lib/kernel/contracts';
import { loadGoalSurfaces, type GoalSurface, type GoalSurfaceWorkState } from '../lib/kernel/goal-surfaces';
import { loadOverview, type OverviewSnapshot } from '../lib/kernel/overview';
import { normalizeKernelBaseUrl } from '../lib/kernel/url';
import { connectionStore } from '../lib/session/connection-store';
import {
  AgentsView, AutomationsView, EvidenceView, FindsView, HomeView, MissionsView, ModelsView, SettingsView,
  type BrainPhase, type CaseDetail, type ChatMessage, type EvidenceRecord, type Provider,
} from './efesto-product-views';
import { ProductValueScorecardPanel } from './overview/product-value-scorecard';

type View = 'home' | 'missions' | 'finds' | 'evidence' | 'models' | 'agents' | 'automations' | 'settings';
type Connection = { baseUrl: string; token: string };
type StreamEvent = { type?: 'conversation' | 'delta' | 'done' | 'error'; delta?: string; error?: string; response?: { model?: string } };

const SESSION_CONNECTION_KEY = 'hephaestus.owner.connection.session.v1';
const DEFAULT_BASE_URL = 'http://127.0.0.1:4000';
const nav: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'missions', label: 'Missions', icon: Target },
  { id: 'finds', label: 'Finds', icon: Sparkles },
  { id: 'evidence', label: 'Evidence', icon: ShieldCheck },
  { id: 'models', label: 'Models', icon: BrainCircuit },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'automations', label: 'Automations', icon: Workflow },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function EfestoProductShell() {
  const [view, setView] = useState<View>('home');
  const [navOpen, setNavOpen] = useState(false);
  const [connection, setConnection] = useState<Connection>();
  const [snapshot, setSnapshot] = useState<OverviewSnapshot>();
  const [goalSurfaces, setGoalSurfaces] = useState<GoalSurface[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [input, setInput] = useState('');
  const [preparedGoal, setPreparedGoal] = useState('');
  const [goalPending, setGoalPending] = useState(false);
  const [chatMode, setChatMode] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatPending, setChatPending] = useState(false);
  const [caseDetails, setCaseDetails] = useState<Record<string, CaseDetail>>({});
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [loadingCaseId, setLoadingCaseId] = useState('');
  const [toast, setToast] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);
  const chatAbortRef = useRef<AbortController | undefined>(undefined);

  const selectedProvider = providers.find((item) => item.id === selectedProviderId);
  const focusedGoalSurface = goalSurfaces[0];
  const brainPhase = useMemo<BrainPhase>(() => {
    if (!connection || snapshot?.readiness.kernel !== 'online') return 'offline';
    if (chatPending) return 'thinking';
    return brainPhaseFromWorkState(focusedGoalSurface?.mission?.workState);
  }, [chatPending, connection, focusedGoalSurface?.mission?.workState, snapshot?.readiness.kernel]);

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
        const [nextSnapshot, nextGoalSurfaces] = await Promise.all([
          loadOverview(client),
          loadGoalSurfaces(client),
        ]);
        if (cancelled) return;
        setSnapshot(nextSnapshot);
        setGoalSurfaces(nextGoalSurfaces);
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
  function newGoal() { setChatMode(false); setPreparedGoal(''); setInput(''); navigate('home'); }

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
      setToast('Introduce el token privado o usa el código de emparejamiento.');
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
        setToast('Kernel emparejado. La web ya puede controlar Missions y Evidence.');
      }
    } catch (error) {
      if (error instanceof KernelClientError && error.code === 'HTTP_ERROR') {
        setToast('Código rechazado, expirado o ya utilizado. Genera otro en el Kernel.');
      } else {
        setToast(connectionMessage(error));
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
      const [nextSnapshot, nextProviders, nextGoalSurfaces] = await Promise.all([
        loadOverview(client),
        client.get('/api/chat/providers', parseProviders),
        loadGoalSurfaces(client),
      ]);
      if (nextSnapshot.readiness.kernel !== 'online') throw new KernelClientError('OFFLINE');
      setConnection(verified);
      setSnapshot(nextSnapshot);
      setProviders(nextProviders);
      setGoalSurfaces(nextGoalSurfaces);
      connectionStore.set(verified);
      if (remember) window.sessionStorage.setItem(SESSION_CONNECTION_KEY, JSON.stringify(verified));
      else window.sessionStorage.removeItem(SESSION_CONNECTION_KEY);
      setToast('Kernel conectado. La interfaz muestra estado persistido real.');
      return true;
    } catch (error) {
      setConnection(undefined); setSnapshot(undefined); setProviders([]); setGoalSurfaces([]); connectionStore.clear();
      window.sessionStorage.removeItem(SESSION_CONNECTION_KEY);
      setToast(connectionMessage(error));
      return false;
    } finally { setConnecting(false); }
  }

  function disconnect() {
    chatAbortRef.current?.abort();
    setConnection(undefined); setSnapshot(undefined); setProviders([]); setGoalSurfaces([]); setCaseDetails({}); setSelectedCaseId(''); setChatMessages([]);
    connectionStore.clear(); window.sessionStorage.removeItem(SESSION_CONNECTION_KEY); setRememberSession(false);
    setToast('Dispositivo desconectado. El token ya no está en esta sesión.');
  }

  async function refresh() {
    if (!connection) return navigate('settings');
    try {
      const client = new KernelClient(connection);
      const [nextSnapshot, nextProviders, nextGoalSurfaces] = await Promise.all([
        loadOverview(client),
        client.get('/api/chat/providers', parseProviders),
        loadGoalSurfaces(client),
      ]);
      setSnapshot(nextSnapshot); setProviders(nextProviders); setGoalSurfaces(nextGoalSurfaces); setToast('Estado actualizado desde el Kernel.');
    } catch (error) { setToast(connectionMessage(error)); }
  }

  function prepareGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    setPreparedGoal(value);
    setToast(connection ? 'Plan preparado. Nada se ejecutará hasta que confirmes.' : 'Borrador preparado localmente. Conecta el Kernel para ejecutarlo.');
  }

  async function confirmGoal() {
    if (!connection || !preparedGoal || goalPending) { if (!connection) navigate('settings'); return; }
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
      setToast('Goal persistido y misión confirmada para Hermes.');
    } catch { setToast('El Kernel rechazó la misión. No se creó actividad falsa ni trabajo parcial.'); }
    finally { setGoalPending(false); }
  }

  async function recordFeedback(opportunityId: string, signal: 'useful' | 'saved' | 'dismissed' | 'not_interested') {
    if (!connection) return navigate('settings');
    try {
      const client = new KernelClient(connection);
      await client.request(`/api/opportunities/${encodeURIComponent(opportunityId)}/feedback`, { method: 'POST', body: JSON.stringify({ signal }) }, parseOk);
      await refresh(); setToast(signal === 'dismissed' ? 'Find descartado; Evidence objetiva no fue reescrita.' : 'Preferencia guardada en el Kernel.');
    } catch { setToast('No se pudo registrar el feedback. El estado anterior se conserva.'); }
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
    } catch { setToast('No se pudo abrir el Case o su Evidence. No se muestran datos de relleno.'); }
    finally { setLoadingCaseId(''); }
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
      setToast('Proveedor guardado de forma privada en el Kernel.');
    } catch { if (apiKeyInput instanceof HTMLInputElement) apiKeyInput.value = ''; setToast('El proveedor fue rechazado. Revisa URL, modelos y credencial.'); }
  }

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || chatPending) return;
    if (!connection) return navigate('settings');
    if (!selectedProvider || !selectedModel) return navigate('models');
    const controller = new AbortController();
    chatAbortRef.current = controller;
    const before: ChatMessage[] = [...chatMessages, { role: 'user', content }];
    setChatMessages([...before, { role: 'assistant', content: '', model: selectedModel }]); setInput(''); setChatPending(true);
    try {
      const client = new KernelClient({ ...connection, timeoutMs: 120_000 });
      await client.streamNdjson<StreamEvent>('/api/chat/stream', { method: 'POST', body: JSON.stringify({ providerId: selectedProvider.id, model: selectedModel, messages: before.map(({ role, content: text }) => ({ role, content: text })) }) }, (streamEvent) => {
        if (streamEvent.type === 'delta' && streamEvent.delta) setChatMessages((current) => current.map((message, index) => index === current.length - 1 ? { ...message, content: `${message.content}${streamEvent.delta}` } : message));
        if (streamEvent.type === 'done' && streamEvent.response?.model) setChatMessages((current) => current.map((message, index) => index === current.length - 1 ? { ...message, model: streamEvent.response?.model } : message));
        if (streamEvent.type === 'error') throw new Error(streamEvent.error ?? 'provider error');
      }, controller.signal);
      setToast('Conversación completada. La salida del modelo sigue separada de Evidence y memoria.');
    } catch { setToast(controller.signal.aborted ? 'Generación detenida por el usuario.' : 'El modelo no respondió. No se guardó una respuesta falsa.'); }
    finally { setChatPending(false); if (chatAbortRef.current === controller) chatAbortRef.current = undefined; }
  }

  return <div className={`efesto-product ${navOpen ? 'nav-open' : ''}`}>
    <aside className="efesto-sidebar" aria-label="Navegación principal">
      <div className="efesto-brand"><button type="button" onClick={() => navigate('home')} aria-label="Efesto, inicio"><span className="brand-mark"><BrainCircuit /></span><span><strong>EFESTO</strong><small>The Intelligence Forge</small></span></button><button type="button" className="mobile-close" onClick={() => setNavOpen(false)} aria-label="Cerrar menú"><X /></button></div>
      <button type="button" className="new-goal" onClick={newGoal}><Target /><span>Nuevo Goal</span></button>
      <nav>{nav.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={view === id ? 'active' : ''} onClick={() => navigate(id)} aria-current={view === id ? 'page' : undefined}><Icon /><span>{label}</span>{id === 'missions' && snapshot ? <b>{snapshot.missions.length}</b> : null}{id === 'finds' && snapshot ? <b>{snapshot.opportunities.filter((item) => item.status === 'new').length}</b> : null}</button>)}</nav>
      <div className="sidebar-spacer" />
      <button type="button" className="kernel-summary" onClick={() => navigate('settings')}><span className={`kernel-dot ${snapshot?.readiness.kernel === 'online' ? 'online' : 'offline'}`} /><span><strong>{snapshot?.readiness.kernel === 'online' ? 'Kernel online' : 'Kernel local'}</strong><small>{snapshot?.readiness.bootstrap?.pairing === 'paired' ? 'Emparejado' : snapshot?.readiness.bootstrap?.pairing === 'required' ? 'Pairing requerido' : 'Sin conexión'}</small></span><ChevronRight /></button>
    </aside>
    {navOpen ? <button type="button" className="nav-scrim" onClick={() => setNavOpen(false)} aria-label="Cerrar menú" /> : null}

    <section className="efesto-stage">
      <header className="efesto-topbar"><div><button type="button" className="menu-button" onClick={() => setNavOpen(true)} aria-label="Abrir menú"><Menu /></button><button type="button" className="top-title" onClick={() => navigate('home')}>Efesto <span>/</span> {viewLabel(view)}</button></div><div className="top-actions"><button type="button" className="refresh-button" onClick={() => void refresh()} disabled={!connection} aria-label="Actualizar estado"><RefreshCw /></button><button type="button" className={`connection-pill ${connection ? 'online' : 'offline'}`} onClick={() => navigate('settings')}><span />{connection ? 'Kernel ready' : 'Conectar'}</button></div></header>
      <main className="efesto-main">
        {view === 'home' ? <HomeView phase={brainPhase} chatMode={chatMode} messages={chatMessages} preparedGoal={preparedGoal} connected={Boolean(connection)} goalPending={goalPending} onConfirmGoal={() => void confirmGoal()} onEditGoal={() => setPreparedGoal('')} onStarterGoal={(goal) => { setChatMode(false); setPreparedGoal(''); setInput(goal); }} /> : null}
        {view === 'home' && !chatMode ? <ProductValueScorecardPanel scorecard={snapshot?.productScorecard} unavailable={!snapshot || snapshot.issues.some((issue) => issue.endpoint === 'scorecard')} /> : null}
        {view === 'missions' ? <MissionsView snapshot={snapshot} onNew={newGoal} /> : null}
        {view === 'finds' ? <FindsView opportunities={snapshot?.opportunities ?? []} connected={Boolean(connection)} onFeedback={(id, signal) => void recordFeedback(id, signal)} /> : null}
        {view === 'evidence' ? <EvidenceView cases={snapshot?.cases ?? []} selectedId={selectedCaseId} detail={selectedCaseId ? caseDetails[selectedCaseId] : undefined} loadingId={loadingCaseId} connected={Boolean(connection)} onOpen={(record) => void openCase(record)} /> : null}
        {view === 'models' ? <ModelsView providers={providers} selectedProviderId={selectedProviderId} selectedModel={selectedModel} modelForge={snapshot?.readiness.modelForge} connected={Boolean(connection)} onSelect={(providerId, model) => { setSelectedProviderId(providerId); setSelectedModel(model); setChatMode(true); navigate('home'); }} onAdd={addProvider} /> : null}
        {view === 'agents' ? <AgentsView snapshot={snapshot} onSettings={() => navigate('settings')} onNewGoal={newGoal} /> : null}
        {view === 'automations' ? <AutomationsView missions={snapshot?.missions ?? []} connected={Boolean(connection)} onNewGoal={newGoal} /> : null}
        {view === 'settings' ? <SettingsView connected={Boolean(connection)} connecting={connecting} rememberSession={rememberSession} snapshot={snapshot} onConnect={connect} onDisconnect={disconnect} onRefresh={() => void refresh()} /> : null}
      </main>

      {view === 'home' ? <form className="goal-dock" onSubmit={chatMode ? sendChat : prepareGoal}>
        <div className="composer-mode" role="group" aria-label="Modo del compositor"><button type="button" className={!chatMode ? 'active' : ''} onClick={() => setChatMode(false)}><Target /> Goal</button><button type="button" className={chatMode ? 'active' : ''} onClick={() => setChatMode(true)}><MessageSquare /> Chat</button></div>
        <textarea aria-label={chatMode ? 'Mensaje' : 'Goal'} value={input} onChange={(event) => setInput(event.target.value)} rows={1} placeholder={chatMode ? (providers.length ? 'Pregunta a tu modelo…' : 'Configura un modelo para conversar…') : 'Dile a Efesto qué quieres conseguir…'} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
        {chatPending ? <button type="button" className="send-button stop" onClick={() => chatAbortRef.current?.abort()} aria-label="Detener"><Pause /></button> : <button type="submit" className="send-button" disabled={!input.trim() || (chatMode && (!connection || !selectedProvider || !selectedModel))} aria-label={chatMode ? 'Enviar' : 'Preparar Goal'}><Send /></button>}
        <p><ShieldCheck /> {chatMode ? 'Chat no entra en memoria automáticamente.' : 'El Goal se prepara primero; ejecutar requiere confirmación explícita.'}</p>
      </form> : null}
      {toast ? <div className="efesto-toast" role="status"><ShieldCheck /><span>{toast}</span><button type="button" onClick={() => setToast('')} aria-label="Cerrar aviso"><X /></button></div> : null}
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
function viewLabel(view: View) { return nav.find((item) => item.id === view)?.label ?? 'Inicio'; }
function connectionMessage(error: unknown) { if (error instanceof KernelClientError && error.code === 'UNAUTHORIZED') return 'El Kernel rechazó el token. No se guardó la credencial.'; if (error instanceof KernelClientError && error.code === 'TIMEOUT') return 'El Kernel tardó demasiado en responder.'; if (error instanceof KernelClientError && error.code === 'OFFLINE') return 'No se alcanzó el Kernel local. Comprueba que el Launcher esté activo.'; return 'No se pudo conectar. Revisa la URL local y el token.'; }
function parseObject(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid response'); return value as Record<string, unknown>; }
function parseOk(value: unknown) { const body = parseObject(value); if (body.ok !== true) throw new Error('Invalid response'); return body; }
function parseProviders(value: unknown): Provider[] { const body = parseOk(value); if (!Array.isArray(body.providers)) throw new Error('Invalid providers'); return body.providers.map((value) => { const item = parseObject(value); if (typeof item.id !== 'string' || typeof item.label !== 'string' || !Array.isArray(item.models) || !item.models.every((model) => typeof model === 'string')) throw new Error('Invalid provider'); return item as unknown as Provider; }); }
function parseCaseDetail(value: unknown): CaseDetail { const body = parseOk(value); const caseRecord = parseObject(body.case); if (!Array.isArray(body.evidence)) throw new Error('Invalid Evidence'); return { case: caseRecord, evidence: body.evidence.map((item) => parseObject(item) as EvidenceRecord) }; }
