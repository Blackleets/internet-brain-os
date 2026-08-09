'use client';

import Image from 'next/image';
import {
  Activity, Bot, BrainCircuit, Check, ChevronRight, CircleOff, Database, ExternalLink,
  FileSearch, History, Home, Menu, MessageSquare, Pause, Plug, RefreshCw, Search,
  Send, Settings, ShieldCheck, Sparkles, Target, Workflow, X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { KernelClient, KernelClientError } from '../lib/kernel/client';
import type { CaseSummary, MissionSummary, OpportunitySummary } from '../lib/kernel/contracts';
import { loadOverview, type OverviewSnapshot } from '../lib/kernel/overview';
import { normalizeKernelBaseUrl } from '../lib/kernel/url';
import { connectionStore } from '../lib/session/connection-store';

type View = 'home' | 'missions' | 'finds' | 'evidence' | 'models' | 'agents' | 'automations' | 'settings';
type Connection = { baseUrl: string; token: string };
type Provider = { id: string; type: 'ollama' | 'openai-compatible'; label: string; baseUrl?: string; models: string[]; hasCredential?: boolean; managedBy?: 'environment' | 'user' };
type ChatMessage = { role: 'user' | 'assistant'; content: string; model?: string };
type EvidenceRecord = { id?: string; sourceUrl?: string; summary?: string; confidence?: number; capturedAt?: string; tags?: string[]; entityIds?: string[]; relationshipIds?: string[] };
type CaseDetail = { case: Record<string, unknown>; evidence: EvidenceRecord[] };
type StreamEvent = { type?: 'conversation' | 'delta' | 'done' | 'error'; delta?: string; error?: string; response?: { model?: string } };

type BrainPhase = 'offline' | 'ready' | 'queued' | 'investigating' | 'verifying' | 'forged' | 'thinking' | 'failed';

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

const starterGoals = [
  'Encuéntrame un taladro bueno en España entre 18 € y 25 €.',
  'Busca trabajos freelance remotos de 20–30 $/h o más.',
  'Investiga una empresa y dime qué afirmaciones están respaldadas por fuentes.',
  'Encuentra oportunidades públicas relevantes y evita duplicados.',
];

export default function EfestoProductShell() {
  const [view, setView] = useState<View>('home');
  const [navOpen, setNavOpen] = useState(false);
  const [connection, setConnection] = useState<Connection>();
  const [snapshot, setSnapshot] = useState<OverviewSnapshot>();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [goalText, setGoalText] = useState('');
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
  const chatAbortRef = useRef<AbortController>();

  const selectedProvider = providers.find((item) => item.id === selectedProviderId);
  const activeMission = snapshot?.missions.find((mission) => isActiveMission(mission));
  const brainPhase = useMemo<BrainPhase>(() => {
    if (!connection || snapshot?.readiness.kernel !== 'online') return 'offline';
    if (chatPending) return 'thinking';
    if (activeMission?.executionPhase === 'verifying') return 'verifying';
    if (activeMission?.executionPhase === 'investigating' || activeMission?.status === 'running') return 'investigating';
    if (activeMission) return 'queued';
    const latest = snapshot?.missions[0];
    if (latest?.executionPhase === 'failed' || latest?.status === 'failed') return 'failed';
    if (latest?.executionPhase === 'forged' || latest?.status === 'completed') return 'forged';
    return 'ready';
  }, [activeMission, chatPending, connection, snapshot]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProvider) {
      const first = providers[0];
      setSelectedProviderId(first?.id ?? '');
      setSelectedModel(first?.models[0] ?? '');
      return;
    }
    if (!selectedProvider.models.includes(selectedModel)) setSelectedModel(selectedProvider.models[0] ?? '');
  }, [providers, selectedModel, selectedProvider]);

  function navigate(next: View) {
    setView(next);
    setNavOpen(false);
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const tokenInput = form.elements.namedItem('token');
    const next = { baseUrl: String(data.get('baseUrl') ?? DEFAULT_BASE_URL), token: String(data.get('token') ?? '') };
    const remember = data.get('rememberSession') === 'on';
    if (tokenInput instanceof HTMLInputElement) tokenInput.value = '';
    setRememberSession(remember);
    await connectWith(next, remember);
  }

  async function connectWith(input: Connection, remember: boolean) {
    setConnecting(true);
    setToast('');
    try {
      const verified = { baseUrl: normalizeKernelBaseUrl(input.baseUrl), token: input.token };
      const client = new KernelClient(verified);
      const [nextSnapshot, nextProviders] = await Promise.all([
        loadOverview(client),
        client.get('/api/chat/providers', parseProviders),
      ]);
      if (nextSnapshot.readiness.kernel !== 'online') throw new KernelClientError('OFFLINE');
      setConnection(verified);
      setSnapshot(nextSnapshot);
      setProviders(nextProviders);
      connectionStore.set(verified);
      if (remember) window.sessionStorage.setItem(SESSION_CONNECTION_KEY, JSON.stringify(verified));
      else window.sessionStorage.removeItem(SESSION_CONNECTION_KEY);
      setToast('Kernel conectado. La interfaz ahora muestra estado persistido real.');
    } catch (error) {
      setConnection(undefined);
      setSnapshot(undefined);
      setProviders([]);
      connectionStore.clear();
      setToast(connectionMessage(error));
    } finally {
      setConnecting(false);
    }
  }

  function disconnect() {
    chatAbortRef.current?.abort();
    setConnection(undefined);
    setSnapshot(undefined);
    setProviders([]);
    setCaseDetails({});
    setSelectedCaseId('');
    setChatMessages([]);
    connectionStore.clear();
    window.sessionStorage.removeItem(SESSION_CONNECTION_KEY);
    setRememberSession(false);
    setToast('Dispositivo desconectado. El token ya no está en esta sesión.');
  }

  async function refresh() {
    if (!connection) return navigate('settings');
    try {
      const client = new KernelClient(connection);
      const [nextSnapshot, nextProviders] = await Promise.all([
        loadOverview(client),
        client.get('/api/chat/providers', parseProviders),
      ]);
      setSnapshot(nextSnapshot);
      setProviders(nextProviders);
      setToast('Estado actualizado desde el Kernel.');
    } catch (error) {
      setToast(connectionMessage(error));
    }
  }

  function prepareGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = goalText.trim();
    if (!value) return;
    setPreparedGoal(value);
    setToast(connection ? 'Plan preparado. Nada se ejecutará hasta que confirmes.' : 'Borrador preparado localmente. Conecta el Kernel para ejecutarlo.');
  }

  async function confirmGoal() {
    if (!connection || !preparedGoal || goalPending) {
      if (!connection) navigate('settings');
      return;
    }
    setGoalPending(true);
    try {
      const client = new KernelClient(connection, 30_000);
      const goalResponse = await client.request('/api/goals', {
        method: 'POST',
        body: JSON.stringify({
          title: preparedGoal,
          keywords: keywordsFromGoal(preparedGoal),
          priority: 2,
        }),
      }, parseObject);
      const goal = parseObject(goalResponse.goal);
      if (typeof goal.id !== 'string' || !goal.id) throw new Error('Goal id missing');
      await client.request(`/api/goals/${encodeURIComponent(goal.id)}/missions`, {
        method: 'POST',
        body: JSON.stringify({ confirmed: true, agent: 'hermes', cadence: 'manual' }),
      }, parseOk);
      setGoalText('');
      setPreparedGoal('');
      await refresh();
      navigate('missions');
      setToast('Goal persistido y misión confirmada para Hermes.');
    } catch {
      setToast('El Kernel rechazó la misión. No se creó actividad falsa ni trabajo parcial.');
    } finally {
      setGoalPending(false);
    }
  }

  async function recordFeedback(opportunityId: string, signal: 'useful' | 'saved' | 'dismissed' | 'not_interested') {
    if (!connection) return navigate('settings');
    try {
      const client = new KernelClient(connection);
      await client.request(`/api/opportunities/${encodeURIComponent(opportunityId)}/feedback`, {
        method: 'POST', body: JSON.stringify({ signal }),
      }, parseOk);
      await refresh();
      setToast(signal === 'dismissed' || signal === 'not_interested' ? 'Find descartado; Evidence objetiva no fue reescrita.' : 'Preferencia guardada en el Kernel.');
    } catch {
      setToast('No se pudo registrar el feedback. El estado anterior se conserva.');
    }
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
    } catch {
      setToast('No se pudo abrir el Case o su Evidence. No se muestran datos de relleno.');
    } finally {
      setLoadingCaseId('');
    }
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
      await client.request('/api/chat/providers', {
        method: 'POST',
        body: JSON.stringify({
          id: slug(label),
          type: String(data.get('type') ?? 'openai-compatible'),
          label,
          baseUrl: String(data.get('baseUrl') ?? '').trim(),
          models: String(data.get('models') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
          ...(String(data.get('apiKey') ?? '').trim() ? { apiKey: String(data.get('apiKey')).trim() } : {}),
        }),
      }, parseOk);
      form.reset();
      if (apiKeyInput instanceof HTMLInputElement) apiKeyInput.value = '';
      await refresh();
      setToast('Proveedor guardado de forma privada en el Kernel.');
    } catch {
      if (apiKeyInput instanceof HTMLInputElement) apiKeyInput.value = '';
      setToast('El proveedor fue rechazado. Revisa URL, modelos y credencial.');
    }
  }

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = goalText.trim();
    if (!content || chatPending) return;
    if (!connection) return navigate('settings');
    if (!selectedProvider || !selectedModel) return navigate('models');

    const controller = new AbortController();
    chatAbortRef.current = controller;
    const before: ChatMessage[] = [...chatMessages, { role: 'user', content }];
    setChatMessages([...before, { role: 'assistant', content: '', model: selectedModel }]);
    setGoalText('');
    setChatPending(true);
    try {
      const client = new KernelClient({ ...connection, timeoutMs: 120_000 });
      await client.streamNdjson<StreamEvent>('/api/chat/stream', {
        method: 'POST',
        body: JSON.stringify({
          providerId: selectedProvider.id,
          model: selectedModel,
          messages: before.map(({ role, content }) => ({ role, content })),
        }),
      }, (streamEvent) => {
        if (streamEvent.type === 'delta' && streamEvent.delta) {
          setChatMessages((current) => current.map((message, index) => index === current.length - 1
            ? { ...message, content: `${message.content}${streamEvent.delta}` }
            : message));
        }
        if (streamEvent.type === 'done' && streamEvent.response?.model) {
          setChatMessages((current) => current.map((message, index) => index === current.length - 1
            ? { ...message, model: streamEvent.response?.model }
            : message));
        }
        if (streamEvent.type === 'error') throw new Error(streamEvent.error ?? 'provider error');
      }, controller.signal);
      setToast('Conversación completada. La salida del modelo sigue separada de Evidence y memoria.');
    } catch {
      if (!controller.signal.aborted) setToast('El modelo no respondió. No se guardó una respuesta falsa.');
      else setToast('Generación detenida por el usuario.');
    } finally {
      setChatPending(false);
      if (chatAbortRef.current === controller) chatAbortRef.current = undefined;
    }
  }

  return (
    <div className={`efesto-product ${navOpen ? 'nav-open' : ''}`}>
      <aside className="efesto-sidebar" aria-label="Navegación principal">
        <div className="efesto-brand">
          <button type="button" onClick={() => navigate('home')} aria-label="Efesto, inicio"><span className="brand-mark"><BrainCircuit /></span><span><strong>EFESTO</strong><small>The Intelligence Forge</small></span></button>
          <button type="button" className="mobile-close" onClick={() => setNavOpen(false)} aria-label="Cerrar menú"><X /></button>
        </div>
        <button type="button" className="new-goal" onClick={() => { setChatMode(false); setPreparedGoal(''); setGoalText(''); navigate('home'); }}><Target /><span>Nuevo Goal</span></button>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={view === id ? 'active' : ''} onClick={() => navigate(id)} aria-current={view === id ? 'page' : undefined}><Icon /><span>{label}</span>{id === 'missions' && snapshot ? <b>{snapshot.missions.length}</b> : null}{id === 'finds' && snapshot ? <b>{snapshot.opportunities.filter((item) => item.status === 'new').length}</b> : null}</button>)}
        </nav>
        <div className="sidebar-spacer" />
        <button type="button" className="kernel-summary" onClick={() => navigate('settings')}><span className={`kernel-dot ${snapshot?.readiness.kernel === 'online' ? 'online' : 'offline'}`} /><span><strong>{snapshot?.readiness.kernel === 'online' ? 'Kernel online' : 'Kernel local'}</strong><small>{snapshot?.readiness.bootstrap?.pairing === 'paired' ? 'Emparejado' : snapshot?.readiness.bootstrap?.pairing === 'required' ? 'Pairing requerido' : 'Sin conexión'}</small></span><ChevronRight /></button>
      </aside>

      {navOpen ? <button type="button" className="nav-scrim" onClick={() => setNavOpen(false)} aria-label="Cerrar menú" /> : null}

      <section className="efesto-stage">
        <header className="efesto-topbar">
          <div><button type="button" className="menu-button" onClick={() => setNavOpen(true)} aria-label="Abrir menú"><Menu /></button><button type="button" className="top-title" onClick={() => navigate('home')}>Efesto <span>/</span> {viewLabel(view)}</button></div>
          <div className="top-actions"><button type="button" className="refresh-button" onClick={() => void refresh()} disabled={!connection} aria-label="Actualizar estado"><RefreshCw /></button><button type="button" className={`connection-pill ${connection ? 'online' : 'offline'}`} onClick={() => navigate('settings')}><span />{connection ? 'Kernel ready' : 'Conectar'}</button></div>
        </header>

        <main className="efesto-main">
          {view === 'home' ? <HomeView phase={brainPhase} chatMode={chatMode} onChatMode={setChatMode} messages={chatMessages} preparedGoal={preparedGoal} connected={Boolean(connection)} onConfirmGoal={() => void confirmGoal()} goalPending={goalPending} onEditGoal={() => setPreparedGoal('')} /> : null}
          {view === 'missions' ? <MissionsView snapshot={snapshot} onNew={() => navigate('home')} /> : null}
          {view === 'finds' ? <FindsView opportunities={snapshot?.opportunities ?? []} connected={Boolean(connection)} onFeedback={recordFeedback} /> : null}
          {view === 'evidence' ? <EvidenceView cases={snapshot?.cases ?? []} selectedId={selectedCaseId} detail={selectedCaseId ? caseDetails[selectedCaseId] : undefined} loadingId={loadingCaseId} connected={Boolean(connection)} onOpen={(record) => void openCase(record)} /> : null}
          {view === 'models' ? <ModelsView providers={providers} selectedProviderId={selectedProviderId} selectedModel={selectedModel} modelForge={snapshot?.readiness.modelForge} connected={Boolean(connection)} onSelect={(providerId, model) => { setSelectedProviderId(providerId); setSelectedModel(model); setChatMode(true); navigate('home'); }} onAdd={addProvider} /> : null}
          {view === 'agents' ? <AgentsView snapshot={snapshot} onSettings={() => navigate('settings')} onNewGoal={() => navigate('home')} /> : null}
          {view === 'automations' ? <AutomationsView missions={snapshot?.missions ?? []} connected={Boolean(connection)} onNewGoal={() => navigate('home')} /> : null}
          {view === 'settings' ? <SettingsView connected={Boolean(connection)} connecting={connecting} rememberSession={rememberSession} snapshot={snapshot} onConnect={connect} onDisconnect={disconnect} onRefresh={() => void refresh()} /> : null}
        </main>

        {view === 'home' ? <form className="goal-dock" onSubmit={chatMode ? sendChat : prepareGoal}>
          <div className="composer-mode" role="group" aria-label="Modo del compositor"><button type="button" className={!chatMode ? 'active' : ''} onClick={() => setChatMode(false)}><Target /> Goal</button><button type="button" className={chatMode ? 'active' : ''} onClick={() => setChatMode(true)}><MessageSquare /> Chat</button></div>
          <textarea aria-label={chatMode ? 'Mensaje' : 'Goal'} value={goalText} onChange={(event) => setGoalText(event.target.value)} rows={1} placeholder={chatMode ? (providers.length ? 'Pregunta a tu modelo…' : 'Configura un modelo para conversar…') : 'Dile a Efesto qué quieres conseguir…'} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
          }} />
          {chatPending ? <button type="button" className="send-button stop" onClick={() => chatAbortRef.current?.abort()} aria-label="Detener"><Pause /></button> : <button type="submit" className="send-button" disabled={!goalText.trim() || (chatMode && (!connection || !selectedProvider || !selectedModel))} aria-label={chatMode ? 'Enviar' : 'Preparar Goal'}><Send /></button>}
          <p><ShieldCheck /> {chatMode ? 'Chat no entra en memoria automáticamente.' : 'El Goal se prepara primero; ejecutar requiere confirmación explícita.'}</p>
        </form> : null}

        {toast ? <div className="efesto-toast" role="status"><ShieldCheck /><span>{toast}</span><button type="button" onClick={() => setToast('')} aria-label="Cerrar aviso"><X /></button></div> : null}
      </section>
    </div>
  );
}

function HomeView({ phase, chatMode, onChatMode, messages, preparedGoal, connected, onConfirmGoal, goalPending, onEditGoal }: { phase: BrainPhase; chatMode: boolean; onChatMode: (value: boolean) => void; messages: ChatMessage[]; preparedGoal: string; connected: boolean; onConfirmGoal: () => void; goalPending: boolean; onEditGoal: () => void }) {
  const state = brainState(phase);
  if (chatMode && messages.length) return <section className="chat-thread" aria-label="Conversación"><BrainHeader phase={phase} />{messages.map((message, index) => <article className={message.role} key={`${message.role}-${index}`}><div className="message-avatar">{message.role === 'user' ? 'Tú' : <BrainCircuit />}</div><div><header><strong>{message.role === 'user' ? 'Tú' : message.model ?? 'Modelo'}</strong>{message.role === 'assistant' ? <span><ShieldCheck /> No admitido en memoria</span> : null}</header><p>{message.content}</p></div></article>)}</section>;

  return <section className="home-view">
    <div className={`brain-stage phase-${phase}`} role="img" aria-label={`Cerebro Efesto: ${state.label}`}>
      <div className="brain-aura" /><Image src="/internet-brain-core.webp" alt="" width={1060} height={454} priority sizes="(max-width: 720px) 92vw, 720px" /><div className="brain-status"><span /><div><small>EFESTO BRAIN</small><strong>{state.label}</strong><p>{state.detail}</p></div></div>
    </div>
    <div className="home-copy"><h1>¿Qué quieres conseguir?</h1><p>Describe el resultado. Efesto prepara el trabajo, el Kernel aplica límites y solo conserva Evidence verificable.</p></div>

    {preparedGoal ? <section className="proposed-plan" aria-label="Plan propuesto"><header><span><Target /></span><div><small>PLAN PROPUESTO · AÚN NO EJECUTADO</small><h2>{preparedGoal}</h2></div></header><ol><li><b>1</b><span><strong>Crear Goal privado</strong><small>Persistido por el Kernel con este texto y palabras clave derivadas.</small></span></li><li><b>2</b><span><strong>Confirmar misión Hermes</strong><small>Cadencia manual, herramientas públicas y sin compras, logins ni formularios externos.</small></span></li><li><b>3</b><span><strong>Forjar Evidence y Finds</strong><small>Los resultados solo aparecen cuando vuelven por contratos verificables.</small></span></li></ol><div className="plan-actions"><button type="button" className="primary-action" disabled={!connected || goalPending} onClick={onConfirmGoal}>{goalPending ? 'Confirmando…' : connected ? 'Confirmar y ejecutar' : 'Conecta el Kernel para ejecutar'}</button><button type="button" className="secondary-action" onClick={onEditGoal}>Editar Goal</button></div></section>
      : <div className="starter-goals">{starterGoals.map((goal) => <button type="button" key={goal} onClick={() => { onChatMode(false); const textarea = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Goal"]'); if (textarea) { const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set; nativeSetter?.call(textarea, goal); textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.focus(); } }}><Sparkles /><span>{goal}</span><ChevronRight /></button>)}</div>}
    <p className="truth-note"><ShieldCheck /> Sin actividad decorativa: el cerebro cambia de estado usando conexión, streaming y fases persistidas de misión.</p>
  </section>;
}

function MissionsView({ snapshot, onNew }: { snapshot?: OverviewSnapshot; onNew: () => void }) {
  const missions = snapshot?.missions ?? [];
  const goals = snapshot?.goals ?? [];
  const goalName = (id: string) => goals.find((goal) => goal.id === id)?.title ?? id;
  return <Workspace icon={Target} eyebrow="Goal → Mission → Evidence" title="Missions" copy="Ejecuciones reales reclamadas por agentes bajo autoridad del Kernel." action={<button type="button" className="primary-action" onClick={onNew}><Target /> Nuevo Goal</button>}>
    {!snapshot ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para leer el ledger real de misiones." /> : missions.length === 0 ? <Empty icon={Target} title="No hay Missions" copy="Crea un Goal; no simulamos ejecuciones vacías." /> : <div className="record-list">{missions.map((mission) => <article key={mission.id}><div className="record-icon"><Target /></div><div><strong>{goalName(mission.goalId)}</strong><small>{mission.id} · intento {mission.attempt ?? 0}</small></div><StatePill state={mission.executionPhase ?? mission.status} /></article>)}</div>}
  </Workspace>;
}

function FindsView({ opportunities, connected, onFeedback }: { opportunities: OpportunitySummary[]; connected: boolean; onFeedback: (id: string, signal: 'useful' | 'saved' | 'dismissed' | 'not_interested') => Promise<void> }) {
  return <Workspace icon={Sparkles} eyebrow="Opportunity Intelligence" title="Finds" copy="Hallazgos priorizados por el Kernel. El feedback cambia preferencia, no Evidence objetiva.">
    {!connected ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para cargar Finds reales." /> : opportunities.length === 0 ? <Empty icon={Search} title="Aún no hay Finds" copy="Ejecuta un Goal público y los resultados promovidos aparecerán aquí." /> : <div className="find-grid">{opportunities.map((item) => <article key={item.id}><header><span>{item.categoryLabel}</span><StatePill state={item.status} /></header><h2>{item.title}</h2><p>{item.sourceHost} · relevancia {formatRelevance(item.relevance)}</p><div className="find-next"><small>Siguiente paso</small><strong>{item.nextAction}</strong></div><div className="find-actions"><button type="button" onClick={() => void onFeedback(item.id, 'useful')}><Check /> Útil</button><button type="button" onClick={() => void onFeedback(item.id, 'saved')}><History /> Guardar</button><button type="button" onClick={() => void onFeedback(item.id, 'dismissed')}><X /> Descartar</button></div></article>)}</div>}
  </Workspace>;
}

function EvidenceView({ cases, selectedId, detail, loadingId, connected, onOpen }: { cases: CaseSummary[]; selectedId: string; detail?: CaseDetail; loadingId: string; connected: boolean; onOpen: (record: CaseSummary) => void }) {
  return <Workspace icon={ShieldCheck} eyebrow="Cases · Sources · Provenance" title="Evidence" copy="Inspecciona recibos persistidos. Cada URL visible viene del Kernel.">
    {!connected ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para leer Cases y Evidence." /> : <div className="evidence-layout"><section className="case-list"><header><span>Cases</span><b>{cases.length}</b></header>{cases.length ? cases.map((record) => <button type="button" key={record.id} className={selectedId === record.id ? 'active' : ''} onClick={() => onOpen(record)}><FileSearch /><span><strong>{record.title}</strong><small>{record.status} · {record.id}</small></span><ChevronRight /></button>) : <Empty icon={FileSearch} title="Sin Cases" copy="El Kernel devolvió una colección vacía." />}</section><section className="evidence-detail">{!selectedId ? <Empty icon={ShieldCheck} title="Selecciona un Case" copy="Aquí aparecerán sus fuentes y recibos reales." /> : loadingId === selectedId ? <Empty icon={Activity} title="Leyendo Evidence" copy="Esperando respuesta del Kernel." /> : !detail ? <Empty icon={CircleOff} title="Evidence no disponible" copy="No inventamos una proyección cuando el endpoint no responde." /> : detail.evidence.length === 0 ? <Empty icon={ShieldCheck} title="Case sin Evidence publicada" copy="El Case existe, pero todavía no tiene recibos visibles." /> : <div className="evidence-receipts"><header><small>CASE</small><h2>{recordTitle(detail.case, selectedId)}</h2></header>{detail.evidence.map((item, index) => <article key={item.id ?? index}><ShieldCheck /><div><strong>{item.summary ?? item.id ?? `Evidence ${index + 1}`}</strong><small>{typeof item.confidence === 'number' ? `Confianza ${Math.round(item.confidence * 100)}%` : 'Confianza no publicada'}{item.capturedAt ? ` · ${formatDate(item.capturedAt)}` : ''}</small>{item.tags?.length ? <p>{item.tags.join(' · ')}</p> : null}</div>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">Abrir fuente <ExternalLink /></a> : <span className="source-missing">Sin URL publicada</span>}</article>)}</div>}</section></div>}
  </Workspace>;
}

function ModelsView({ providers, selectedProviderId, selectedModel, modelForge, connected, onSelect, onAdd }: { providers: Provider[]; selectedProviderId: string; selectedModel: string; modelForge?: OverviewSnapshot['readiness']['modelForge']; connected: boolean; onSelect: (providerId: string, model: string) => void; onAdd: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Workspace icon={BrainCircuit} eyebrow="Model Forge · Chat providers" title="Models" copy="Elige modelos configurados de verdad. Ningún modelo recibe autoridad sobre Memory.">
    {!connected ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para leer proveedores y Model Forge." /> : <div className="models-layout"><section className="model-list"><header><span>Disponibles</span><b>{providers.reduce((total, provider) => total + provider.models.length, 0)}</b></header>{providers.length ? providers.flatMap((provider) => provider.models.map((model) => <button type="button" className={provider.id === selectedProviderId && model === selectedModel ? 'active' : ''} key={`${provider.id}:${model}`} onClick={() => onSelect(provider.id, model)}><BrainCircuit /><span><strong>{model}</strong><small>{provider.label} · {provider.managedBy === 'environment' ? 'entorno privado' : 'Kernel local'}</small></span>{provider.id === selectedProviderId && model === selectedModel ? <Check /> : <ChevronRight />}</button>)) : <Empty icon={BrainCircuit} title="Sin modelos configurados" copy="Añade un proveedor real a la derecha." />}{modelForge ? <div className="forge-hardware"><small>MODEL FORGE</small><strong>{modelForge.runtime === 'available' ? `${modelForge.hardware.tier} · ${modelForge.hardware.ramGiB} GiB RAM` : 'Runtime no detectado'}</strong><span>Recomendado: {modelForge.recommended}</span></div> : null}</section><form className="provider-form" onSubmit={onAdd}><header><Plug /><div><small>KERNEL-OWNED</small><strong>Añadir proveedor</strong></div></header><label>Tipo<select name="type" defaultValue="openai-compatible"><option value="openai-compatible">OpenAI compatible</option><option value="ollama">Ollama local</option></select></label><label>Nombre<input name="label" required placeholder="OpenRouter, Groq, Ollama…" /></label><label>Endpoint<input name="baseUrl" type="url" required placeholder="https://api.example.com/v1" /></label><label>Modelos<input name="models" required placeholder="modelo-1, modelo-2" /></label><label>Credencial<input name="apiKey" type="password" autoComplete="off" placeholder="Opcional para Ollama" /></label><button type="submit" className="primary-action"><Plug /> Guardar en Kernel</button><p><ShieldCheck /> La credencial no se devuelve al navegador después de guardarla.</p></form></div>}
  </Workspace>;
}

function AgentsView({ snapshot, onSettings, onNewGoal }: { snapshot?: OverviewSnapshot; onSettings: () => void; onNewGoal: () => void }) {
  const hermes = snapshot?.readiness.bootstrap?.hermes;
  return <Workspace icon={Bot} eyebrow="Controlled execution" title="Agents" copy="Hermes y futuros agentes pueden ejecutar herramientas; el Kernel conserva la autoridad." action={<button type="button" className="secondary-action" onClick={onSettings}><Settings /> Configurar</button>}>
    <div className="agent-hero"><div className="agent-mark"><Bot /></div><div><small>NOUS RESEARCH</small><h2>Hermes Agent</h2><p>Discovery y ejecución acotada. Sus findings deben regresar por el bridge autenticado.</p></div><StatePill state={hermes === 'ready' ? 'ready' : hermes ?? 'offline'} /></div><div className="agent-contract"><span><b>Kernel</b>{snapshot?.readiness.kernel ?? 'offline'}</span><span><b>Hermes</b>{hermes ?? 'sin diagnóstico'}</span><span><b>Missions</b>{snapshot?.missions.length ?? 0}</span><span><b>Autoridad</b>Kernel-only</span></div><button type="button" className="primary-action" onClick={onNewGoal}><Target /> Preparar una misión</button>
  </Workspace>;
}

function AutomationsView({ missions, connected, onNewGoal }: { missions: MissionSummary[]; connected: boolean; onNewGoal: () => void }) {
  const withCadence = missions.filter((mission) => typeof mission.cadence === 'string');
  return <Workspace icon={Workflow} eyebrow="Persisted intents only" title="Automations" copy="Solo mostramos automatización que el Kernel puede demostrar. No hay toggles ni próximos runs inventados." action={<button type="button" className="primary-action" onClick={onNewGoal}><Target /> Nuevo Goal</button>}>
    {!connected ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para leer comportamientos persistidos." /> : <><div className="automation-cards"><article><Workflow /><div><strong>Mission Watchtower</strong><small>Observa transiciones reales de misiones.</small></div><StatePill state="available" /></article><article><ShieldCheck /><div><strong>Retries acotados</strong><small>Los intentos permanecen observables y limitados.</small></div><StatePill state="available" /></article></div>{withCadence.length ? <div className="record-list">{withCadence.map((mission) => <article key={mission.id}><div className="record-icon"><Workflow /></div><div><strong>{String(mission.cadence)}</strong><small>{mission.id}</small></div><StatePill state={mission.executionPhase ?? mission.status} /></article>)}</div> : <p className="truth-card"><ShieldCheck /> No hay recurrencias publicadas por el endpoint actual. Efesto no mostrará horarios ficticios.</p>}</>}
  </Workspace>;
}

function SettingsView({ connected, connecting, rememberSession, snapshot, onConnect, onDisconnect, onRefresh }: { connected: boolean; connecting: boolean; rememberSession: boolean; snapshot?: OverviewSnapshot; onConnect: (event: FormEvent<HTMLFormElement>) => void; onDisconnect: () => void; onRefresh: () => void }) {
  const bootstrap = snapshot?.readiness.bootstrap;
  return <Workspace icon={Settings} eyebrow="Owner control plane" title="Settings" copy="Conexión local, readiness y superficies de recuperación. Los secretos no se imprimen.">
    <div className="settings-layout"><form className="connection-card" onSubmit={onConnect}><header><span className={`kernel-dot ${connected ? 'online' : 'offline'}`} /><div><small>DISPOSITIVO ACTUAL</small><strong>{connected ? 'Autorizado' : 'Conectar Kernel'}</strong></div></header>{!connected ? <><label>URL del Kernel<input name="baseUrl" aria-label="URL del Kernel" type="url" defaultValue={DEFAULT_BASE_URL} required /></label><label>Token privado<input name="token" aria-label="Token privado" type="password" autoComplete="off" required /></label><label className="remember-row"><input name="rememberSession" type="checkbox" defaultChecked={rememberSession} /><span><strong>Recordar durante esta sesión</strong><small>Usa sessionStorage; se elimina al cerrar la sesión del navegador.</small></span></label><button type="submit" className="primary-action" disabled={connecting}>{connecting ? 'Conectando…' : 'Autorizar dispositivo'}</button></> : <div className="connection-actions"><button type="button" className="primary-action" onClick={onRefresh}><RefreshCw /> Comprobar ahora</button><button type="button" className="danger-action" onClick={onDisconnect}>Desconectar</button></div>}</form><section className="readiness-card"><header><ShieldCheck /><div><small>READINESS REAL</small><strong>{bootstrap?.overall ?? (connected ? 'connected' : 'offline')}</strong></div></header><ReadinessRow label="Kernel" value={bootstrap?.kernel ?? (connected ? 'ready' : 'offline')} ready={connected} /><ReadinessRow label="Hermes" value={bootstrap?.hermes ?? 'sin diagnóstico'} ready={bootstrap?.hermes === 'ready'} /><ReadinessRow label="Obsidian" value={bootstrap?.obsidian ?? 'sin configurar'} ready={bootstrap?.obsidian === 'ready'} /><ReadinessRow label="Extensión" value={bootstrap?.pairing ?? 'sin emparejar'} ready={bootstrap?.pairing === 'paired'} /><a href="http://127.0.0.1:4000/replay-lab" target="_blank" rel="noreferrer">Abrir Replay Lab <ExternalLink /></a></section></div>
  </Workspace>;
}

function BrainHeader({ phase }: { phase: BrainPhase }) { const state = brainState(phase); return <header className={`brain-header phase-${phase}`}><Image src="/internet-brain-core.webp" alt="" width={96} height={42} /><div><small>EFESTO LIVE</small><strong>{state.label}</strong><span>{state.detail}</span></div><i /></header>; }
function Workspace({ icon: Icon, eyebrow, title, copy, action, children }: { icon: typeof Target; eyebrow: string; title: string; copy: string; action?: ReactNode; children: ReactNode }) { return <section className="workspace"><header className="workspace-heading"><span><Icon /></span><div><small>{eyebrow}</small><h1>{title}</h1><p>{copy}</p></div>{action ? <div className="workspace-heading-action">{action}</div> : null}</header><div className="workspace-body">{children}</div></section>; }
function Empty({ icon: Icon, title, copy }: { icon: typeof Target; title: string; copy: string }) { return <div className="empty-state"><Icon /><strong>{title}</strong><p>{copy}</p></div>; }
function StatePill({ state }: { state: string }) { const tone = ['ready', 'completed', 'forged', 'available', 'new'].includes(state) ? 'good' : ['failed', 'invalid'].includes(state) ? 'bad' : ['running', 'investigating', 'verifying', 'queued', 'waiting_for_agent'].includes(state) ? 'working' : 'neutral'; return <span className={`state-pill ${tone}`}><i />{humanState(state)}</span>; }
function ReadinessRow({ label, value, ready }: { label: string; value: string; ready: boolean }) { return <div className="readiness-row"><span>{label}</span><strong className={ready ? 'ready' : ''}><i />{value}</strong></div>; }
function brainState(phase: BrainPhase) { if (phase === 'thinking') return { label: 'Conversando', detail: 'Modelo transmitiendo' }; if (phase === 'investigating') return { label: 'Investigando', detail: 'Hermes ejecutando una misión' }; if (phase === 'verifying') return { label: 'Verificando Evidence', detail: 'Kernel aplicando gates' }; if (phase === 'queued') return { label: 'Misión preparada', detail: 'Esperando agente' }; if (phase === 'forged') return { label: 'Evidence forjada', detail: 'Resultado persistido' }; if (phase === 'failed') return { label: 'Atención requerida', detail: 'La última misión falló' }; if (phase === 'ready') return { label: 'Forge ready', detail: 'Listo para un nuevo Goal' }; return { label: 'Modo local desconectado', detail: 'Sin actividad simulada' }; }
function humanState(value: string) { return value.replaceAll('_', ' '); }
function isActiveMission(mission: MissionSummary) { return ['waiting_for_agent', 'queued', 'running'].includes(mission.status) || ['queued', 'investigating', 'verifying'].includes(mission.executionPhase ?? ''); }
function keywordsFromGoal(value: string) { return Array.from(new Set(value.toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((word) => word.length > 2))).slice(0, 8); }
function slug(value: string) { return value.toLocaleLowerCase('en').replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || `provider-${Date.now()}`; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date); }
function formatRelevance(value: number) { return value <= 1 ? `${Math.round(value * 100)}%` : String(Math.round(value)); }
function viewLabel(view: View) { return nav.find((item) => item.id === view)?.label ?? 'Inicio'; }
function recordTitle(record: Record<string, unknown>, fallback: string) { return typeof record.title === 'string' ? record.title : typeof record.question === 'string' ? record.question : fallback; }
function connectionMessage(error: unknown) { if (error instanceof KernelClientError && error.code === 'UNAUTHORIZED') return 'El Kernel rechazó el token. No se guardó la credencial.'; if (error instanceof KernelClientError && error.code === 'TIMEOUT') return 'El Kernel tardó demasiado en responder.'; if (error instanceof KernelClientError && error.code === 'OFFLINE') return 'No se alcanzó el Kernel local. Comprueba que el Launcher esté activo.'; return 'No se pudo conectar. Revisa la URL local y el token.'; }
function parseObject(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid response'); return value as Record<string, unknown>; }
function parseOk(value: unknown) { const body = parseObject(value); if (body.ok !== true) throw new Error('Invalid response'); return body; }
function parseProviders(value: unknown): Provider[] { const body = parseOk(value); if (!Array.isArray(body.providers)) throw new Error('Invalid providers'); return body.providers.map((value) => { const item = parseObject(value); if (typeof item.id !== 'string' || typeof item.label !== 'string' || !Array.isArray(item.models) || !item.models.every((model) => typeof model === 'string')) throw new Error('Invalid provider'); return item as Provider; }); }
function parseCaseDetail(value: unknown): CaseDetail { const body = parseOk(value); const caseRecord = parseObject(body.case); if (!Array.isArray(body.evidence)) throw new Error('Invalid Evidence'); return { case: caseRecord, evidence: body.evidence.map((item) => parseObject(item) as EvidenceRecord) }; }
