'use client';

import { LOCALE_NAMES, LOCALES, setLocale, t, useLocale, type MessageKey } from '../lib/i18n';
import type { GoalEditRequest } from './forge/goal-edit-sheet';
import { hermesReadiness } from '../lib/kernel/agent-connection-copy';
import { EfestoMark } from './brand/efesto-mark';
import { HomeWallpaper } from './home/home-wallpaper';
import {
  Activity, Bot, BrainCircuit, Check, ChevronDown, ChevronRight, CircleOff, Database, ExternalLink, FileSearch, Globe,
  History, Lightbulb, Menu, MessageSquare, Pause, Plug, RefreshCw, Search, ArrowUp, Send, Settings, ShieldCheck, Sparkles, Target, Workflow, X,
} from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import type { CaseSummary, MissionSummary, ModelForgeSummary, OpportunitySummary } from '../lib/kernel/contracts';
import type { OverviewSnapshot } from '../lib/kernel/overview';
import { countMissionKernelSupportedFinds, isKernelSupportedFind, kernelSupportProof, kernelSupportedFinds, missionVerifiedWithoutSupport } from '../lib/kernel/supported-find';
import { statePillLabel, statePillTone } from '../lib/ui/state-pill-label.mjs';
import { normalizeKernelBaseUrl } from '../lib/kernel/url';
import { displayText, type ForgeModel } from '../lib/forge/forge-model';
import { ForgeLiveView } from './forge/forge-live-view';
import { KernelIdChip } from './kernel-id-chip';
import { findCategoryEs, findNextActionEs } from '../lib/finds/find-copy';
import { AgentConnector } from './agents/agent-connector';
import type { AgentsSnapshot } from '../lib/kernel/agents';

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
export type BrainPhase = 'offline' | 'ready' | 'queued' | 'investigating' | 'verifying' | 'verified_unsupported' | 'forged' | 'completed' | 'thinking' | 'failed' | 'blocked' | 'unavailable';

const starterGoals = [
  'Encuentra las mejores herramientas para mi negocio',
  'Encuentra oportunidades que coincidan con mi perfil',
  'Investiga esta empresa',
  'Supervisa este mercado',
  'Compara estas tecnologías',
  'Encuentra alternativas más baratas',
  'Investiga este tema',
  'Ayúdame a tomar una decisión',
];

export function HomeView({ phase, chatMode, messages, preparedGoal, connected, goalPending, input, onInputChange, onSubmit, onToggleChat, chatPending, onStopChat, chatAvailable, submitDisabled, onConfirmGoal, onEditGoal, onStarterGoal, onStarterChat, onOpenModels, modelLabel, providers, selectedProviderId, selectedModel, onSelectModel, onOpenSettings, onOpenNav, navExpanded, supportedFinds = [], forgeSupportedFindCount = 0, missions, onFindFeedback, onOpenCase, forgeModel, onOpenFinds, onRelaunchMission, relaunchPending = false, onSearchMore, onReviseGoal, onOpenConnections, onOpenView }: {
  phase: BrainPhase; chatMode: boolean; messages: ChatMessage[]; preparedGoal: string; connected: boolean; goalPending: boolean;
  input: string; onInputChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleChat: (value: boolean) => void; chatPending: boolean; onStopChat: () => void; chatAvailable: boolean; submitDisabled: boolean;
  onConfirmGoal: () => void; onEditGoal: () => void; onStarterGoal: (goal: string) => void; onStarterChat: (prompt: string) => void;
  onOpenModels: () => void; modelLabel: string; providers: Provider[]; selectedProviderId: string; selectedModel: string;
  onSelectModel: (providerId: string, model: string) => void; onOpenSettings: () => void; onOpenNav: (opener?: HTMLElement) => void; navExpanded?: boolean;
  /** Top connector: Kernel + agent connection sheet (only once a Kernel is connected). */
  onOpenConnections?: () => void;
  /** Opens an existing product area from the home chip row. */
  onOpenView?: (view: HomeChipView) => void;
  supportedFinds?: OpportunitySummary[];
  /** Focused-mission SUPPORT count (Living Forge). Not global inbox length. */
  forgeSupportedFindCount?: number;
  missions?: readonly MissionSummary[];
  onFindFeedback?: (id: string, signal: 'useful' | 'saved' | 'dismissed' | 'not_interested') => void;
  onOpenCase?: (caseId: string) => void;
  /** Forge live view of the focused Kernel mission (real data only). */
  forgeModel?: ForgeModel;
  onOpenFinds?: () => void;
  /** Re-confirm a stalled mission through the Goal missions endpoint (same as confirming a Goal). */
  onRelaunchMission?: (goalId: string) => void;
  relaunchPending?: boolean;
  onSearchMore?: (goalId: string) => void;
  /** "Editar Goal" on a confirmed Goal: a Kernel Goal revision (resolves true when accepted). */
  onReviseGoal?: (request: GoalEditRequest) => Promise<boolean>;
}) {
  // The forge replaces the "¿Qué estás buscando?" hero only while a real Kernel mission exists.
  const showForge = !chatMode && !preparedGoal && connected && forgeModel?.kind === 'mission';
  // Fail-close: forge-state-action uses focused GoalSurface mission SUPPORT
  // (findCount / verificationResults via countMissionKernelSupportedFinds), never
  // global supportedFinds.length — older inbox must not brand zero-SUPPORT forged.
  const state = brainState(phase, forgeSupportedFindCount);
  // Fail-close chrome: zero-SUPPORT forged must not keep phase-forged (green Completado
  // lookalike) while label is Investigación terminada. Mirror extension orb / Agent Hub
  // research_completed neutral chrome; SUPPORT forged keeps phase-forged green.
  // workState=completed (completed-without-Evidence) must not keep phase-ready green
  // "Forja lista" Completado lookalike — Actividad already uses Terminada sin Evidence.
  const chromePhase = (phase === 'forged' && forgeSupportedFindCount === 0) || phase === 'completed' || phase === 'verified_unsupported'
    ? 'research_completed'
    : phase;
  // GoalSurface findCount can prove SUPPORT while inbox is empty (dismissed / not loaded).
  // surfaceTitle + empty body must not say Nuevo Goal beside Find SUPPORT forjado.
  const focusedMissionHasSupport = forgeSupportedFindCount > 0;
  const showSuggestions = chatMode
    ? messages.length === 0
    : !preparedGoal && !showForge && supportedFinds.length === 0 && !focusedMissionHasSupport;
  const surfaceTitle = chatMode
    ? (messages.length ? 'Conversación' : 'Nueva conversación')
    // Fail-close chrome: inbox SUPPORT Finds OR focused-mission findCount — never bare Hallazgo útil.
    : (preparedGoal ? 'Goal preparado' : showForge ? 'Misión del Kernel' : (supportedFinds.length || focusedMissionHasSupport) ? 'Hallazgo · Kernel SUPPORT' : 'Nuevo Goal');
  const surfaceAria = chatMode
    ? 'Conversación con Efesto'
    : (preparedGoal ? 'Goal preparado' : showForge ? 'Misión del Kernel' : (supportedFinds.length || focusedMissionHasSupport) ? 'Hallazgos Kernel SUPPORT' : 'Nuevo Goal');

  // With a live forge the composer follows the forge in the scroll (the forge fills the first
  // viewport, as in the approved v3 mockup); otherwise it stays docked under the conversation.
  const composer = <ComposerForm
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
    providers={providers}
    selectedProviderId={selectedProviderId}
    selectedModel={selectedModel}
    connected={connected}
    onSelectModel={onSelectModel}
    onOpenSettings={onOpenSettings}
    chips={showForge ? null : <>
      <div className="forge-composer-tray" aria-label="Acciones del Kernel">
        {onOpenFinds ? <button type="button" onClick={onOpenFinds}><Sparkles aria-hidden="true" />{t('home.chipFinds')}</button> : null}
        <button type="button" onClick={onOpenModels}><BrainCircuit aria-hidden="true" />{t('home.chipModels')}</button>
      </div>
      {onOpenView ? <PageChips onOpenView={onOpenView} /> : null}
    </>}
  />;

  return <section className={'forge-surface ' + (chatMode ? 'is-chat' : 'is-goal') + (showForge ? ' has-forge' : '') + (showSuggestions && !chatMode ? ' is-idle' : '')} aria-label={surfaceAria}>
    {showSuggestions && !chatMode ? <HomeWallpaper /> : null}
    <header className="forge-surface-bar">
      <div className="forge-surface-leading">
        <button type="button" className="forge-menu-button" onClick={(event) => onOpenNav(event.currentTarget)} aria-label="Alternar navegación" aria-controls="efesto-sidebar" aria-expanded={navExpanded}>
          <Menu className="forge-menu-icon" aria-hidden="true" />
          <span className="forge-menu-brand" aria-hidden="true"><EfestoMark size={30} /><b>EFESTO</b></span>
        </button>
        <div className="forge-product-title">
          <span className="forge-agent-mark"><EfestoMark size={28} /></span>
          <span className="forge-crumb">{chatMode ? 'Chat' : 'Inicio'}<i aria-hidden="true">/</i><strong>{surfaceTitle}</strong></span>
        </div>
      </div>

      <ModeSwitcher chatMode={chatMode} onToggleChat={onToggleChat} />

      <button type="button" className={'forge-state-action phase-' + chromePhase} onClick={connected && onOpenConnections ? onOpenConnections : onOpenSettings} aria-label={connected ? 'Kernel conectado' : 'Conectar Kernel'} aria-haspopup={connected && onOpenConnections ? 'dialog' : undefined}>
        <i />
        <span>{connected ? state.label : 'Conectar Kernel'}</span>
        <Plug aria-hidden="true" />
      </button>
    </header>

    <div className="forge-scroll">
      {chatMode ? messages.length ? <section className="forge-thread" aria-label="Mensajes">
        {messages.map((message, index) => <article className={'forge-message ' + message.role} key={message.role + '-' + index}>
          <div className="forge-message-avatar">{message.role === 'user' ? 'Tú' : <EfestoMark size={24} simple />}</div>
          <div className="forge-message-body">
            <header><strong>{message.role === 'user' ? 'Tú' : message.model ?? 'Efesto'}</strong>{message.role === 'assistant' ? <span><ShieldCheck /> Privado</span> : null}</header>
            <p>{message.content || (chatPending && index === messages.length - 1 ? <span className="forge-generating"><i />Pensando…</span> : null)}</p>
          </div>
        </article>)}
      </section> : <section className="forge-empty" aria-label="Nueva conversación">
        <span className="forge-empty-mark"><EfestoMark size={52} /></span>
        <small>EFESTO · INTELLIGENCE FORGE</small>
        <h1>¿En qué trabajamos?</h1>
        <p>Pregunta, analiza o convierte una intención en un Goal cuando necesites una misión controlada.</p>
        <div className="forge-empty-meta"><span><ShieldCheck /> Controlado por el Kernel</span><span><i /> Confirmación humana</span></div>
      </section> : preparedGoal ? <section className="forge-goal-plan" aria-label="Plan propuesto">
        <header>
          <span className="forge-plan-icon"><Target /></span>
          <div><small>PLAN PROPUESTO · AÚN NO EJECUTADO</small><h1>{preparedGoal}</h1><p>Revisa el alcance antes de autorizar al Kernel.</p></div>
        </header>
        <ol>
          <li><b>1</b><span><strong>Crear Goal privado</strong><small>El Kernel conserva el objetivo y sus palabras clave.</small></span></li>
          <li><b>2</b><span><strong>Confirmar la misión</strong><small>La ejecución comienza solo después de tu autorización explícita.</small></span></li>
          <li><b>3</b><span><strong>Forjar Evidence · Finds SUPPORT</strong><small>Forjar Evidence no es un Find. Solo aparecen hallazgos con Kernel SUPPORT.</small></span></li>
        </ol>
        <div className="forge-plan-actions">
          <button type="button" className="primary-action" disabled={!connected || goalPending} onClick={onConfirmGoal}>{goalPending ? 'Confirmando…' : connected ? 'Confirmar y ejecutar' : 'Conecta el Kernel para ejecutar'}</button>
          <button type="button" className="secondary-action" onClick={onEditGoal}>Editar Goal</button>
        </div>
        <p className="forge-plan-boundary"><ShieldCheck /> Nada se ejecuta sin tu confirmación explícita.</p>
      </section> : <>
      {showForge && forgeModel ? <div className="forge-home-live">
        <ForgeLiveView model={forgeModel} onOpenFinds={onOpenFinds} onRelaunch={onRelaunchMission} relaunchPending={relaunchPending} onSearchMore={onSearchMore} onEditGoal={onReviseGoal} headingId="forge-home-live-title" />
      </div> : null}
      {(supportedFinds.length || focusedMissionHasSupport) ? <section className="forge-home-finds" aria-label="Hallazgos respaldados por el Kernel">
        <header>
          <small>FIND · KERNEL SUPPORT</small>
          <h1>Hallazgo · Kernel SUPPORT</h1>
          <p>{supportedFinds.length
            ? 'Resultado persistido por el Kernel: título, fuente y procedencia SUPPORT. Un snippet de Hermes no aparece aquí.'
            : 'La misión enfocada forjó Kernel SUPPORT (GoalSurface findCount). El inbox no muestra Finds visibles ahora (vacío, filtrado o descartado).'}</p>
        </header>
        {supportedFinds.length
          ? <div className="find-grid">{supportedFinds.map((item) => <FindCard key={item.id} item={item} missions={missions} onFeedback={onFindFeedback ?? (() => undefined)} onOpenCase={onOpenCase} />)}</div>
          : <p className="truth-card"><ShieldCheck /> Find SUPPORT forjado en la misión; sin tarjetas de inbox que mostrar.</p>}
      </section> : showForge ? null : <section className="forge-empty forge-goal-empty" aria-label="Crear un Goal">
        <h1 className="forge-wordmark"><EfestoMark size={46} /><ForgedWordmark /><span className="forge-sr-only">¿Qué estás buscando?</span></h1>
        <p className="forge-goal-lede">{t('home.lede')}</p>
      </section>}
      {showForge ? composer : null}
      </>}
    </div>

    {showForge ? null : composer}
  </section>;
}

/**
 * EFESTO forged from red-hot metal: each letter cools from molten to steel once on load; the F stays
 * lit like an ember with a few sparks. Pure CSS (opacity/transform/filter on 6 letters + 4 dots),
 * disabled under prefers-reduced-motion (efesto-home-v2.css). Decorative only.
 */
export function ForgedWordmark() {
  return <b className="forge-forged" aria-hidden="true">
    {'EFESTO'.split('').map((letter, index) => <span key={index} className={index === 1 ? 'fx-l fx-ember' : 'fx-l'} style={{ '--i': index } as CSSProperties}>
      {letter}
      {index === 1 ? <span className="fx-sparks">{[0, 1, 2, 3].map((n) => <i key={n} style={{ '--n': n } as CSSProperties} />)}</span> : null}
    </span>)}
  </b>;
}

export type HomeChipView = 'goals' | 'evidence' | 'memory' | 'activity' | 'agents';
const homeChips: { id: HomeChipView; label: string; icon: typeof Target }[] = [
  { id: 'goals', label: 'Objetivos', icon: Target },
  { id: 'evidence', label: 'Evidencia', icon: ShieldCheck },
  { id: 'memory', label: 'Memoria', icon: Database },
  { id: 'activity', label: 'Actividad', icon: Activity },
  { id: 'agents', label: 'Agentes', icon: Bot },
];

function PageChips({ onOpenView }: { onOpenView: (view: HomeChipView) => void }) {
  const rowRef = useRef<HTMLDivElement>(null);
  return <div className="forge-page-chips">
    <div className="forge-page-chips-row" ref={rowRef} role="group" aria-label="Ir a">
      {homeChips.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => onOpenView(id)}><Icon aria-hidden="true" />{label}</button>)}
    </div>
    <button type="button" className="forge-page-chips-more" aria-label="Más accesos" onClick={() => rowRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}><ChevronRight aria-hidden="true" /></button>
  </div>;
}

function ModeSwitcher({ chatMode, onToggleChat }: { chatMode: boolean; onToggleChat: (value: boolean) => void }) {
  return <div className="forge-mode-switcher" role="group" aria-label="Modo de trabajo">
    <button type="button" aria-pressed={chatMode} className={chatMode ? 'active' : ''} onClick={() => onToggleChat(true)}><MessageSquare /> <span>Chat</span></button>
    <button type="button" aria-pressed={!chatMode} className={!chatMode ? 'active' : ''} onClick={() => onToggleChat(false)}><Target /> <span>Goal</span></button>
  </div>;
}

function ComposerForm({ input, chatMode, chatAvailable, chatPending, submitDisabled, suggestions, onSuggestion, onInputChange, onSubmit, onStopChat, onOpenModels, modelLabel, providers, selectedProviderId, selectedModel, connected, onSelectModel, onOpenSettings, chips }: {
  input: string; chatMode: boolean; chatAvailable: boolean; chatPending: boolean; submitDisabled: boolean; suggestions: string[];
  onSuggestion: (value: string) => void; onInputChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStopChat: () => void; onOpenModels: () => void; modelLabel: string; providers: Provider[]; selectedProviderId: string; selectedModel: string;
  connected: boolean; onSelectModel: (providerId: string, model: string) => void; onOpenSettings: () => void; chips?: ReactNode;
}) {
  const [ideasOpen, setIdeasOpen] = useState(false);
  return <div className={'forge-composer-zone ' + (suggestions.length ? 'has-suggestions' : '')}>
    {suggestions.length && ideasOpen ? <div className="forge-quick-prompts" id="forge-ideas" aria-label={chatMode ? 'Sugerencias para empezar' : 'Ideas para nuevos Goals'}>
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
        placeholder={chatMode ? (chatAvailable ? t('home.placeholderChat') : t('home.placeholderNoModel')) : t('home.placeholderGoal')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <footer>
        <div className="forge-composer-context">
          {chatMode ? <ModelSelector
            providers={providers}
            selectedProviderId={selectedProviderId}
            selectedModel={selectedModel}
            connected={connected}
            chatAvailable={chatAvailable}
            modelLabel={modelLabel}
            onSelectModel={onSelectModel}
            onOpenModels={onOpenModels}
            onOpenSettings={onOpenSettings}
          /> : null}
        </div>
        {chatMode ? null : <span className="forge-mode-label">Goal <span>{t('home.modeVerified')}</span></span>}
        {chatPending ? <button type="button" className="forge-send stop" onClick={onStopChat} aria-label="Detener generación"><Pause /></button> : <button type="submit" className="forge-send" disabled={submitDisabled} aria-label={chatMode ? 'Enviar mensaje' : 'Preparar Goal'}><ArrowUp /></button>}
      </footer>
    </form>
    <p className="forge-composer-hint" id="forge-composer-note">{chatMode ? 'La conversación permanece separada de Evidence y memoria.' : 'Preparar no ejecuta ninguna acción externa.'}</p>
    {chips}
    {suggestions.length ? <button type="button" className="forge-explore-ideas" aria-expanded={ideasOpen} aria-controls="forge-ideas" onClick={() => setIdeasOpen((open) => !open)}><Lightbulb aria-hidden="true" />{ideasOpen ? 'Ocultar ideas' : 'Explorar ideas'}</button> : null}
  </div>;
}

function ModelSelector({ providers, selectedProviderId, selectedModel, connected, chatAvailable, modelLabel, onSelectModel, onOpenModels, onOpenSettings }: {
  providers: Provider[]; selectedProviderId: string; selectedModel: string; connected: boolean; chatAvailable: boolean; modelLabel: string;
  onSelectModel: (providerId: string, model: string) => void; onOpenModels: () => void; onOpenSettings: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const modelCount = providers.reduce((total, provider) => total + provider.models.length, 0);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleProviders = providers
    .map((provider) => ({
      ...provider,
      models: provider.models.filter((model) => (provider.label + ' ' + model).toLocaleLowerCase().includes(normalizedQuery)),
    }))
    .filter((provider) => provider.models.length > 0);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const closeAndRun = (action: () => void) => {
    setOpen(false);
    setQuery('');
    action();
  };

  return <div className="forge-model-control" ref={rootRef}>
    <button
      type="button"
      className={'forge-model-button ' + (chatAvailable ? 'has-model' : 'needs-model')}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="forge-model-selector"
      onClick={() => {
        if (open) setQuery('');
        setOpen(!open);
      }}
    >
      <Bot />
      <span className="forge-model-trigger-label">{chatAvailable ? modelLabel : connected ? 'Elegir modelo' : 'Configurar modelo'}</span>
      <ChevronDown className="forge-model-chevron" />
    </button>

    {open ? <section className="forge-model-popover" id="forge-model-selector" role="dialog" aria-label="Seleccionar modelo">
      <header className="forge-model-popover-header">
        <span><small>MODELOS DEL KERNEL</small><strong>{connected ? modelCount === 1 ? '1 modelo disponible' : modelCount + ' modelos disponibles' : 'Kernel sin conexión'}</strong></span>
        <button type="button" onClick={() => { setOpen(false); setQuery(''); }} aria-label="Cerrar selector"><X /></button>
      </header>

      {!connected ? <div className="forge-model-empty">
        <span><Plug /></span>
        <strong>Conecta el Kernel</strong>
        <p>El selector solo carga proveedores y modelos configurados de verdad.</p>
        <button type="button" onClick={() => closeAndRun(onOpenSettings)}>Conectar Kernel</button>
      </div> : modelCount === 0 ? <div className="forge-model-empty">
        <span><BrainCircuit /></span>
        <strong>Sin modelos configurados</strong>
        <p>Añade un proveedor para habilitar el chat privado de Efesto.</p>
        <button type="button" onClick={() => closeAndRun(onOpenModels)}>Gestionar proveedores</button>
      </div> : <>
        <label className="forge-model-search">
          <Search />
          <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar modelo…" aria-label="Buscar modelo" />
        </label>
        <div className="forge-model-list" role="listbox" aria-label="Modelos disponibles">
          {visibleProviders.length ? visibleProviders.map((provider) => <div className="forge-model-provider" role="group" aria-label={provider.label} key={provider.id}>
            <header><span>{provider.label}</span><small>{provider.type === 'ollama' ? 'Ollama local' : 'API compatible'}</small></header>
            {provider.models.map((model) => {
              const active = provider.id === selectedProviderId && model === selectedModel;
              return <button
                type="button"
                className={'forge-model-option ' + (active ? 'active' : '')}
                role="option"
                aria-selected={active}
                key={provider.id + ':' + model}
                onClick={() => closeAndRun(() => onSelectModel(provider.id, model))}
              >
                <span className="forge-model-option-icon"><BrainCircuit /></span>
                <span><strong>{model}</strong><small>{provider.managedBy === 'environment' ? 'Entorno privado' : 'Kernel local'}</small></span>
                {active ? <Check /> : null}
              </button>;
            })}
          </div>) : <div className="forge-model-no-results"><Search /><span><strong>Sin coincidencias</strong><small>Prueba con otro nombre o proveedor.</small></span></div>}
        </div>
        <footer className="forge-model-popover-footer">
          <button type="button" onClick={() => closeAndRun(onOpenModels)}><Settings /><span>Gestionar modelos y proveedores</span><ChevronRight /></button>
        </footer>
      </>}
    </section> : null}
  </div>;
}

export function GoalsView({ snapshot, onNew, onConnect, forgeModel, onOpenFinds, onRelaunchMission, relaunchPending = false, onSearchMore, onReviseGoal }: { snapshot?: OverviewSnapshot; onNew: () => void; onConnect?: () => void; forgeModel?: ForgeModel; onOpenFinds?: () => void; onRelaunchMission?: (goalId: string) => void; relaunchPending?: boolean; onSearchMore?: (goalId: string) => void; onReviseGoal?: (request: GoalEditRequest) => Promise<boolean> }) {
  const missions = snapshot?.missions ?? [];
  const goals = snapshot?.goals ?? [];
  const missionFor = (goalId: string) => missions.find((mission) => mission.goalId === goalId);
  const orphanMissions = missions.filter((mission) => !goals.some((goal) => goal.id === mission.goalId));
  // The forge carries its own offline/empty truth (and Conectar action), so it replaces the
  // generic Empty card instead of stacking a second copy of the same message.
  const forge = forgeModel ? <div className="goals-forge-live"><ForgeLiveView model={forgeModel} onConnect={onConnect} onOpenFinds={onOpenFinds} onRelaunch={onRelaunchMission} relaunchPending={relaunchPending} onSearchMore={onSearchMore} onEditGoal={onReviseGoal} headingId="goals-forge-live-title" /></div> : null;
  return <Workspace icon={Target} eyebrow="Goal → Misión → Evidencia" title="Objetivos" copy="Tus objetivos guardados. Crear uno no lanza nada: la búsqueda empieza solo cuando la confirmas." action={<button type="button" className="primary-action" onClick={onNew}><Target /> Nuevo Goal</button>}>
    {forge}
    {!snapshot ? (forge ? null : <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para leer Goals y misiones reales." action={connectAction(onConnect)} />) : goals.length === 0 && missions.length === 0 ? (forge ? null : <Empty icon={Target} title="No hay Goals" copy="Crea un Goal; no simulamos ejecuciones vacías." action={newGoalAction(onNew)} />) : <div className="record-list">{goals.map((goal) => { const mission = missionFor(goal.id); return <article key={goal.id}><div className="record-icon"><Target /></div><div><strong>{goal.title}</strong><small>{goal.id}{mission ? ` · ${mission.id} · intento ${mission.attempt ?? 0}` : ''}</small></div><StatePill state={mission ? missionPillState(mission) : goal.status} /></article>; })}{orphanMissions.map((mission) => <article key={mission.id}><div className="record-icon"><Target /></div><div><strong>{mission.goalId}</strong><small>{mission.id} · intento {mission.attempt ?? 0}</small></div><StatePill state={missionPillState(mission)} /></article>)}</div>}
  </Workspace>;
}

export function FindsView({ opportunities, connected, onFeedback, onOpenCase, missions, onNewGoal, onConnect }: { opportunities: OpportunitySummary[]; connected: boolean; onFeedback: (id: string, signal: 'useful' | 'saved' | 'dismissed' | 'not_interested') => void; onOpenCase?: (caseId: string) => void; missions?: readonly MissionSummary[]; onNewGoal?: () => void; onConnect?: () => void }) {
  // Fail-close: keep mission verificationResults SUPPORT in the gate (same as Home/shell).
  const supported = kernelSupportedFinds(opportunities, missions);
  return <Workspace icon={Sparkles} eyebrow="Hallazgos priorizados por el Kernel" title="Hallazgos" copy="Solo lo que el Kernel verificó con una fuente real (Kernel SUPPORT). Tu valoración ordena, no cambia la evidencia.">
    {!connected ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para cargar hallazgos con Kernel SUPPORT." action={connectAction(onConnect)} /> : supported.length === 0 ? <Empty icon={Search} title="Aún no hay hallazgos" copy="Ejecuta un Goal público. Solo aparecen Finds con Kernel SUPPORT; promover o completar no es un Find." action={newGoalAction(onNewGoal)} /> : <div className="find-grid">{supported.map((item) => <FindCard key={item.id} item={item} missions={missions} onFeedback={onFeedback} onOpenCase={onOpenCase} />)}</div>}
  </Workspace>;
}

function FindCard({ item, onFeedback, onOpenCase, missions }: { item: OpportunitySummary; onFeedback: (id: string, signal: 'useful' | 'saved' | 'dismissed' | 'not_interested') => void; onOpenCase?: (caseId: string) => void; missions?: readonly MissionSummary[] }) {
  const evidenceId = optionalText(item.evidenceId);
  const caseId = optionalText(item.caseId);
  const sourceUrl = optionalText(item.sourceUrl);
  // Fail-close label: mission verificationResults SUPPORT must not render as Lead no verificado.
  const kernelSupported = isKernelSupportedFind(item, missions);
  const supportProof = kernelSupported ? kernelSupportProof(item, missions) : null;
  const reasons = Array.isArray(item.reasons) ? item.reasons.filter((value): value is string => typeof value === 'string' && value.trim().length > 0) : [];
  const evidenceCount = evidenceId ? 1 : 0;
  return <article className="find-card">
    <header><span>{findCategoryEs(item.categoryLabel)}</span><span className={'lead-label' + (kernelSupported ? ' kernel-support' : '')}>{kernelSupported ? 'Kernel SUPPORT' : 'Lead no verificado'}</span></header>
    <h2>{displayText(item.title)}</h2>
    {reasons.length ? <p className="find-signals">Señales: {reasons.join(' · ')}</p> : null}
    <p>{item.sourceHost} · relevancia {formatRelevance(item.relevance)}</p>
    <dl className="find-provenance">
      <div><dt>Evidence</dt><dd>{evidenceCount > 0 ? `${evidenceCount} registro` : 'no vinculada'}</dd></div>
      {caseId ? <div><dt>Case</dt><dd><KernelIdChip id={caseId} {...(onOpenCase ? { onOpen: () => onOpenCase(caseId) } : {})} /></dd></div> : null}
      {kernelSupported ? <div><dt>Kernel</dt><dd>SUPPORT</dd></div> : null}
      {supportProof ? <div className="find-support-why"><dt>Por qué SUPPORT</dt><dd>El Kernel leyó la fuente y comprobó que cubre los términos clave del Goal; el texto del agente no cuenta. Prueba: {supportProof.kind === 'stamp' ? 'sello SUPPORT del Kernel en este hallazgo.' : <>verificación de la misión <KernelIdChip id={supportProof.missionId} /></>}</dd></div> : null}
      {evidenceId ? <div><dt>Procedencia</dt><dd className="find-chain">Hallazgo → <KernelIdChip id={evidenceId} />{caseId ? <> → <KernelIdChip id={caseId} /></> : null}{sourceUrl ? ' → fuente' : ''}</dd></div> : <div><dt>Procedencia</dt><dd>no publicada</dd></div>}
    </dl>
    {sourceUrl ? <a className="find-source" href={sourceUrl} target="_blank" rel="noreferrer">Abrir fuente <ExternalLink /></a> : <span className="source-missing">Sin URL publicada</span>}
    {item.nextAction ? <div className="find-next"><small>Siguiente paso</small><strong>{findNextActionEs(item.nextAction)}</strong></div> : null}
    <div className="find-actions"><button type="button" onClick={() => onFeedback(item.id, 'useful')}><Check /> Útil</button><button type="button" onClick={() => onFeedback(item.id, 'saved')}><History /> Guardar</button><button type="button" onClick={() => onFeedback(item.id, 'dismissed')}><X /> Descartar</button></div>
  </article>;
}

export function EvidenceView({ cases, selectedId, detail, loadingId, connected, onOpen, onNewGoal, onConnect }: { cases: CaseSummary[]; selectedId: string; detail?: CaseDetail; loadingId: string; connected: boolean; onOpen: (record: CaseSummary) => void ; onNewGoal?: () => void; onConnect?: () => void }) {
  return <Workspace icon={ShieldCheck} eyebrow="Casos · Fuentes · Procedencia" title="Evidencia" copy="Las fuentes que el Kernel leyó y guardó. Cada enlace viene del Kernel.">
    {!connected ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para ver casos y evidencias." action={connectAction(onConnect)} /> : <div className="evidence-layout"><section className="case-list"><header><span>Cases</span><b>{cases.length}</b></header>{cases.length ? cases.map((record) => <button type="button" key={record.id} className={selectedId === record.id ? 'active' : ''} onClick={() => onOpen(record)}><FileSearch /><span><strong>{displayText(record.title)}</strong><small>{record.status} · {record.id}</small></span><ChevronRight /></button>) : <Empty icon={FileSearch} title="Aún no hay Evidence" copy="Se crea un Case cuando la extensión captura una página autorizada o cuando un Goal confirmado verifica fuentes públicas con el Kernel." action={newGoalAction(onNewGoal)} />}</section><section className="evidence-detail">{!selectedId ? <Empty icon={ShieldCheck} title="Selecciona un Case" copy="Aquí aparecerán sus fuentes y recibos reales." /> : loadingId === selectedId ? <Empty icon={Activity} title="Leyendo Evidence" copy="Esperando respuesta del Kernel." /> : !detail ? <Empty icon={CircleOff} title="Evidence no disponible" copy="No inventamos una proyección cuando el endpoint no responde." /> : detail.evidence.length === 0 ? <Empty icon={ShieldCheck} title="Case sin Evidence publicada" copy="El Case existe, pero todavía no tiene recibos visibles." /> : <EvidenceReceipts caseTitle={recordTitle(detail.case, selectedId)} evidence={detail.evidence} />}</section></div>}
  </Workspace>;
}

function EvidenceReceipts({ caseTitle, evidence }: { caseTitle: string; evidence: EvidenceRecord[] }) {
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  return <div className="evidence-receipts"><header><small>CASE</small><h2>{caseTitle}</h2></header>{evidence.map((item, index) => {
    const key = item.id ?? `evidence-${index}`;
    const open = openIds[key] === true;
    const hasSource = typeof item.sourceUrl === 'string' && item.sourceUrl.length > 0;
    return <article key={key} className={hasSource ? 'has-source' : ''}>
      <button type="button" className="evidence-toggle" aria-expanded={open} onClick={() => setOpenIds((current) => ({ ...current, [key]: !open }))}>
        {hasSource ? <Check className="evidence-check" /> : <ShieldCheck />}
        <span><strong>{displayText(item.summary ?? item.id ?? `Evidence ${index + 1}`)}</strong><small>{open ? 'Ocultar procedencia' : 'Ver procedencia'}</small></span>
        <ChevronDown />
      </button>
      {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">Abrir fuente <ExternalLink /></a> : <span className="source-missing">Sin URL publicada</span>}
      {open ? <dl className="evidence-disclosure">
        {typeof item.confidence === 'number' ? <div><dt>Confianza publicada</dt><dd>{Math.round(item.confidence * 100)}%</dd></div> : null}
        {item.capturedAt ? <div><dt>Capturado</dt><dd>{formatDate(item.capturedAt)}</dd></div> : null}
        {item.id ? <div><dt>Evidence</dt><dd>{item.id}</dd></div> : null}
        {item.tags?.length ? <div><dt>Etiquetas</dt><dd>{item.tags.join(' · ')}</dd></div> : null}
      </dl> : null}
    </article>;
  })}</div>;
}

export function MemoryView({ connected }: { connected: boolean }) {
  return <Workspace icon={Database} eyebrow="Autoridad del Kernel" title="Memoria" copy="La memoria duradera solo existe si el Kernel la admite. El chat nunca entra aquí.">
    {!connected ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para consultar memoria controlada." /> : <Empty icon={Database} title="Memoria no disponible" copy="Este Kernel no publica un listado de memoria para el panel. Efesto no inventa recuerdos ni admite conversación." />}
  </Workspace>;
}

export function ActivityView({ snapshot, connected }: { snapshot?: OverviewSnapshot; connected: boolean }) {
  const activity = snapshot?.activity ?? [];
  // Fail-close: opportunity activity rows are Kernel SUPPORT Finds only (overview activityFrom).
  // Bare "Hallazgo" must name Kernel SUPPORT like FindCard / Hallazgos empty honesty.
  // Disconnected empty stays mounted — gate-blind "actividad real" must name SUPPORT like Hallazgos.
  const kindLabel = (kind: string) => kind === 'goal' ? 'Goal' : kind === 'mission' ? 'Misión' : kind === 'opportunity' ? 'Hallazgo · Kernel SUPPORT' : kind;
  return <Workspace icon={Activity} eyebrow="Estado persistido" title="Actividad" copy="Lo que ha pasado de verdad con tus objetivos, misiones y hallazgos verificados (Kernel SUPPORT). Sin progreso inventado.">
    {!connected ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para leer actividad real de Goals, misiones y hallazgos con Kernel SUPPORT." /> : activity.length === 0 ? <Empty icon={Activity} title="Sin actividad publicada" copy="Cuando el Kernel persista un Goal, una misión o un hallazgo con Kernel SUPPORT, aparecerá aquí." /> : <div className="record-list">{activity.map((entry) => <article key={entry.id}><div className="record-icon"><Activity /></div><div><strong>{kindLabel(entry.kind)}</strong><small>{entry.recordId} · {formatDate(entry.timestamp)}</small></div><StatePill state={entry.state} /></article>)}</div>}
  </Workspace>;
}

export function ModelsView({ providers, selectedProviderId, selectedModel, modelForge, connected, onSelect, onAdd }: { providers: Provider[]; selectedProviderId: string; selectedModel: string; modelForge?: ModelForgeSummary; connected: boolean; onSelect: (providerId: string, model: string) => void; onAdd: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Workspace icon={BrainCircuit} eyebrow="Model Forge · proveedores" title="Modelos" copy="Elige modelos configurados de verdad. Ningún modelo puede cambiar tu memoria.">
    {!connected ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para leer proveedores y Model Forge." /> : <div className="models-layout"><section className="model-list"><header><span>Disponibles</span><b>{providers.reduce((total, provider) => total + provider.models.length, 0)}</b></header>{providers.length ? providers.flatMap((provider) => provider.models.map((model) => <button type="button" className={provider.id === selectedProviderId && model === selectedModel ? 'active' : ''} key={`${provider.id}:${model}`} onClick={() => onSelect(provider.id, model)}><BrainCircuit /><span><strong>{model}</strong><small>{provider.label} · {provider.managedBy === 'environment' ? 'entorno privado' : 'Kernel local'}</small></span>{provider.id === selectedProviderId && model === selectedModel ? <Check /> : <ChevronRight />}</button>)) : <Empty icon={BrainCircuit} title="Sin modelos configurados" copy="Añade un proveedor real a la derecha." />}{modelForge ? <div className="forge-hardware"><small>MODEL FORGE</small><strong>{modelForge.runtime === 'available' ? `${({ powerful: 'equipo potente', balanced: 'equipo equilibrado', light: 'equipo ligero', minimal: 'equipo básico' } as Record<string, string>)[modelForge.hardware.tier] ?? modelForge.hardware.tier} · ${modelForge.hardware.ramGiB} GiB RAM` : 'Motor local no detectado'}</strong><span>Recomendado: {modelForge.recommended}</span></div> : null}</section><form className="provider-form" onSubmit={onAdd}><header><Plug /><div><small>GUARDADO EN EL KERNEL</small><strong>Añadir proveedor</strong></div></header><label>Tipo<select name="type" defaultValue="openai-compatible"><option value="openai-compatible">OpenAI compatible</option><option value="ollama">Ollama local</option></select></label><label>Nombre<input name="label" required placeholder="OpenRouter, Groq, Ollama…" /></label><label>Endpoint<input name="baseUrl" type="url" required placeholder="https://api.example.com/v1" /></label><label>Modelos<input name="models" required placeholder="modelo-1, modelo-2" /></label><label>Credencial<input name="apiKey" type="password" autoComplete="off" placeholder="Opcional para Ollama" /></label><button type="submit" className="primary-action"><Plug /> Guardar en Kernel</button><p><ShieldCheck /> La credencial no se devuelve al navegador después de guardarla.</p></form></div>}
  </Workspace>;
}

export function AgentsView({ snapshot, onSettings, onNewGoal, connected = Boolean(snapshot), kernelUrl, onTestAgents }: { snapshot?: OverviewSnapshot; onSettings: () => void; onNewGoal: () => void; connected?: boolean; kernelUrl?: string; onTestAgents?: () => Promise<AgentsSnapshot | undefined> }) {
  return <Workspace icon={Bot} eyebrow="Ejecución controlada" title="Agentes" copy="Hermes y futuros agentes pueden ejecutar herramientas; el Kernel conserva la autoridad." action={<button type="button" className="secondary-action" onClick={onSettings}><Settings /> Kernel</button>}>
    <AgentConnector variant="hero" connected={connected} kernelUrl={kernelUrl} agents={snapshot?.agents} onConnectKernel={onSettings} onTest={onTestAgents ?? (async () => snapshot?.agents)} />
    <button type="button" className="primary-action" onClick={onNewGoal}><Target /> Preparar una misión</button>
  </Workspace>;
}

export function AutomationsView({ missions, connected, onNewGoal }: { missions: MissionSummary[]; connected: boolean; onNewGoal: () => void }) {
  const withCadence = missions.filter((mission) => typeof mission.cadence === 'string');
  return <Workspace icon={Workflow} eyebrow="Persisted intents only" title="Automations" copy="Solo mostramos automatización que el Kernel puede demostrar. No hay toggles ni próximos runs inventados." action={<button type="button" className="primary-action" onClick={onNewGoal}><Target /> Nuevo Goal</button>}>
    {!connected ? <Empty icon={CircleOff} title="Kernel sin conexión" copy="Conecta el Kernel para leer comportamientos persistidos." /> : <><div className="automation-cards"><article><Workflow /><div><strong>Vigilancia de misiones</strong><small>Observa transiciones reales de misiones.</small></div><StatePill state="available" /></article><article><ShieldCheck /><div><strong>Reintentos limitados</strong><small>Los intentos permanecen observables y limitados.</small></div><StatePill state="available" /></article></div>{withCadence.length ? <div className="record-list">{withCadence.map((mission) => <article key={mission.id}><div className="record-icon"><Workflow /></div><div><strong>{String(mission.cadence)}</strong><small>{mission.id}</small></div><StatePill state={missionPillState(mission)} /></article>)}</div> : <p className="truth-card"><ShieldCheck /> No hay recurrencias publicadas por el endpoint actual. Efesto no mostrará horarios ficticios.</p>}</>}
  </Workspace>;
}

/** The Kernel the Windows installer starts (efesto-windows-stack.mjs KERNEL_PORT). */
const DEFAULT_KERNEL_URL = 'http://127.0.0.1:4310';

export function SettingsView({ connected, connecting, rememberSession, snapshot, kernelBaseUrl, onConnect, onLocalConnect, onExtensionConnect, onDisconnect, onRefresh }: { connected: boolean; onLocalConnect?: () => void; connecting: boolean; rememberSession: boolean; snapshot?: OverviewSnapshot; kernelBaseUrl?: string; onConnect: (event: FormEvent<HTMLFormElement>) => void; onExtensionConnect?: () => void; onDisconnect: () => void; onRefresh: () => void }) {
  const bootstrap = snapshot?.readiness.bootstrap;
  return <Workspace icon={Settings} eyebrow={t('settings.eyebrow')} title={t('settings.title')} copy={t('settings.copy')}>
    <div className="settings-layout"><form className="connection-card" onSubmit={onConnect}><header><span className={`kernel-dot ${connected ? 'online' : 'offline'}`} /><div><small>{t('settings.device').toUpperCase()}</small><strong>{connected ? t('settings.connected') : t('settings.connectKernel')}</strong></div></header>{!connected ? <><button type="button" className="primary-action" onClick={onLocalConnect} disabled={connecting || !onLocalConnect}>{connecting ? t('settings.connecting') : t('settings.autoConnect')}</button><p>{t('settings.autoHelp')}</p><details className="connection-advanced"><summary>{t('settings.advanced')}</summary><p>Solo si tu Kernel está en otro puerto o usas la extensión del navegador (opcional).</p><button type="button" className="secondary-action" onClick={onExtensionConnect} disabled={connecting || !onExtensionConnect}>Conectar con extensión</button><label>URL del Kernel<input name="baseUrl" aria-label="URL del Kernel" type="url" defaultValue={DEFAULT_KERNEL_URL} required /></label><label>Token privado<input name="token" aria-label="Token privado" type="password" autoComplete="off" placeholder="Opcional si usas pairing" /></label><label>Código de emparejamiento<input name="pairingCode" aria-label="Código de emparejamiento" inputMode="text" autoComplete="off" placeholder="ABCD-1234" /></label><label className="remember-row"><input name="rememberSession" type="checkbox" defaultChecked={rememberSession} /><span><strong>Recordar durante esta sesión</strong><small>sessionStorage; no persistencia indefinida.</small></span></label><div className="connection-actions"><button type="submit" name="action" value="pair" className="primary-action" disabled={connecting}>{connecting ? 'Emparejando…' : 'Emparejar con código'}</button><button type="submit" name="action" value="token" className="secondary-action" disabled={connecting}>Autorizar dispositivo</button></div></details></> : <div className="connection-actions"><button type="button" className="primary-action" onClick={onRefresh}><RefreshCw /> {t('settings.checkNow')}</button><button type="button" className="danger-action" onClick={onDisconnect}>{t('settings.disconnect')}</button></div>}</form><section className="readiness-card"><header><ShieldCheck /><div><small>{t('settings.realStatus').toUpperCase()}</small><strong>{statusEs(bootstrap?.overall ?? (connected ? 'connected' : 'offline'))}</strong></div></header><ReadinessRow label="Kernel" value={statusEs(snapshot?.readiness.kernel === 'offline' ? 'offline' : bootstrap?.kernel ?? (connected ? 'ready' : 'offline'))} ready={connected && snapshot?.readiness.kernel !== 'offline'} />{(() => { const hermes = hermesReadiness(bootstrap?.hermes, snapshot?.agents?.agents.find((agent) => agent.id === 'hermes')); return <ReadinessRow label="Hermes" value={statusEs(hermes.value)} ready={hermes.ready} />; })()}<ReadinessRow label="Obsidian" value={statusEs(bootstrap?.obsidian ?? 'unconfigured')} ready={bootstrap?.obsidian === 'ready'} /><ReadinessRow label={t('settings.extensionOptional')} value={bootstrap?.pairing === 'paired' ? t('status.paired') : t('status.unused')} ready={bootstrap?.pairing === 'paired'} /><details className="readiness-advanced"><summary>{t('settings.advanced')}</summary><a href={replayLabHref(kernelBaseUrl)} target="_blank" rel="noreferrer">Abrir Replay Lab <ExternalLink /></a></details></section><LanguageCard /></div>
  </Workspace>;
}

function missionPillState(mission: MissionSummary): string {
  // Bare status completed (no Evidence / Kernel forge) must not look like Completado.
  // Forged without Kernel SUPPORT Finds must not keep a green "forged" Completado-lookalike
  // on Goals/Actividad (Home already uses Investigación terminada / Research completed).
  if (mission.executionPhase === 'forged') {
    return countMissionKernelSupportedFinds(mission) > 0 ? 'forged' : 'research_completed';
  }
  if (missionVerifiedWithoutSupport(mission)) return 'verified_unsupported';
  if (mission.executionPhase) return mission.executionPhase;
  if (mission.status === 'completed') return 'completed_without_forge';
  return mission.status;
}
function Workspace({ icon: Icon, eyebrow, title, copy, action, children }: { icon: typeof Target; eyebrow: string; title: string; copy: string; action?: ReactNode; children: ReactNode }) { return <section className="workspace"><header className="workspace-heading"><span><Icon /></span><div><small>{eyebrow}</small><h1>{title}</h1><p>{copy}</p></div>{action ? <div className="workspace-heading-action">{action}</div> : null}</header><div className="workspace-body">{children}</div></section>; }
function Empty({ icon: Icon, title, copy, action }: { icon: typeof Target; title: string; copy: string; action?: { label: string; onClick: () => void } }) { return <div className="empty-state"><Icon /><strong>{title}</strong><p>{copy}</p>{action ? <button type="button" className="empty-state-action" onClick={action.onClick}>{action.label}</button> : null}</div>; }
function connectAction(onConnect?: () => void) { return onConnect ? { label: 'Conectar Kernel', onClick: onConnect } : undefined; }
function newGoalAction(onNewGoal?: () => void) { return onNewGoal ? { label: 'Crear un Goal', onClick: onNewGoal } : undefined; }
// Fail-close Goals/Actividad/Automations StatePill labels (page.tsx → EfestoProductShell).
// missionPillState / activityFrom already gate forged → SUPPORT-only; bare English
// "forged" / "research completed" must not stand in for Home forge-state-action honesty
// (Find SUPPORT forjado / Investigación terminada / Terminada sin Evidence).
function StatePill({ state }: { state: string }) {
  return <span className={`state-pill ${statePillTone(state)}`}><i />{statePillLabel(state)}</span>;
}
const STATUS_KEYS: Record<string, MessageKey> = { ready: 'status.ready', online: 'status.online', offline: 'status.offline', connected: 'status.connected', needs_setup: 'status.needs_setup', 'needs-setup': 'status.needs_setup', partial: 'status.partial', degraded: 'status.degraded', missing: 'status.missing', unavailable: 'status.unavailable', paired: 'status.paired', unpaired: 'status.unused', required: 'status.unused', blocked: 'status.blocked', unconfigured: 'status.unconfigured', 'not-configured': 'status.unconfigured', error: 'status.error' };
/** Kernel readiness words in the active language (unknown values pass through). */
export function statusEs(value: string): string { const key = STATUS_KEYS[value]; return key ? t(key) : value; }
/** Language picker (approved mockup): detected from the browser, explicit choice saved on this device. */
export function LanguageCard() {
  const locale = useLocale();
  return <section className="readiness-card language-card" aria-labelledby="language-card-title">
    <header><Globe aria-hidden="true" /><div><small>{t('settings.language').toUpperCase()}</small><strong id="language-card-title">{LOCALE_NAMES[locale]}</strong></div></header>
    <p className="language-card-help">{t('settings.languageHelp')}</p>
    <div className="language-options" role="radiogroup" aria-label={t('settings.language')}>
      {LOCALES.map((code) => <button key={code} type="button" role="radio" lang={code} aria-checked={code === locale} className={code === locale ? 'active' : ''} onClick={() => setLocale(code)}>{LOCALE_NAMES[code]}</button>)}
    </div>
  </section>;
}

function ReadinessRow({ label, value, ready }: { label: string; value: string; ready: boolean }) { return <div className="readiness-row"><span>{label}</span><strong className={ready ? 'ready' : ''}><i />{value}</strong></div>; }
export function brainState(phase: BrainPhase, supportedFindCount = 0) {
  if (phase === 'thinking') return { label: 'Conversando', detail: 'Modelo transmitiendo' };
  if (phase === 'investigating') return { label: 'Investigando', detail: 'Hermes ejecutando una misión' };
  if (phase === 'verifying') return { label: 'Verificando Evidence', detail: 'Kernel aplicando gates' };
  // Verification finished with zero Kernel SUPPORT while the Mission honestly stays
  // verifying: must not keep claiming gates are still running.
  if (phase === 'verified_unsupported') return { label: 'Sin SUPPORT', detail: 'Ninguna página verificada respalda el Goal' };
  if (phase === 'queued') return { label: 'Misión preparada', detail: 'Esperando agente' };
  if (phase === 'forged') {
    // Fail-close Home forge-state-action (page.tsx → EfestoProductShell → HomeView):
    // forgeSupportedFindCount is focused GoalSurface SUPPORT (findCount when
    // verificationResults are stripped) — not global inbox length.
    // forged without Kernel SUPPORT Finds must not read like Completado/useful Find;
    // with SUPPORT Finds, name them like extension Living Forge / mission-state.
    if (supportedFindCount > 0) {
      return {
        label: supportedFindCount === 1 ? 'Find SUPPORT forjado' : 'Finds SUPPORT forjados',
        detail: supportedFindCount === 1
          ? '1 Find pasó Kernel SUPPORT'
          : `${supportedFindCount} Finds pasaron Kernel SUPPORT`,
      };
    }
    return { label: 'Investigación terminada', detail: 'Ningún Find pasó Kernel SUPPORT' };
  }
  // Bare completed (no forged Evidence) — same honesty as Actividad completed_without_forge
  // / extension Research ended without Evidence. Must not fall through to Forja lista.
  if (phase === 'completed') {
    return { label: 'Terminada sin Evidence', detail: 'El intento terminó sin Evidence forjada' };
  }
  if (phase === 'failed') return { label: 'Atención requerida', detail: 'La última misión falló' };
  if (phase === 'blocked') return { label: 'BLOCKED', detail: 'La política del Kernel denegó la ejecución automática' };
  if (phase === 'unavailable') return { label: 'Hermes no disponible', detail: 'El agente no está listo; no hay investigación inventada' };
  if (phase === 'ready') return { label: 'Forja lista', detail: 'Listo para un nuevo Goal' };
  return { label: 'Modo local desconectado', detail: 'Sin actividad simulada' };
}
/** Replay Lab lives on the connected loopback Kernel (any port), not a hardcoded :4000. */
function replayLabHref(kernelBaseUrl?: string) {
  let origin = 'http://127.0.0.1:4000';
  if (kernelBaseUrl) {
    try { origin = normalizeKernelBaseUrl(kernelBaseUrl); } catch { /* keep default loopback Kernel */ }
  }
  return `${origin}/replay-lab`;
}
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date); }
function formatRelevance(value: number) { return value <= 1 ? `${Math.round(value * 100)}%` : String(Math.round(value)); }
function optionalText(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
function recordTitle(record: Record<string, unknown>, fallback: string) { return displayText(typeof record.title === 'string' ? record.title : typeof record.question === 'string' ? record.question : fallback); }