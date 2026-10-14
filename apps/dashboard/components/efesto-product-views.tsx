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

const starterGoals = () => [
  t('s.starter1'),
  t('s.starter2'),
  t('s.starter3'),
  t('s.starter4'),
  t('s.starter5'),
  t('s.starter6'),
  t('s.starter7'),
  t('s.starter8'),
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
    ? (messages.length ? t('s.conversation') : t('s.newConversation'))
    // Fail-close chrome: inbox SUPPORT Finds OR focused-mission findCount — never bare Hallazgo útil.
    : (preparedGoal ? t('s.preparedGoal') : showForge ? t('s.kernelMission') : (supportedFinds.length || focusedMissionHasSupport) ? t('s.findSupport') : t('s.newGoal'));
  const surfaceAria = chatMode
    ? t('s.conversationWith')
    : (preparedGoal ? t('s.preparedGoal') : showForge ? t('s.kernelMission') : (supportedFinds.length || focusedMissionHasSupport) ? t('s.findsSupport') : t('s.newGoal'));

  // With a live forge the composer follows the forge in the scroll (the forge fills the first
  // viewport, as in the approved v3 mockup); otherwise it stays docked under the conversation.
  const composer = <ComposerForm
    input={input}
    chatMode={chatMode}
    chatAvailable={chatAvailable}
    chatPending={chatPending}
    submitDisabled={submitDisabled}
    suggestions={showSuggestions ? starterGoals() : []}
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
      <div className="forge-composer-tray" aria-label={t('s.kernelActions')}>
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
        <button type="button" className="forge-menu-button" onClick={(event) => onOpenNav(event.currentTarget)} aria-label={t('s.toggleNav')} aria-controls="efesto-sidebar" aria-expanded={navExpanded}>
          <Menu className="forge-menu-icon" aria-hidden="true" />
          <span className="forge-menu-brand" aria-hidden="true"><EfestoMark size={30} /><b>EFESTO</b></span>
        </button>
        <div className="forge-product-title">
          <span className="forge-agent-mark"><EfestoMark size={28} /></span>
          <span className="forge-crumb">{chatMode ? t('s.chat') : t('nav.home')}<i aria-hidden="true">/</i><strong>{surfaceTitle}</strong></span>
        </div>
      </div>

      <ModeSwitcher chatMode={chatMode} onToggleChat={onToggleChat} />

      <button type="button" className={'forge-state-action phase-' + chromePhase} onClick={connected && onOpenConnections ? onOpenConnections : onOpenSettings} aria-label={connected ? t('s.kernelConnected') : t('s.connectKernel')} aria-haspopup={connected && onOpenConnections ? 'dialog' : undefined}>
        <i />
        <span>{connected ? state.label : t('s.connectKernel')}</span>
        <Plug aria-hidden="true" />
      </button>
    </header>

    <div className="forge-scroll">
      {chatMode ? messages.length ? <section className="forge-thread" aria-label={t('s.messages')}>
        {messages.map((message, index) => <article className={'forge-message ' + message.role} key={message.role + '-' + index}>
          <div className="forge-message-avatar">{message.role === 'user' ? t('s.you') : <EfestoMark size={24} simple />}</div>
          <div className="forge-message-body">
            <header><strong>{message.role === 'user' ? t('s.you') : message.model ?? 'Efesto'}</strong>{message.role === 'assistant' ? <span><ShieldCheck /> {t('s.private')}</span> : null}</header>
            <p>{message.content || (chatPending && index === messages.length - 1 ? <span className="forge-generating"><i />{t('s.thinking')}</span> : null)}</p>
          </div>
        </article>)}
      </section> : <section className="forge-empty" aria-label={t('s.newConversation')}>
        <span className="forge-empty-mark"><EfestoMark size={52} /></span>
        <small>EFESTO · INTELLIGENCE FORGE</small>
        <h1>{t('s.emptyTitle')}</h1>
        <p>{t('s.emptyCopy')}</p>
        <div className="forge-empty-meta"><span><ShieldCheck /> {t('s.kernelControlled')}</span><span><i /> {t('s.humanConfirm')}</span></div>
      </section> : preparedGoal ? <section className="forge-goal-plan" aria-label={t('s.planProposed')}>
        <header>
          <span className="forge-plan-icon"><Target /></span>
          <div><small>{t('s.planEyebrow')}</small><h1>{preparedGoal}</h1><p>{t('s.planReview')}</p></div>
        </header>
        <ol>
          <li><b>1</b><span><strong>{t('s.createPrivateGoal')}</strong><small>{t('s.planKeeps')}</small></span></li>
          <li><b>2</b><span><strong>{t('s.planConfirm')}</strong><small>{t('s.planConfirmHelp')}</small></span></li>
          <li><b>3</b><span><strong>{t('s.forgeEvidenceFinds')}</strong><small>{t('s.planForge')}</small></span></li>
        </ol>
        <div className="forge-plan-actions">
          <button type="button" className="primary-action" disabled={!connected || goalPending} onClick={onConfirmGoal}>{goalPending ? t('s.confirming') : connected ? t('s.confirmRun') : t('s.connectToRun')}</button>
          <button type="button" className="secondary-action" onClick={onEditGoal}>{t('s.editGoal')}</button>
        </div>
        <p className="forge-plan-boundary"><ShieldCheck /> {t('s.nothingRuns')}</p>
      </section> : <>
      {showForge && forgeModel ? <div className="forge-home-live">
        <ForgeLiveView model={forgeModel} onOpenFinds={onOpenFinds} onRelaunch={onRelaunchMission} relaunchPending={relaunchPending} onSearchMore={onSearchMore} onEditGoal={onReviseGoal} headingId="forge-home-live-title" />
      </div> : null}
      {(supportedFinds.length || focusedMissionHasSupport) ? <section className="forge-home-finds" aria-label={t('s.findsBacked')}>
        <header>
          <small>FIND · KERNEL SUPPORT</small>
          <h1>{t('s.findSupport')}</h1>
          <p>{supportedFinds.length
            ? t('s.findPersisted')
            : t('s.findFocused')}</p>
        </header>
        {supportedFinds.length
          ? <div className="find-grid">{supportedFinds.map((item) => <FindCard key={item.id} item={item} missions={missions} onFeedback={onFindFeedback ?? (() => undefined)} onOpenCase={onOpenCase} />)}</div>
          : <p className="truth-card"><ShieldCheck /> {t('s.findNoCards')}</p>}
      </section> : showForge ? null : <section className="forge-empty forge-goal-empty" aria-label={t('s.createGoal')}>
        <h1 className="forge-wordmark"><EfestoMark size={46} /><ForgedWordmark /><span className="forge-sr-only">{t('s.whatLooking')}</span></h1>
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
const homeChips = (): { id: HomeChipView; label: string; icon: typeof Target }[] => [
  { id: 'goals', label: t('nav.goals'), icon: Target },
  { id: 'evidence', label: t('nav.evidence'), icon: ShieldCheck },
  { id: 'memory', label: t('nav.memory'), icon: Database },
  { id: 'activity', label: t('nav.activity'), icon: Activity },
  { id: 'agents', label: t('nav.agents'), icon: Bot },
];

function PageChips({ onOpenView }: { onOpenView: (view: HomeChipView) => void }) {
  const rowRef = useRef<HTMLDivElement>(null);
  return <div className="forge-page-chips">
    <div className="forge-page-chips-row" ref={rowRef} role="group" aria-label={t('s.goTo')}>
      {homeChips().map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => onOpenView(id)}><Icon aria-hidden="true" />{label}</button>)}
    </div>
    <button type="button" className="forge-page-chips-more" aria-label={t('s.moreShortcuts')} onClick={() => rowRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}><ChevronRight aria-hidden="true" /></button>
  </div>;
}

function ModeSwitcher({ chatMode, onToggleChat }: { chatMode: boolean; onToggleChat: (value: boolean) => void }) {
  return <div className="forge-mode-switcher" role="group" aria-label={t('s.workMode')}>
    <button type="button" aria-pressed={chatMode} className={chatMode ? 'active' : ''} onClick={() => onToggleChat(true)}><MessageSquare /> <span>{t('s.chat')}</span></button>
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
    {suggestions.length && ideasOpen ? <div className="forge-quick-prompts" id="forge-ideas" aria-label={chatMode ? t('s.startSuggestions') : t('s.goalIdeas')}>
      {suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => onSuggestion(suggestion)}>
        {chatMode ? <Sparkles /> : <Target />}
        <span>{suggestion}</span>
        <ChevronRight />
      </button>)}
    </div> : null}

    <form className={'forge-composer ' + (chatMode ? 'is-chat' : 'is-goal')} onSubmit={onSubmit}>
      <textarea
        aria-label={chatMode ? t('s.message') : 'Goal'}
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
        {chatPending ? <button type="button" className="forge-send stop" onClick={onStopChat} aria-label={t('s.stopGen')}><Pause /></button> : <button type="submit" className="forge-send" disabled={submitDisabled} aria-label={chatMode ? t('s.sendMessage') : t('s.prepareGoal')}><ArrowUp /></button>}
      </footer>
    </form>
    <p className="forge-composer-hint" id="forge-composer-note">{chatMode ? t('s.hintChat') : t('s.hintGoal')}</p>
    {chips}
    {suggestions.length ? <button type="button" className="forge-explore-ideas" aria-expanded={ideasOpen} aria-controls="forge-ideas" onClick={() => setIdeasOpen((open) => !open)}><Lightbulb aria-hidden="true" />{ideasOpen ? t('s.hideIdeas') : t('s.exploreIdeas')}</button> : null}
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
      <span className="forge-model-trigger-label">{chatAvailable ? modelLabel : connected ? t('s.chooseModel') : t('s.configureModel')}</span>
      <ChevronDown className="forge-model-chevron" />
    </button>

    {open ? <section className="forge-model-popover" id="forge-model-selector" role="dialog" aria-label={t('s.selectModel')}>
      <header className="forge-model-popover-header">
        <span><small>{t('s.kernelModels')}</small><strong>{connected ? modelCount === 1 ? t('s.oneModel') : t('s.nModels', { count: modelCount }) : t('s.kernelOffline')}</strong></span>
        <button type="button" onClick={() => { setOpen(false); setQuery(''); }} aria-label={t('s.closePicker')}><X /></button>
      </header>

      {!connected ? <div className="forge-model-empty">
        <span><Plug /></span>
        <strong>{t('s.connectTheKernel')}</strong>
        <p>{t('s.pickerHelp')}</p>
        <button type="button" onClick={() => closeAndRun(onOpenSettings)}>{t('s.connectKernel')}</button>
      </div> : modelCount === 0 ? <div className="forge-model-empty">
        <span><BrainCircuit /></span>
        <strong>{t('s.noModels')}</strong>
        <p>{t('s.addProviderChat')}</p>
        <button type="button" onClick={() => closeAndRun(onOpenModels)}>{t('s.manageProviders')}</button>
      </div> : <>
        <label className="forge-model-search">
          <Search />
          <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('s.searchModelDots')} aria-label={t('s.searchModel')} />
        </label>
        <div className="forge-model-list" role="listbox" aria-label={t('s.availableModels')}>
          {visibleProviders.length ? visibleProviders.map((provider) => <div className="forge-model-provider" role="group" aria-label={provider.label} key={provider.id}>
            <header><span>{provider.label}</span><small>{provider.type === 'ollama' ? t('s.ollamaLocal') : t('s.apiCompatible')}</small></header>
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
                <span><strong>{model}</strong><small>{provider.managedBy === 'environment' ? t('s.privateEnvCap') : t('sidebar.kernel')}</small></span>
                {active ? <Check /> : null}
              </button>;
            })}
          </div>) : <div className="forge-model-no-results"><Search /><span><strong>{t('s.noMatches')}</strong><small>{t('s.tryOther')}</small></span></div>}
        </div>
        <footer className="forge-model-popover-footer">
          <button type="button" onClick={() => closeAndRun(onOpenModels)}><Settings /><span>{t('s.manageModels')}</span><ChevronRight /></button>
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
  return <Workspace icon={Target} eyebrow={t('s.goalsEyebrow')} title={t('nav.goals')} copy={t('s.goalsCopy')} action={<button type="button" className="primary-action" onClick={onNew}><Target /> {t('s.newGoal')}</button>}>
    {forge}
    {!snapshot ? (forge ? null : <Empty icon={CircleOff} title={t('s.kernelOffline')} copy={t('s.goalsOffline')} action={connectAction(onConnect)} />) : goals.length === 0 && missions.length === 0 ? (forge ? null : <Empty icon={Target} title={t('s.noGoals')} copy={t('s.noGoalsCopy')} action={newGoalAction(onNew)} />) : <div className="record-list">{goals.map((goal) => { const mission = missionFor(goal.id); return <article key={goal.id}><div className="record-icon"><Target /></div><div><strong>{goal.title}</strong><small>{goal.id}{mission ? ` · ${mission.id} · ${t('s.attempt', { n: mission.attempt ?? 0 })}` : ''}</small></div><StatePill state={mission ? missionPillState(mission) : goal.status} /></article>; })}{orphanMissions.map((mission) => <article key={mission.id}><div className="record-icon"><Target /></div><div><strong>{mission.goalId}</strong><small>{mission.id} · {t('s.attempt', { n: mission.attempt ?? 0 })}</small></div><StatePill state={missionPillState(mission)} /></article>)}</div>}
  </Workspace>;
}

export function FindsView({ opportunities, connected, onFeedback, onOpenCase, missions, onNewGoal, onConnect }: { opportunities: OpportunitySummary[]; connected: boolean; onFeedback: (id: string, signal: 'useful' | 'saved' | 'dismissed' | 'not_interested') => void; onOpenCase?: (caseId: string) => void; missions?: readonly MissionSummary[]; onNewGoal?: () => void; onConnect?: () => void }) {
  // Fail-close: keep mission verificationResults SUPPORT in the gate (same as Home/shell).
  const supported = kernelSupportedFinds(opportunities, missions);
  return <Workspace icon={Sparkles} eyebrow={t('s.findsEyebrow')} title={t('nav.finds')} copy={t('s.findsCopy')}>
    {!connected ? <Empty icon={CircleOff} title={t('s.kernelOffline')} copy={t('s.findsOffline')} action={connectAction(onConnect)} /> : supported.length === 0 ? <Empty icon={Search} title={t('s.noFinds')} copy={t('s.noFindsCopy')} action={newGoalAction(onNewGoal)} /> : <div className="find-grid">{supported.map((item) => <FindCard key={item.id} item={item} missions={missions} onFeedback={onFeedback} onOpenCase={onOpenCase} />)}</div>}
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
    <header><span>{findCategoryEs(item.categoryLabel)}</span><span className={'lead-label' + (kernelSupported ? ' kernel-support' : '')}>{kernelSupported ? 'Kernel SUPPORT' : t('s.leadUnverified')}</span></header>
    <h2>{displayText(item.title)}</h2>
    {reasons.length ? <p className="find-signals">{t('s.signals')} {reasons.join(' · ')}</p> : null}
    <p>{item.sourceHost} · {t('s.relevance')} {formatRelevance(item.relevance)}</p>
    <dl className="find-provenance">
      <div><dt>Evidence</dt><dd>{evidenceCount > 0 ? t('s.nRecords', { count: evidenceCount }) : t('s.notLinked')}</dd></div>
      {caseId ? <div><dt>Case</dt><dd><KernelIdChip id={caseId} {...(onOpenCase ? { onOpen: () => onOpenCase(caseId) } : {})} /></dd></div> : null}
      {kernelSupported ? <div><dt>Kernel</dt><dd>SUPPORT</dd></div> : null}
      {supportProof ? <div className="find-support-why"><dt>{t('s.whySupport')}</dt><dd>{t('s.whySupportCopy')} {supportProof.kind === 'stamp' ? t('s.stampProof') : <>{t('s.missionVerification')} <KernelIdChip id={supportProof.missionId} /></>}</dd></div> : null}
      {evidenceId ? <div><dt>{t('s.provenance')}</dt><dd className="find-chain">{t('s.findArrow')} → <KernelIdChip id={evidenceId} />{caseId ? <> → <KernelIdChip id={caseId} /></> : null}{sourceUrl ? ` → ${t('s.sourceLower')}` : ''}</dd></div> : <div><dt>{t('s.provenance')}</dt><dd>{t('s.notPublished')}</dd></div>}
    </dl>
    {sourceUrl ? <a className="find-source" href={sourceUrl} target="_blank" rel="noreferrer">{t('s.openSource')} <ExternalLink /></a> : <span className="source-missing">{t('s.noUrl')}</span>}
    {item.nextAction ? <div className="find-next"><small>{t('s.nextStep')}</small><strong>{findNextActionEs(item.nextAction)}</strong></div> : null}
    <div className="find-actions"><button type="button" onClick={() => onFeedback(item.id, 'useful')}><Check /> {t('s.useful')}</button><button type="button" onClick={() => onFeedback(item.id, 'saved')}><History /> {t('s.save')}</button><button type="button" onClick={() => onFeedback(item.id, 'dismissed')}><X /> {t('s.dismiss')}</button></div>
  </article>;
}

export function EvidenceView({ cases, selectedId, detail, loadingId, connected, onOpen, onNewGoal, onConnect }: { cases: CaseSummary[]; selectedId: string; detail?: CaseDetail; loadingId: string; connected: boolean; onOpen: (record: CaseSummary) => void ; onNewGoal?: () => void; onConnect?: () => void }) {
  return <Workspace icon={ShieldCheck} eyebrow={t('s.evidenceEyebrow')} title={t('nav.evidence')} copy={t('s.evidenceCopy')}>
    {!connected ? <Empty icon={CircleOff} title={t('s.kernelOffline')} copy={t('s.evidenceOffline')} action={connectAction(onConnect)} /> : <div className="evidence-layout"><section className="case-list"><header><span>Cases</span><b>{cases.length}</b></header>{cases.length ? cases.map((record) => <button type="button" key={record.id} className={selectedId === record.id ? 'active' : ''} onClick={() => onOpen(record)}><FileSearch /><span><strong>{displayText(record.title)}</strong><small>{record.status} · {record.id}</small></span><ChevronRight /></button>) : <Empty icon={FileSearch} title={t('s.noEvidence')} copy={t('s.noEvidenceCopy')} action={newGoalAction(onNewGoal)} />}</section><section className="evidence-detail">{!selectedId ? <Empty icon={ShieldCheck} title={t('s.selectCase')} copy={t('s.selectCaseCopy')} /> : loadingId === selectedId ? <Empty icon={Activity} title={t('s.readingEvidence')} copy={t('s.waitingKernel')} /> : !detail ? <Empty icon={CircleOff} title={t('s.evidenceUnavailable')} copy={t('s.evidenceUnavailableCopy')} /> : detail.evidence.length === 0 ? <Empty icon={ShieldCheck} title={t('s.caseNoEvidence')} copy={t('s.caseNoEvidenceCopy')} /> : <EvidenceReceipts caseTitle={recordTitle(detail.case, selectedId)} evidence={detail.evidence} />}</section></div>}
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
        <span><strong>{displayText(item.summary ?? item.id ?? `Evidence ${index + 1}`)}</strong><small>{open ? t('s.hideProvenance') : t('s.showProvenance')}</small></span>
        <ChevronDown />
      </button>
      {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">{t('s.openSource')} <ExternalLink /></a> : <span className="source-missing">{t('s.noUrl')}</span>}
      {open ? <dl className="evidence-disclosure">
        {typeof item.confidence === 'number' ? <div><dt>{t('s.publishedConfidence')}</dt><dd>{Math.round(item.confidence * 100)}%</dd></div> : null}
        {item.capturedAt ? <div><dt>{t('s.captured')}</dt><dd>{formatDate(item.capturedAt)}</dd></div> : null}
        {item.id ? <div><dt>Evidence</dt><dd>{item.id}</dd></div> : null}
        {item.tags?.length ? <div><dt>{t('s.tags')}</dt><dd>{item.tags.join(' · ')}</dd></div> : null}
      </dl> : null}
    </article>;
  })}</div>;
}

export function MemoryView({ connected }: { connected: boolean }) {
  return <Workspace icon={Database} eyebrow={t('s.memoryEyebrow')} title={t('nav.memory')} copy={t('s.memoryCopy')}>
    {!connected ? <Empty icon={CircleOff} title={t('s.kernelOffline')} copy={t('s.memoryOffline')} /> : <Empty icon={Database} title={t('s.memoryUnavailable')} copy={t('s.memoryUnavailableCopy')} />}
  </Workspace>;
}

export function ActivityView({ snapshot, connected }: { snapshot?: OverviewSnapshot; connected: boolean }) {
  const activity = snapshot?.activity ?? [];
  // Fail-close: opportunity activity rows are Kernel SUPPORT Finds only (overview activityFrom).
  // Bare "Hallazgo" must name Kernel SUPPORT like FindCard / Hallazgos empty honesty.
  // Disconnected empty stays mounted — gate-blind "actividad real" must name SUPPORT like Hallazgos.
  const kindLabel = (kind: string) => kind === 'goal' ? 'Goal' : kind === 'mission' ? t('s.mission') : kind === 'opportunity' ? t('s.findSupport') : kind;
  return <Workspace icon={Activity} eyebrow={t('s.activityEyebrow')} title={t('nav.activity')} copy={t('s.activityCopy')}>
    {!connected ? <Empty icon={CircleOff} title={t('s.kernelOffline')} copy={t('s.activityOffline')} /> : activity.length === 0 ? <Empty icon={Activity} title={t('s.noActivity')} copy={t('s.noActivityCopy')} /> : <div className="record-list">{activity.map((entry) => <article key={entry.id}><div className="record-icon"><Activity /></div><div><strong>{kindLabel(entry.kind)}</strong><small>{entry.recordId} · {formatDate(entry.timestamp)}</small></div><StatePill state={entry.state} /></article>)}</div>}
  </Workspace>;
}

export function ModelsView({ providers, selectedProviderId, selectedModel, modelForge, connected, onSelect, onAdd }: { providers: Provider[]; selectedProviderId: string; selectedModel: string; modelForge?: ModelForgeSummary; connected: boolean; onSelect: (providerId: string, model: string) => void; onAdd: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Workspace icon={BrainCircuit} eyebrow={t('s.modelsEyebrow')} title={t('nav.models')} copy={t('s.modelsCopy')}>
    {!connected ? <Empty icon={CircleOff} title={t('s.kernelOffline')} copy={t('s.modelsOffline')} /> : <div className="models-layout"><section className="model-list"><header><span>{t('s.available')}</span><b>{providers.reduce((total, provider) => total + provider.models.length, 0)}</b></header>{providers.length ? providers.flatMap((provider) => provider.models.map((model) => <button type="button" className={provider.id === selectedProviderId && model === selectedModel ? 'active' : ''} key={`${provider.id}:${model}`} onClick={() => onSelect(provider.id, model)}><BrainCircuit /><span><strong>{model}</strong><small>{provider.label} · {provider.managedBy === 'environment' ? t('s.privateEnv') : t('sidebar.kernel')}</small></span>{provider.id === selectedProviderId && model === selectedModel ? <Check /> : <ChevronRight />}</button>)) : <Empty icon={BrainCircuit} title={t('s.noModels')} copy={t('s.addProviderRight')} />}{modelForge ? <div className="forge-hardware"><small>MODEL FORGE</small><strong>{modelForge.runtime === 'available' ? `${({ powerful: t('s.tierPowerful'), balanced: t('s.tierBalanced'), light: t('s.tierLight'), minimal: t('s.tierMinimal') } as Record<string, string>)[modelForge.hardware.tier] ?? modelForge.hardware.tier} · ${modelForge.hardware.ramGiB} GiB RAM` : t('s.noLocalEngine')}</strong><span>{t('s.recommended')} {modelForge.recommended}</span></div> : null}</section><form className="provider-form" onSubmit={onAdd}><header><Plug /><div><small>{t('s.savedInKernel')}</small><strong>{t('s.addProvider')}</strong></div></header><label>{t('s.type')}<select name="type" defaultValue="openai-compatible"><option value="openai-compatible">OpenAI compatible</option><option value="ollama">{t('s.ollamaLocal')}</option></select></label><label>{t('s.name')}<input name="label" required placeholder="OpenRouter, Groq, Ollama…" /></label><label>Endpoint<input name="baseUrl" type="url" required placeholder="https://api.example.com/v1" /></label><label>{t('nav.models')}<input name="models" required placeholder={t('s.modelPlaceholder')} /></label><label>{t('s.credential')}<input name="apiKey" type="password" autoComplete="off" placeholder={t('s.optionalOllama')} /></label><button type="submit" className="primary-action"><Plug /> {t('s.saveInKernel')}</button><p><ShieldCheck /> {t('s.credentialNote')}</p></form></div>}
  </Workspace>;
}

export function AgentsView({ snapshot, onSettings, onNewGoal, connected = Boolean(snapshot), kernelUrl, onTestAgents }: { snapshot?: OverviewSnapshot; onSettings: () => void; onNewGoal: () => void; connected?: boolean; kernelUrl?: string; onTestAgents?: () => Promise<AgentsSnapshot | undefined> }) {
  return <Workspace icon={Bot} eyebrow={t('s.agentsEyebrow')} title={t('nav.agents')} copy={t('s.agentsCopy')} action={<button type="button" className="secondary-action" onClick={onSettings}><Settings /> Kernel</button>}>
    <AgentConnector variant="hero" connected={connected} kernelUrl={kernelUrl} agents={snapshot?.agents} onConnectKernel={onSettings} onTest={onTestAgents ?? (async () => snapshot?.agents)} />
    <button type="button" className="primary-action" onClick={onNewGoal}><Target /> {t('s.prepareMission')}</button>
  </Workspace>;
}

export function AutomationsView({ missions, connected, onNewGoal }: { missions: MissionSummary[]; connected: boolean; onNewGoal: () => void }) {
  const withCadence = missions.filter((mission) => typeof mission.cadence === 'string');
  return <Workspace icon={Workflow} eyebrow="Persisted intents only" title="Automations" copy={t('s.autoCopy')} action={<button type="button" className="primary-action" onClick={onNewGoal}><Target /> {t('s.newGoal')}</button>}>
    {!connected ? <Empty icon={CircleOff} title={t('s.kernelOffline')} copy={t('s.autoOffline')} /> : <><div className="automation-cards"><article><Workflow /><div><strong>{t('s.missionWatch')}</strong><small>{t('s.missionWatchCopy')}</small></div><StatePill state="available" /></article><article><ShieldCheck /><div><strong>{t('s.limitedRetries')}</strong><small>{t('s.limitedRetriesCopy')}</small></div><StatePill state="available" /></article></div>{withCadence.length ? <div className="record-list">{withCadence.map((mission) => <article key={mission.id}><div className="record-icon"><Workflow /></div><div><strong>{String(mission.cadence)}</strong><small>{mission.id}</small></div><StatePill state={missionPillState(mission)} /></article>)}</div> : <p className="truth-card"><ShieldCheck /> {t('s.noRecurrences')}</p>}</>}
  </Workspace>;
}

/** The Kernel the Windows installer starts (efesto-windows-stack.mjs KERNEL_PORT). */
const DEFAULT_KERNEL_URL = 'http://127.0.0.1:4310';

export function SettingsView({ connected, connecting, rememberSession, snapshot, kernelBaseUrl, onConnect, onLocalConnect, onExtensionConnect, onDisconnect, onRefresh }: { connected: boolean; onLocalConnect?: () => void; connecting: boolean; rememberSession: boolean; snapshot?: OverviewSnapshot; kernelBaseUrl?: string; onConnect: (event: FormEvent<HTMLFormElement>) => void; onExtensionConnect?: () => void; onDisconnect: () => void; onRefresh: () => void }) {
  const bootstrap = snapshot?.readiness.bootstrap;
  return <Workspace icon={Settings} eyebrow={t('settings.eyebrow')} title={t('settings.title')} copy={t('settings.copy')}>
    <div className="settings-layout"><form className="connection-card" onSubmit={onConnect}><header><span className={`kernel-dot ${connected ? 'online' : 'offline'}`} /><div><small>{t('settings.device').toUpperCase()}</small><strong>{connected ? t('settings.connected') : t('settings.connectKernel')}</strong></div></header>{!connected ? <><button type="button" className="primary-action" onClick={onLocalConnect} disabled={connecting || !onLocalConnect}>{connecting ? t('settings.connecting') : t('settings.autoConnect')}</button><p>{t('settings.autoHelp')}</p><details className="connection-advanced"><summary>{t('settings.advanced')}</summary><p>{t('s.advancedHelp')}</p><button type="button" className="secondary-action" onClick={onExtensionConnect} disabled={connecting || !onExtensionConnect}>{t('s.connectExtension')}</button><label>{t('s.kernelUrl')}<input name="baseUrl" aria-label={t('s.kernelUrl')} type="url" defaultValue={DEFAULT_KERNEL_URL} required /></label><label>{t('s.privateToken')}<input name="token" aria-label={t('s.privateToken')} type="password" autoComplete="off" placeholder={t('s.optionalPairing')} /></label><label>{t('s.pairingCode')}<input name="pairingCode" aria-label={t('s.pairingCode')} inputMode="text" autoComplete="off" placeholder="ABCD-1234" /></label><label className="remember-row"><input name="rememberSession" type="checkbox" defaultChecked={rememberSession} /><span><strong>{t('s.rememberSession')}</strong><small>{t('s.rememberHelp')}</small></span></label><div className="connection-actions"><button type="submit" name="action" value="pair" className="primary-action" disabled={connecting}>{connecting ? t('s.pairing') : t('s.pairWithCode')}</button><button type="submit" name="action" value="token" className="secondary-action" disabled={connecting}>{t('s.authorizeDevice')}</button></div></details></> : <div className="connection-actions"><button type="button" className="primary-action" onClick={onRefresh}><RefreshCw /> {t('settings.checkNow')}</button><button type="button" className="danger-action" onClick={onDisconnect}>{t('settings.disconnect')}</button></div>}</form><section className="readiness-card"><header><ShieldCheck /><div><small>{t('settings.realStatus').toUpperCase()}</small><strong>{statusEs(bootstrap?.overall ?? (connected ? 'connected' : 'offline'))}</strong></div></header><ReadinessRow label="Kernel" value={statusEs(snapshot?.readiness.kernel === 'offline' ? 'offline' : bootstrap?.kernel ?? (connected ? 'ready' : 'offline'))} ready={connected && snapshot?.readiness.kernel !== 'offline'} />{(() => { const hermes = hermesReadiness(bootstrap?.hermes, snapshot?.agents?.agents.find((agent) => agent.id === 'hermes')); return <ReadinessRow label="Hermes" value={statusEs(hermes.value)} ready={hermes.ready} />; })()}<ReadinessRow label="Obsidian" value={statusEs(bootstrap?.obsidian ?? 'unconfigured')} ready={bootstrap?.obsidian === 'ready'} /><ReadinessRow label={t('settings.extensionOptional')} value={bootstrap?.pairing === 'paired' ? t('status.paired') : t('status.unused')} ready={bootstrap?.pairing === 'paired'} /><details className="readiness-advanced"><summary>{t('settings.advanced')}</summary><a href={replayLabHref(kernelBaseUrl)} target="_blank" rel="noreferrer">{t('s.openReplayLab')} <ExternalLink /></a></details></section><LanguageCard /></div>
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
function connectAction(onConnect?: () => void) { return onConnect ? { label: t('s.connectKernel'), onClick: onConnect } : undefined; }
function newGoalAction(onNewGoal?: () => void) { return onNewGoal ? { label: t('s.createGoal'), onClick: onNewGoal } : undefined; }
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
  if (phase === 'thinking') return { label: t('s.chatting'), detail: t('s.modelStreaming') };
  if (phase === 'investigating') return { label: t('s.investigating'), detail: t('s.hermesRunning') };
  if (phase === 'verifying') return { label: t('s.verifyingEvidence'), detail: t('s.kernelGates') };
  // Verification finished with zero Kernel SUPPORT while the Mission honestly stays
  // verifying: must not keep claiming gates are still running.
  if (phase === 'verified_unsupported') return { label: t('s.noSupport'), detail: t('s.noPageSupports') };
  if (phase === 'queued') return { label: t('s.missionPrepared'), detail: t('s.waitingAgent') };
  if (phase === 'forged') {
    // Fail-close Home forge-state-action (page.tsx → EfestoProductShell → HomeView):
    // forgeSupportedFindCount is focused GoalSurface SUPPORT (findCount when
    // verificationResults are stripped) — not global inbox length.
    // forged without Kernel SUPPORT Finds must not read like Completado/useful Find;
    // with SUPPORT Finds, name them like extension Living Forge / mission-state.
    if (supportedFindCount > 0) {
      return {
        label: supportedFindCount === 1 ? t('s.findForged1') : t('s.findsForged'),
        detail: supportedFindCount === 1
          ? t('s.oneFindPassed')
          : t('s.nFindsPassed', { count: supportedFindCount }),
      };
    }
    return { label: t('s.researchEnded'), detail: t('s.noFindPassed') };
  }
  // Bare completed (no forged Evidence) — same honesty as Actividad completed_without_forge
  // / extension Research ended without Evidence. Must not fall through to Forja lista.
  if (phase === 'completed') {
    return { label: t('s.endedNoEvidence'), detail: t('s.attemptNoEvidence') };
  }
  if (phase === 'failed') return { label: t('s.attention'), detail: t('s.lastFailed') };
  if (phase === 'blocked') return { label: 'BLOCKED', detail: t('s.policyDenied') };
  if (phase === 'unavailable') return { label: t('s.hermesUnavailable'), detail: t('s.agentNotReady') };
  if (phase === 'ready') return { label: t('s.forgeReady'), detail: t('s.readyNewGoal') };
  return { label: t('s.localOffline'), detail: t('s.noSimulated') };
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