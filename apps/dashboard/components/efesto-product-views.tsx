'use client';

import Image from 'next/image';
import {
  Activity, Bot, BrainCircuit, Check, ChevronRight, CircleOff, ExternalLink, FileSearch,
  History, Menu, MessageSquare, Pause, Plug, RefreshCw, Search, Send, Settings, ShieldCheck, Sparkles, Target, Workflow, X,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import type { CaseSummary, MissionSummary, ModelForgeSummary, OpportunitySummary } from '../lib/kernel/contracts';
import type { OverviewSnapshot } from '../lib/kernel/overview';

export type Provider = {
  id: string;
  type: 'ollama' | 'openai-compatible';
  label: string;
  baseUrl?: string;
  models: string[];
  hasCredential?: boolean;
  managedBy?: 'environment' | 'user';
};
export type ChatMessage = { role: 'user' | 'assistant'; content: string; model?: string };
export type EvidenceRecord = {
  id?: string; sourceUrl?: string; summary?: string; confidence?: number; capturedAt?: string;
  tags?: string[]; entityIds?: string[]; relationshipIds?: string[];
};
export type CaseDetail = { case: Record<string, unknown>; evidence: EvidenceRecord[] };
export type BrainPhase = 'offline' | 'ready' | 'queued' | 'investigating' | 'verifying' | 'forged' | 'thinking' | 'failed';

const starterGoals = [
  'Encuéntrame un taladro bueno en España entre 18 € y 25 €.',
  'Busca trabajos freelance remotos de 20–30 $/h o más.',
  'Investiga una empresa y dime qué afirmaciones están respaldadas por fuentes.',
  'Encuentra oportunidades públicas relevantes y evita duplicados.',
];

export function HomeView({ phase, chatMode, messages, preparedGoal, connected, goalPending, input, onInputChange, onSubmit, onToggleChat, chatPending, onStopChat, chatAvailable, submitDisabled, onConfirmGoal, onEditGoal, onStarterGoal, onStarterChat, onOpenModels, modelLabel, onOpenSettings, onOpenNav }: {
  phase: BrainPhase; chatMode: boolean; messages: ChatMessage[]; preparedGoal: string; connected: boolean; goalPending: boolean;
  input: string; onInputChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleChat: (value: boolean) => void; chatPending: boolean; onStopChat: () => void; chatAvailable: boolean; submitDisabled: boolean;
  onConfirmGoal: () => void; onEditGoal: () => void; onStarterGoal: (goal: string) => void; onStarterChat: (prompt: string) => void;
  onOpenModels: () => void; modelLabel: string; onOpenSettings: () => void; onOpenNav: () => void;
}) {
  const state = brainState(phase);
  const showSuggestions = chatMode ? messages.length === 0 : !preparedGoal;
  const surfaceTitle = chatMode
    ? (messages.length ? 'Conversación' : 'Nueva conversación')
    : (preparedGoal ? 'Goal preparado' : 'Nuevo Goal');

  return <section className={'forge-surface ' + (chatMode ? 'is-chat' : 'is-goal')} aria-label={chatMode ? 'Conversación con Efesto' : 'Nuevo Goal'}>
    <header className="forge-surface-bar">
      <div className="forge-surface-leading">
        <button type="button" className="forge-menu-button" onClick={onOpenNav} aria-label="Alternar navegación"><Menu /></button>
        <div className="forge-product-title">
          <span className="forge-agent-mark"><Image src="/efesto-smith.svg" alt="" width={28} height={28} /></span>
          <span><strong>{surfaceTitle}</strong><small>Efesto · {chatMode ? (chatAvailable ? modelLabel : 'modelo sin configurar') : 'misión controlada'}</small></span>
        </div>
      </div>

      <ModeSwitcher chatMode={chatMode} onToggleChat={onToggleChat} />

      <button type="button" className={'forge-state-action phase-' + phase} onClick={onOpenSettings} aria-label={connected ? 'Kernel conectado' : 'Conectar Kernel'}>
        <i />
        <span>{connected ? state.label : 'Conectar Kernel'}</span>
        <Plug />
      </button>
    </header>

    <div className="forge-scroll">
      {chatMode ? messages.length ? <section className="forge-thread" aria-label="Mensajes">
        {messages.map((message, index) => <article className={'forge-message ' + message.role} key={message.role + '-' + index}>
          <div className="forge-message-avatar">{message.role === 'user' ? 'Tú' : <Image src="/efesto-smith.svg" alt="" width={24} height={24} />}</div>
          <div className="forge-message-body">
            <header><strong>{message.role === 'user' ? 'Tú' : message.model ?? 'Efesto'}</strong>{message.role === 'assistant' ? <span><ShieldCheck /> Privado</span> : null}</header>
            <p>{message.content || (chatPending && index === messages.length - 1 ? <span className="forge-generating"><i />Pensando…</span> : null)}</p>
          </div>
        </article>)}
      </section> : <section className="forge-empty" aria-label="Nueva conversación">
        <span className="forge-empty-mark"><Image src="/efesto-smith.svg" alt="" width={52} height={52} /></span>
        <small>EFESTO · INTELLIGENCE FORGE</small>
        <h1>¿En qué trabajamos?</h1>
        <p>Pregunta, analiza o convierte una intención en un Goal cuando necesites una misión controlada.</p>
        <div className="forge-empty-meta"><span><ShieldCheck /> Privado por diseño</span><span><i /> Sin memoria automática</span></div>
      </section> : preparedGoal ? <section className="forge-goal-plan" aria-label="Plan propuesto">
        <header>
          <span className="forge-plan-icon"><Target /></span>
          <div><small>PLAN PROPUESTO · AÚN NO EJECUTADO</small><h1>{preparedGoal}</h1><p>Revisa el alcance antes de autorizar al Kernel.</p></div>
        </header>
        <ol>
          <li><b>1</b><span><strong>Crear Goal privado</strong><small>El Kernel conserva el objetivo y sus palabras clave.</small></span></li>
          <li><b>2</b><span><strong>Confirmar la misión</strong><small>La ejecución comienza solo después de tu autorización explícita.</small></span></li>
          <li><b>3</b><span><strong>Forjar Evidence y Finds</strong><small>Solo se muestran resultados respaldados por contratos verificables.</small></span></li>
        </ol>
        <div className="forge-plan-actions">
          <button type="button" className="primary-action" disabled={!connected || goalPending} onClick={onConfirmGoal}>{goalPending ? 'Confirmando…' : connected ? 'Confirmar y ejecutar' : 'Conecta el Kernel para ejecutar'}</button>
          <button type="button" className="secondary-action" onClick={onEditGoal}>Editar Goal</button>
        </div>
        <p className="forge-plan-boundary"><ShieldCheck /> Nada se ejecuta sin tu confirmación explícita.</p>
      </section> : <section className="forge-empty forge-goal-empty" aria-label="Crear un Goal">
        <span className="forge-empty-mark"><Target /></span>
        <small>EFESTO · CONTROLLED MISSION</small>
        <h1>Define el resultado</h1>
        <p>Efesto prepara el plan. Tú decides si se ejecuta.</p>
        <div className="forge-empty-meta"><span><ShieldCheck /> Kernel-gated</span><span><i /> Confirmación humana</span></div>
      </section>}
    </div>

    <ComposerForm
      input={input}
      chatMode={chatMode}
      chatAvailable={chatAvailable}
      chatPending={chatPending}
      submitDisabled={submitDisabled}
      suggestions={showSuggestions ? starterGoals : []}
      onSuggestion={chatMode ? onStarterChat : onStarterGoal}
      onInputChange={onInputChange}
      onSubmit={onSubmit}
      onStopChat={onStopChat}
      onOpenModels={onOpenModels}
      modelLabel={modelLabel}
    />
  </section>;
}

function ModeSwitcher({ chatMode, onToggleChat }: { chatMode: boolean; onToggleChat: (value: boolean) => void }) {
  return <div className="forge-mode-switcher" role="group" aria-label="Modo de trabajo">
    <button type="button" aria-pressed={chatMode} className={chatMode ? 'active' : ''} onClick={() => onToggleChat(true)}><MessageSquare /> <span>Chat</span></button>
    <button type="button" aria-pressed={!chatMode} className={!chatMode ? 'active' : ''} onClick={() => onToggleChat(false)}><Target /> <span>Goal</span></button>
  </div>;
}

function ComposerForm({ input, chatMode, chatAvailable, chatPending, submitDisabled, suggestions, onSuggestion, onInputChange, onSubmit, onStopChat, onOpenModels, modelLabel }: {
  input: string; chatMode: boolean; chatAvailable: boolean; chatPending: boolean; submitDisabled: boolean; suggestions: string[];
  onSuggestion: (value: string) => void; onInputChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStopChat: () => void; onOpenModels: () => void; modelLabel: string;
}) {
  return <div className={'forge-composer-zone ' + (suggestions.length ? 'has-suggestions' : '')}>
    {suggestions.length ? <div className="forge-quick-prompts" aria-label={chatMode ? 'Sugerencias para empezar' : 'Ideas para nuevos Goals'}>
      {suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => onSuggestion(suggestion)}>
        {chatMode ? <Sparkles /> : <Target />}
        <span>{suggestion}</span>
        <ChevronRight />
      </button>)}
    </div> : null}

    <form className={'forge-composer ' + (chatMode ? 'is-chat' : 'is-goal')} onSubmit={onSubmit}>
      <textarea
        aria-label={chatMode ? 'Mensaje' : 'Goal'}
        aria-describedby="forge-composer-note"
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
        rows={1}
        placeholder={chatMode ? (chatAvailable ? 'Pregunta lo que quieras…' : 'Configura un modelo para empezar…') : 'Describe el resultado que quieres conseguir…'}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <footer>
        <div className="forge-composer-context">
          {chatMode ? <button type="button" className="forge-model-button" onClick={onOpenModels}><Bot /><span>{chatAvailable ? modelLabel : 'Configurar modelo'}</span><Settings /></button> : <span className="forge-kernel-gate"><ShieldCheck /> Kernel-gated</span>}
        </div>
        <span className="forge-shortcut">Enter para enviar</span>
        {chatPending ? <button type="button" className="forge-send stop" onClick={onStopChat} aria-label="Detener generación"><Pause /></button> : <button type="submit" className="forge-send" disabled={submitDisabled} aria-label={chatMode ? 'Enviar mensaje' : 'Preparar Goal'}><Send /></button>}
      </footer>
    </form>
    <p className="forge-composer-hint" id="forge-composer-note">{chatMode ? 'La conversación permanece separada de Evidence y memoria.' : 'Preparar no ejecuta ninguna acción externa.'}</p>
  </div>;
}

export function MissionsView({ snapshot, onNew }: { snapshot?: OverviewSnapshot; onNew: () => void }) {
  const missions = snapshot?.missions ?? [];
  const goals = snapshot?.goals ?? [];
  const goalName = (id: string) => goals.find((goal) => goal.id === id)?.title ?? id;
  return <Workspace icon={Target} eyebrow="Goal → Mission → Evidence" title="Missions" copy="Ejecuciones reales reclamadas por agentes bajo autoridad del Kernel." action={<button type="button" className="primary-action" onClick={onNew}><Target /> Nuevo Goal</button>}>
    {!snapshot ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para leer el ledger real de misiones." /> : missions.length === 0 ? <Empty icon={Target} title="No hay Missions" copy="Crea un Goal; no simulamos ejecuciones vacías." /> : <div className="record-list">{missions.map((mission) => <article key={mission.id}><div className="record-icon"><Target /></div><div><strong>{goalName(mission.goalId)}</strong><small>{mission.id} · intento {mission.attempt ?? 0}</small></div><StatePill state={mission.executionPhase ?? mission.status} /></article>)}</div>}
  </Workspace>;
}

export function FindsView({ opportunities, connected, onFeedback }: { opportunities: OpportunitySummary[]; connected: boolean; onFeedback: (id: string, signal: 'useful' | 'saved' | 'dismissed' | 'not_interested') => void }) {
  return <Workspace icon={Sparkles} eyebrow="Opportunity Intelligence" title="Finds" copy="Hallazgos priorizados por el Kernel. El feedback cambia preferencia, no Evidence objetiva.">
    {!connected ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para cargar Finds reales." /> : opportunities.length === 0 ? <Empty icon={Search} title="Aún no hay Finds" copy="Ejecuta un Goal público y los resultados promovidos aparecerán aquí." /> : <div className="find-grid">{opportunities.map((item) => <article key={item.id}><header><span>{item.categoryLabel}</span><StatePill state={item.status} /></header><h2>{item.title}</h2><p>{item.sourceHost} · relevancia {formatRelevance(item.relevance)}</p><div className="find-next"><small>Siguiente paso</small><strong>{item.nextAction}</strong></div><div className="find-actions"><button type="button" onClick={() => onFeedback(item.id, 'useful')}><Check /> Útil</button><button type="button" onClick={() => onFeedback(item.id, 'saved')}><History /> Guardar</button><button type="button" onClick={() => onFeedback(item.id, 'dismissed')}><X /> Descartar</button></div></article>)}</div>}
  </Workspace>;
}

export function EvidenceView({ cases, selectedId, detail, loadingId, connected, onOpen }: { cases: CaseSummary[]; selectedId: string; detail?: CaseDetail; loadingId: string; connected: boolean; onOpen: (record: CaseSummary) => void }) {
  return <Workspace icon={ShieldCheck} eyebrow="Cases · Sources · Provenance" title="Evidence" copy="Inspecciona recibos persistidos. Cada URL visible viene del Kernel.">
    {!connected ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para leer Cases y Evidence." /> : <div className="evidence-layout"><section className="case-list"><header><span>Cases</span><b>{cases.length}</b></header>{cases.length ? cases.map((record) => <button type="button" key={record.id} className={selectedId === record.id ? 'active' : ''} onClick={() => onOpen(record)}><FileSearch /><span><strong>{record.title}</strong><small>{record.status} · {record.id}</small></span><ChevronRight /></button>) : <Empty icon={FileSearch} title="Sin Cases" copy="El Kernel devolvió una colección vacía." />}</section><section className="evidence-detail">{!selectedId ? <Empty icon={ShieldCheck} title="Selecciona un Case" copy="Aquí aparecerán sus fuentes y recibos reales." /> : loadingId === selectedId ? <Empty icon={Activity} title="Leyendo Evidence" copy="Esperando respuesta del Kernel." /> : !detail ? <Empty icon={CircleOff} title="Evidence no disponible" copy="No inventamos una proyección cuando el endpoint no responde." /> : detail.evidence.length === 0 ? <Empty icon={ShieldCheck} title="Case sin Evidence publicada" copy="El Case existe, pero todavía no tiene recibos visibles." /> : <div className="evidence-receipts"><header><small>CASE</small><h2>{recordTitle(detail.case, selectedId)}</h2></header>{detail.evidence.map((item, index) => <article key={item.id ?? index}><ShieldCheck /><div><strong>{item.summary ?? item.id ?? `Evidence ${index + 1}`}</strong><small>{typeof item.confidence === 'number' ? `Confianza ${Math.round(item.confidence * 100)}%` : 'Confianza no publicada'}{item.capturedAt ? ` · ${formatDate(item.capturedAt)}` : ''}</small>{item.tags?.length ? <p>{item.tags.join(' · ')}</p> : null}</div>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">Abrir fuente <ExternalLink /></a> : <span className="source-missing">Sin URL publicada</span>}</article>)}</div>}</section></div>}
  </Workspace>;
}

export function ModelsView({ providers, selectedProviderId, selectedModel, modelForge, connected, onSelect, onAdd }: { providers: Provider[]; selectedProviderId: string; selectedModel: string; modelForge?: ModelForgeSummary; connected: boolean; onSelect: (providerId: string, model: string) => void; onAdd: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Workspace icon={BrainCircuit} eyebrow="Model Forge · Chat providers" title="Models" copy="Elige modelos configurados de verdad. Ningún modelo recibe autoridad sobre Memory.">
    {!connected ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para leer proveedores y Model Forge." /> : <div className="models-layout"><section className="model-list"><header><span>Disponibles</span><b>{providers.reduce((total, provider) => total + provider.models.length, 0)}</b></header>{providers.length ? providers.flatMap((provider) => provider.models.map((model) => <button type="button" className={provider.id === selectedProviderId && model === selectedModel ? 'active' : ''} key={`${provider.id}:${model}`} onClick={() => onSelect(provider.id, model)}><BrainCircuit /><span><strong>{model}</strong><small>{provider.label} · {provider.managedBy === 'environment' ? 'entorno privado' : 'Kernel local'}</small></span>{provider.id === selectedProviderId && model === selectedModel ? <Check /> : <ChevronRight />}</button>)) : <Empty icon={BrainCircuit} title="Sin modelos configurados" copy="Añade un proveedor real a la derecha." />}{modelForge ? <div className="forge-hardware"><small>MODEL FORGE</small><strong>{modelForge.runtime === 'available' ? `${modelForge.hardware.tier} · ${modelForge.hardware.ramGiB} GiB RAM` : 'Runtime no detectado'}</strong><span>Recomendado: {modelForge.recommended}</span></div> : null}</section><form className="provider-form" onSubmit={onAdd}><header><Plug /><div><small>KERNEL-OWNED</small><strong>Añadir proveedor</strong></div></header><label>Tipo<select name="type" defaultValue="openai-compatible"><option value="openai-compatible">OpenAI compatible</option><option value="ollama">Ollama local</option></select></label><label>Nombre<input name="label" required placeholder="OpenRouter, Groq, Ollama…" /></label><label>Endpoint<input name="baseUrl" type="url" required placeholder="https://api.example.com/v1" /></label><label>Modelos<input name="models" required placeholder="modelo-1, modelo-2" /></label><label>Credencial<input name="apiKey" type="password" autoComplete="off" placeholder="Opcional para Ollama" /></label><button type="submit" className="primary-action"><Plug /> Guardar en Kernel</button><p><ShieldCheck /> La credencial no se devuelve al navegador después de guardarla.</p></form></div>}
  </Workspace>;
}

export function AgentsView({ snapshot, onSettings, onNewGoal }: { snapshot?: OverviewSnapshot; onSettings: () => void; onNewGoal: () => void }) {
  const hermes = snapshot?.readiness.bootstrap?.hermes;
  return <Workspace icon={Bot} eyebrow="Controlled execution" title="Agents" copy="Hermes y futuros agentes pueden ejecutar herramientas; el Kernel conserva la autoridad." action={<button type="button" className="secondary-action" onClick={onSettings}><Settings /> Configurar</button>}>
    <div className="agent-hero"><div className="agent-mark"><Bot /></div><div><small>NOUS RESEARCH</small><h2>Hermes Agent</h2><p>Discovery y ejecución acotada. Sus findings deben regresar por el bridge autenticado.</p></div><StatePill state={hermes === 'ready' ? 'ready' : hermes ?? 'offline'} /></div><div className="agent-contract"><span><b>Kernel</b>{snapshot?.readiness.kernel ?? 'offline'}</span><span><b>Hermes</b>{hermes ?? 'sin diagnóstico'}</span><span><b>Missions</b>{snapshot?.missions.length ?? 0}</span><span><b>Autoridad</b>Kernel-only</span></div><button type="button" className="primary-action" onClick={onNewGoal}><Target /> Preparar una misión</button>
  </Workspace>;
}

export function AutomationsView({ missions, connected, onNewGoal }: { missions: MissionSummary[]; connected: boolean; onNewGoal: () => void }) {
  const withCadence = missions.filter((mission) => typeof mission.cadence === 'string');
  return <Workspace icon={Workflow} eyebrow="Persisted intents only" title="Automations" copy="Solo mostramos automatización que el Kernel puede demostrar. No hay toggles ni próximos runs inventados." action={<button type="button" className="primary-action" onClick={onNewGoal}><Target /> Nuevo Goal</button>}>
    {!connected ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para leer comportamientos persistidos." /> : <><div className="automation-cards"><article><Workflow /><div><strong>Mission Watchtower</strong><small>Observa transiciones reales de misiones.</small></div><StatePill state="available" /></article><article><ShieldCheck /><div><strong>Retries acotados</strong><small>Los intentos permanecen observables y limitados.</small></div><StatePill state="available" /></article></div>{withCadence.length ? <div className="record-list">{withCadence.map((mission) => <article key={mission.id}><div className="record-icon"><Workflow /></div><div><strong>{String(mission.cadence)}</strong><small>{mission.id}</small></div><StatePill state={mission.executionPhase ?? mission.status} /></article>)}</div> : <p className="truth-card"><ShieldCheck /> No hay recurrencias publicadas por el endpoint actual. Efesto no mostrará horarios ficticios.</p>}</>}
  </Workspace>;
}

export function SettingsView({ connected, connecting, rememberSession, snapshot, onConnect, onDisconnect, onRefresh }: { connected: boolean; connecting: boolean; rememberSession: boolean; snapshot?: OverviewSnapshot; onConnect: (event: FormEvent<HTMLFormElement>) => void; onDisconnect: () => void; onRefresh: () => void }) {
  const bootstrap = snapshot?.readiness.bootstrap;
  return <Workspace icon={Settings} eyebrow="Owner control plane" title="Settings" copy="Conexión local, readiness y recuperación. Los secretos no se imprimen.">
    <div className="settings-layout"><form className="connection-card" onSubmit={onConnect}><header><span className={`kernel-dot ${connected ? 'online' : 'offline'}`} /><div><small>DISPOSITIVO ACTUAL</small><strong>{connected ? 'Autorizado' : 'Conectar Kernel'}</strong></div></header>{!connected ? <><label>URL del Kernel<input name="baseUrl" aria-label="URL del Kernel" type="url" defaultValue="http://127.0.0.1:4000" required /></label><label>Token privado<input name="token" aria-label="Token privado" type="password" autoComplete="off" placeholder="Opcional si usas pairing" /></label><label>Código de emparejamiento<input name="pairingCode" aria-label="Código de emparejamiento" inputMode="text" autoComplete="off" placeholder="ABCD-1234" /></label><label className="remember-row"><input name="rememberSession" type="checkbox" defaultChecked={rememberSession} /><span><strong>Recordar durante esta sesión</strong><small>sessionStorage; no persistencia indefinida.</small></span></label><div className="connection-actions"><button type="submit" name="action" value="pair" className="primary-action" disabled={connecting}>{connecting ? 'Emparejando…' : 'Emparejar con código'}</button><button type="submit" name="action" value="token" className="secondary-action" disabled={connecting}>Autorizar dispositivo</button></div></> : <div className="connection-actions"><button type="button" className="primary-action" onClick={onRefresh}><RefreshCw /> Comprobar ahora</button><button type="button" className="danger-action" onClick={onDisconnect}>Desconectar</button></div>}</form><section className="readiness-card"><header><ShieldCheck /><div><small>READINESS REAL</small><strong>{bootstrap?.overall ?? (connected ? 'connected' : 'offline')}</strong></div></header><ReadinessRow label="Kernel" value={bootstrap?.kernel ?? (connected ? 'ready' : 'offline')} ready={connected} /><ReadinessRow label="Hermes" value={bootstrap?.hermes ?? 'sin diagnóstico'} ready={bootstrap?.hermes === 'ready'} /><ReadinessRow label="Obsidian" value={bootstrap?.obsidian ?? 'sin configurar'} ready={bootstrap?.obsidian === 'ready'} /><ReadinessRow label="Extensión" value={bootstrap?.pairing ?? 'sin emparejar'} ready={bootstrap?.pairing === 'paired'} /><a href="http://127.0.0.1:4000/replay-lab" target="_blank" rel="noreferrer">Abrir Replay Lab <ExternalLink /></a></section></div>
  </Workspace>;
}

function Workspace({ icon: Icon, eyebrow, title, copy, action, children }: { icon: typeof Target; eyebrow: string; title: string; copy: string; action?: ReactNode; children: ReactNode }) { return <section className="workspace"><header className="workspace-heading"><span><Icon /></span><div><small>{eyebrow}</small><h1>{title}</h1><p>{copy}</p></div>{action ? <div className="workspace-heading-action">{action}</div> : null}</header><div className="workspace-body">{children}</div></section>; }
function Empty({ icon: Icon, title, copy }: { icon: typeof Target; title: string; copy: string }) { return <div className="empty-state"><Icon /><strong>{title}</strong><p>{copy}</p></div>; }
function StatePill({ state }: { state: string }) { const tone = ['ready', 'completed', 'forged', 'available', 'new'].includes(state) ? 'good' : ['failed', 'invalid'].includes(state) ? 'bad' : ['running', 'investigating', 'verifying', 'queued', 'waiting_for_agent'].includes(state) ? 'working' : 'neutral'; return <span className={`state-pill ${tone}`}><i />{state.replaceAll('_', ' ')}</span>; }
function ReadinessRow({ label, value, ready }: { label: string; value: string; ready: boolean }) { return <div className="readiness-row"><span>{label}</span><strong className={ready ? 'ready' : ''}><i />{value}</strong></div>; }
export function brainState(phase: BrainPhase) { if (phase === 'thinking') return { label: 'Conversando', detail: 'Modelo transmitiendo' }; if (phase === 'investigating') return { label: 'Investigando', detail: 'Hermes ejecutando una misión' }; if (phase === 'verifying') return { label: 'Verificando Evidence', detail: 'Kernel aplicando gates' }; if (phase === 'queued') return { label: 'Misión preparada', detail: 'Esperando agente' }; if (phase === 'forged') return { label: 'Evidence forjada', detail: 'Resultado persistido' }; if (phase === 'failed') return { label: 'Atención requerida', detail: 'La última misión falló' }; if (phase === 'ready') return { label: 'Forge ready', detail: 'Listo para un nuevo Goal' }; return { label: 'Modo local desconectado', detail: 'Sin actividad simulada' }; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date); }
function formatRelevance(value: number) { return value <= 1 ? `${Math.round(value * 100)}%` : String(Math.round(value)); }
function recordTitle(record: Record<string, unknown>, fallback: string) { return typeof record.title === 'string' ? record.title : typeof record.question === 'string' ? record.question : fallback; }
