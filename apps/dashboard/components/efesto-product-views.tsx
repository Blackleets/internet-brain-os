'use client';

import Image from 'next/image';
import {
  Activity, ArrowLeft, Bot, BrainCircuit, Check, ChevronDown, ChevronRight, CircleOff, ExternalLink, FileSearch, Languages,
  History, Menu, MessageSquare, MoreHorizontal, Pause, Plug, Plus, RefreshCw, Search, Send, Settings, ShieldCheck, Sparkles, Target, Workflow, X,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { CaseSummary, GoalIntelligencePlan, IntegrationAction, IntegrationCatalog, IntegrationSummary, MissionSummary, ModelForgeSummary, OpportunitySummary } from '../lib/kernel/contracts';
import type { OverviewSnapshot } from '../lib/kernel/overview';
import { EFESTO_LOCALES, useEfestoLocale, type EfestoLocale } from '../lib/efesto-i18n';

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
  tags?: string[]; entityIds?: string[]; relationshipIds?: string[]; contentHash?: string; sourceReceiptId?: string;
  integration?: string; goalId?: string; authorizationId?: string; provider?: string; operation?: string; scope?: string;
};
export type GitHubAuthorizationSummary = {
  id: string; goalId: string; scope: string; approvedCapabilities: string[]; issuedAt: string; expiresAt: string;
  status: 'active' | 'expired' | 'revoked' | 'invalid'; revokedAt?: string;
};
export type CaseDetail = { case: Record<string, unknown>; evidence: EvidenceRecord[]; githubAuthorization?: GitHubAuthorizationSummary };
export type BrainPhase = 'offline' | 'ready' | 'queued' | 'investigating' | 'verifying' | 'forged' | 'thinking' | 'failed';

const starterGoalKeys = ['starter.goal1', 'starter.goal2', 'starter.goal3', 'starter.goal4'];

export function HomeView({ phase, chatMode, messages, preparedGoal, goalPlan, goalPlanPending, connected, goalPending, input, onInputChange, onSubmit, onToggleChat, chatPending, onStopChat, chatAvailable, submitDisabled, onConfirmGoal, onRunGitHubEvidence, onEditGoal, onOpenModels, modelLabel, providers, selectedProviderId, selectedModel, onSelectModel, onOpenSettings, onOpenAgents, onOpenNav, valueSurface }: {
  phase: BrainPhase; chatMode: boolean; messages: ChatMessage[]; preparedGoal: string; goalPlan?: GoalIntelligencePlan; goalPlanPending: boolean; connected: boolean; goalPending: boolean;
  input: string; onInputChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleChat: (value: boolean) => void; chatPending: boolean; onStopChat: () => void; chatAvailable: boolean; submitDisabled: boolean;
  onConfirmGoal: () => void; onRunGitHubEvidence: (input: { owner: string; repo: string; consent: boolean }) => void; onEditGoal: () => void;
  onOpenModels: () => void; modelLabel: string; providers: Provider[]; selectedProviderId: string; selectedModel: string;
  onSelectModel: (providerId: string, model: string) => void; onOpenSettings: () => void; onOpenAgents: () => void; onOpenNav: () => void; valueSurface?: ReactNode;
}) {
  const { t } = useEfestoLocale();
  const starterGoals = starterGoalKeys.map((key) => t(key));
  const state = brainState(phase, t);
  const showSuggestions = !input.trim() && (chatMode ? messages.length === 0 : !preparedGoal);
  const surfaceTitle = chatMode
    ? (messages.length ? t('home.conversation') : t('home.newConversation'))
    : (preparedGoal ? t('home.goalPrepared') : t('home.newGoal'));

  return <section className={'forge-surface ' + (chatMode ? 'is-chat' : 'is-goal')} aria-label={chatMode ? t('home.chatWithEfesto') : t('home.newGoalAria')}>
    <header className="forge-surface-bar">
      <div className="forge-surface-leading">
        <button type="button" className="forge-menu-button" onClick={onOpenNav} aria-label={t('nav.toggle')}><Menu /></button>
        <div className="forge-product-title">
          <span className="forge-agent-mark"><Image src="/efesto-smith.svg" alt="" width={28} height={28} /></span>
          <span><strong>{surfaceTitle}</strong><small>Efesto · {chatMode ? (chatAvailable ? modelLabel : t('home.modelNotConfigured')) : t('home.controlledMission')}</small></span>
        </div>
      </div>

      <ModeSwitcher chatMode={chatMode} onToggleChat={onToggleChat} />

      <button type="button" className={'forge-state-action phase-' + phase} onClick={onOpenSettings} aria-label={connected ? t('kernel.connected') : t('settings.connectKernel')}>
        <i />
        <span>{connected ? state.label : t('settings.connectKernel')}</span>
        <Plug />
      </button>
    </header>

    <div className="forge-scroll">
      {chatMode ? messages.length ? <section className="forge-thread" aria-label={t('home.messages')}>
        {messages.map((message, index) => <article className={'forge-message ' + message.role} key={message.role + '-' + index}>
          <div className="forge-message-avatar">{message.role === 'user' ? t('home.you') : <Image src="/efesto-smith.svg" alt="" width={24} height={24} />}</div>
          <div className="forge-message-body">
            <header><strong>{message.role === 'user' ? t('home.you') : message.model ?? 'Efesto'}</strong>{message.role === 'assistant' ? <span><ShieldCheck /> {t('common.private')}</span> : null}</header>
            <p>{message.content || (chatPending && index === messages.length - 1 ? <span className="forge-generating"><i />{t('home.thinking')}</span> : null)}</p>
          </div>
        </article>)}
      </section> : <section className="forge-empty" aria-label={t('home.newConversationAria')}>
        <span className="forge-empty-mark"><Image src="/efesto-smith.svg" alt="" width={52} height={52} /></span>
        <small>{t('home.emptyEyebrow')}</small>
        <h1>{t('home.emptyHeading')}</h1>
        <p>{t('home.emptyCopy')}</p>
        <div className="forge-empty-meta"><span><ShieldCheck /> {t('common.privateByDesign')}</span><span><i /> {t('home.noAutomaticMemory')}</span></div>
      </section> : preparedGoal ? <section className="forge-goal-plan" aria-label={t('home.planAria')}>
        <header>
          <span className="forge-plan-icon"><Target /></span>
          <div><small>{t('home.planEyebrow')}</small><h1>{preparedGoal}</h1><p>{t('home.reviewScope')}</p></div>
        </header>
        <ol>
          <li><b>1</b><span><strong>{t('home.createGoal')}</strong><small>{t('home.goalKeywords')}</small></span></li>
          <li><b>2</b><span><strong>{t('home.confirmMission')}</strong><small>{t('home.confirmAfter')}</small></span></li>
          <li><b>3</b><span><strong>{t('home.forgeEvidence')}</strong><small>{t('home.forgeEvidenceCopy')}</small></span></li>
        </ol>
        <GoalIntelligenceBrief plan={goalPlan} pending={goalPlanPending} connected={connected} goalPending={goalPending} onOpenSettings={onOpenSettings} onOpenAgents={onOpenAgents} onRunGitHubEvidence={onRunGitHubEvidence} />
        <div className="forge-plan-actions">
          <button type="button" className="primary-action" disabled={!connected || goalPending} onClick={onConfirmGoal}>{goalPending ? t('home.confirming') : connected ? goalPlan?.readiness === 'needs_setup' ? t('home.confirmWithPending') : t('home.confirmAndExecute') : t('home.connectToExecute')}</button>
          <button type="button" className="secondary-action" onClick={onEditGoal}>{t('home.editGoal')}</button>
        </div>
        <p className="forge-plan-boundary"><ShieldCheck /> {t('home.boundary')}</p>
      </section> : <section className="forge-empty forge-goal-empty" aria-label={t('home.newGoalAria')}>
        <span className="forge-empty-mark"><Target /></span>
        <small>{t('home.controlledMissionEyebrow')}</small>
        <h1>{t('home.defineResult')}</h1>
        <p>{t('home.prepareCopy')}</p>
        <div className="forge-empty-meta"><span><ShieldCheck /> {t('home.kernelGated')}</span><span><i /> {t('home.humanConfirmation')}</span></div>
      </section>}
      {valueSurface ? <div className="forge-value-surface" aria-label={t('home.valueSurface')}>{valueSurface}</div> : null}
    </div>

    <ComposerForm
      input={input}
      chatMode={chatMode}
      chatAvailable={chatAvailable}
      chatPending={chatPending}
      submitDisabled={submitDisabled}
      suggestions={showSuggestions ? starterGoals : []}
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
    />
  </section>;
}

function GoalIntelligenceBrief({ plan, pending, connected, goalPending, onOpenSettings, onOpenAgents, onRunGitHubEvidence }: {
  plan?: GoalIntelligencePlan;
  pending: boolean;
  connected: boolean;
  goalPending: boolean;
  onOpenSettings: () => void;
  onOpenAgents: () => void;
  onRunGitHubEvidence: (input: { owner: string; repo: string; consent: boolean }) => void;
}) {
  const { t } = useEfestoLocale();
  if (pending) {
    return <section className="forge-intelligence-brief is-loading" aria-label={t('home.intelligenceAria')} aria-busy="true">
      <header><span className="forge-intelligence-icon"><Sparkles /></span><div><small>{t('home.intelligenceEyebrow')}</small><strong>{t('home.intelligenceThinking')}</strong></div><span className="forge-intelligence-loader"><i /><i /><i /></span></header>
      <p>{t('home.intelligenceThinkingCopy')}</p>
    </section>;
  }

  if (!plan) {
    return <section className="forge-intelligence-brief is-limited" aria-label={t('home.intelligenceAria')}>
      <header><span className="forge-intelligence-icon"><Sparkles /></span><div><small>{t('home.intelligenceEyebrow')}</small><strong>{t('home.intelligenceWaiting')}</strong></div><StatePill state={connected ? 'unavailable' : 'offline'} /></header>
      <p>{connected ? t('home.intelligenceUnavailable') : t('home.intelligenceConnectCopy')}</p>
      <button type="button" className="forge-intelligence-link" onClick={onOpenSettings}><Plug /> {connected ? t('home.openSettings') : t('home.connectKernel')}</button>
    </section>;
  }

  const primaryCategory = plan.intent.primaryCategory
    ? goalCategoryLabel(plan.intent.primaryCategory, t)
    : t('home.intentResearch');
  const githubSource = plan.sources.find((source) => source.id === 'github');
  const readinessState = plan.readiness === 'ready' ? 'ready' : plan.readiness === 'needs_setup' ? 'checking' : 'unavailable';
  return <section className={`forge-intelligence-brief readiness-${plan.readiness}`} aria-label={t('home.intelligenceAria')}>
    <header>
      <span className="forge-intelligence-icon"><Sparkles /></span>
      <div><small>{t('home.intelligenceEyebrow')}</small><strong>{t('home.intelligenceTitle')}</strong></div>
      <StatePill state={readinessState} />
    </header>
    <div className="forge-intelligence-intent"><small>{t('home.intentEyebrow')}</small><strong>{t('home.intentDetected', { category: primaryCategory })}</strong><span>{plan.intent.mode === 'connector_research' ? t('home.intentConnector') : t('home.intentPublic')}</span></div>
    <div className="forge-intelligence-sources">
      <div className="forge-intelligence-sources-heading"><span>{t('home.sourcesSelected')}</span><b>{plan.sources.length}</b></div>
      {plan.sources.map((source) => <article key={source.id} className={`forge-intelligence-source status-${source.status}`}>
        <span className="forge-intelligence-source-mark"><IntegrationMark id={source.id} /></span>
        <div><strong>{t(`integrations.${source.id}.name`)}</strong><small>{source.reason === 'public_research' ? t('home.sourceReason.publicResearch') : t('home.sourceReason.goalSignal')} · {source.scopes.join(' · ')}</small></div>
        <StatePill state={source.status} />
        {source.status !== 'ready' && source.action ? <button type="button" className="forge-intelligence-source-action" onClick={source.action === 'agents' ? onOpenAgents : onOpenSettings}>{t('home.configure')}</button> : null}
      </article>)}
    </div>
    {githubSource?.status === 'ready' ? <GitHubEvidenceAction pending={goalPending} onSubmit={onRunGitHubEvidence} /> : null}
    <footer><ShieldCheck /> <span>{plan.readiness === 'ready' ? t('home.sourcePlanReady') : t('home.sourcePlanLimited')}</span></footer>
  </section>;
}

function GitHubEvidenceAction({ pending, onSubmit }: { pending: boolean; onSubmit: (input: { owner: string; repo: string; consent: boolean }) => void }) {
  const { t } = useEfestoLocale();
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [consent, setConsent] = useState(false);
  const normalizedOwner = owner.trim();
  const normalizedRepo = repo.trim();
  const ready = Boolean(normalizedOwner && normalizedRepo && consent);

  return <form className="forge-github-action" onSubmit={(event) => {
    event.preventDefault();
    if (ready) onSubmit({ owner: normalizedOwner, repo: normalizedRepo, consent });
  }}>
    <header><span className="forge-github-action-mark"><IntegrationMark id="github" /></span><div><small>{t('home.githubActionEyebrow')}</small><strong>{t('home.githubActionTitle')}</strong></div><span className="forge-github-readonly-pill">{t('home.githubReadOnly')}</span></header>
    <p>{t('home.githubActionCopy')}</p>
    <div className="forge-github-repository-fields">
      <label>{t('home.githubOwner')}<input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder={t('home.githubOwnerPlaceholder')} autoComplete="off" spellCheck={false} required /></label>
      <label>{t('home.githubRepository')}<input value={repo} onChange={(event) => setRepo(event.target.value)} placeholder={t('home.githubRepositoryPlaceholder')} autoComplete="off" spellCheck={false} required /></label>
    </div>
    <label className="forge-github-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{t('home.githubConsent')}</span></label>
    <div className="forge-github-action-footer"><small><ShieldCheck /> {t('home.githubReadScope')}</small><button type="submit" className="secondary-action" disabled={!ready || pending}>{pending ? t('home.githubAnalyzing') : t('home.githubAnalyze')}</button></div>
  </form>;
}

function goalCategoryLabel(category: string, t: (key: string, values?: Record<string, string | number>) => string) {
  const key = `home.category.${category}`;
  const label = t(key);
  return label === key ? category : label;
}

function ModeSwitcher({ chatMode, onToggleChat }: { chatMode: boolean; onToggleChat: (value: boolean) => void }) {
  const { t } = useEfestoLocale();
  return <div className="forge-mode-switcher" role="group" aria-label={t('home.workMode')}>
    <button type="button" aria-pressed={chatMode} className={chatMode ? 'active' : ''} onClick={() => onToggleChat(true)}><MessageSquare /> <span>{t('home.chat')}</span></button>
    <button type="button" aria-pressed={!chatMode} className={!chatMode ? 'active' : ''} onClick={() => onToggleChat(false)}><Target /> <span>{t('home.goal')}</span></button>
  </div>;
}

function ComposerForm({ input, chatMode, chatAvailable, chatPending, submitDisabled, suggestions, onInputChange, onSubmit, onStopChat, onOpenModels, modelLabel, providers, selectedProviderId, selectedModel, connected, onSelectModel, onOpenSettings }: {
  input: string; chatMode: boolean; chatAvailable: boolean; chatPending: boolean; submitDisabled: boolean; suggestions: string[];
  onInputChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStopChat: () => void; onOpenModels: () => void; modelLabel: string; providers: Provider[]; selectedProviderId: string; selectedModel: string;
  connected: boolean; onSelectModel: (providerId: string, model: string) => void; onOpenSettings: () => void;
}) {
  const { t } = useEfestoLocale();
  const suggestionSignature = suggestions.join('\u0000');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (!suggestions.length) return;
    setSuggestionIndex(Math.floor(Math.random() * suggestions.length));
  }, [suggestionSignature, chatMode]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncMotionPreference();
    mediaQuery.addEventListener?.('change', syncMotionPreference);
    return () => mediaQuery.removeEventListener?.('change', syncMotionPreference);
  }, []);

  useEffect(() => {
    if (suggestions.length < 2 || prefersReducedMotion) return;
    const interval = window.setInterval(() => {
      setSuggestionIndex((current) => (current + 1) % suggestions.length);
    }, 9000);
    return () => window.clearInterval(interval);
  }, [suggestionSignature, suggestions.length, prefersReducedMotion]);

  const activeSuggestion = suggestions.length ? suggestions[suggestionIndex % suggestions.length] : undefined;
  const placeholder = chatMode
    ? chatAvailable ? activeSuggestion ?? t('composer.chatPlaceholder') : t('composer.chatNeedsModel')
    : activeSuggestion ?? t('composer.goalPlaceholder');

  return <div className="forge-composer-zone">
    <form className={'forge-composer ' + (chatMode ? 'is-chat' : 'is-goal')} onSubmit={onSubmit}>
      <textarea
        aria-label={chatMode ? t('composer.message') : t('composer.goal')}
        aria-describedby="forge-composer-note"
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
        rows={1}
        placeholder={placeholder}
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
          /> : <span className="forge-kernel-gate"><ShieldCheck /> {t('composer.controlledByKernel')}</span>}
        </div>
        <span className="forge-shortcut">{chatMode ? t('composer.enterSend') : t('composer.enterPrepare')}</span>
        {chatPending ? <button type="button" className="forge-send stop" onClick={onStopChat} aria-label={t('composer.stopGeneration')}><Pause /></button> : <button type="submit" className="forge-send" disabled={submitDisabled} aria-label={chatMode ? t('composer.sendMessage') : t('composer.prepareGoal')}><Send /></button>}
      </footer>
    </form>
    <p className="forge-composer-hint" id="forge-composer-note">{chatMode ? t('composer.chatBoundary') : t('composer.goalBoundary')}</p>
  </div>;
}

function ModelSelector({ providers, selectedProviderId, selectedModel, connected, chatAvailable, modelLabel, onSelectModel, onOpenModels, onOpenSettings }: {
  providers: Provider[]; selectedProviderId: string; selectedModel: string; connected: boolean; chatAvailable: boolean; modelLabel: string;
  onSelectModel: (providerId: string, model: string) => void; onOpenModels: () => void; onOpenSettings: () => void;
}) {
  const { t } = useEfestoLocale();
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
      <span className="forge-model-trigger-label">{chatAvailable ? modelLabel : connected ? t('model.choose') : t('model.configure')}</span>
      <ChevronDown className="forge-model-chevron" />
    </button>

    {open ? <section className="forge-model-popover" id="forge-model-selector" role="dialog" aria-label={t('model.select')}>
      <header className="forge-model-popover-header">
        <span><small>{t('model.kernelModelsEyebrow')}</small><strong>{connected ? modelCount === 1 ? t('model.available.one') : t('model.available.many', { count: modelCount }) : t('model.noConnection')}</strong></span>
        <button type="button" onClick={() => { setOpen(false); setQuery(''); }} aria-label={t('model.closeSelector')}><X /></button>
      </header>

      {!connected ? <div className="forge-model-empty">
        <span><Plug /></span>
        <strong>{t('model.connect')}</strong>
        <p>{t('model.selectorCopy')}</p>
        <button type="button" onClick={() => closeAndRun(onOpenSettings)}>{t('model.connect')}</button>
      </div> : modelCount === 0 ? <div className="forge-model-empty">
        <span><BrainCircuit /></span>
        <strong>{t('model.noConfigured')}</strong>
        <p>{t('model.noConfiguredCopy')}</p>
        <button type="button" onClick={() => closeAndRun(onOpenModels)}>{t('model.manageProviders')}</button>
      </div> : <>
        <label className="forge-model-search">
          <Search />
          <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${t('model.search')}…`} aria-label={t('model.search')} />
        </label>
        <div className="forge-model-list" role="listbox" aria-label={t('model.availableList')}>
          {visibleProviders.length ? visibleProviders.map((provider) => <div className="forge-model-provider" role="group" aria-label={provider.label} key={provider.id}>
            <header><span>{provider.label}</span><small>{provider.type === 'ollama' ? t('model.localOllama') : t('model.compatibleApi')}</small></header>
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
                <span><strong>{model}</strong><small>{provider.managedBy === 'environment' ? t('model.privateEnvironment') : t('model.localKernel')}</small></span>
                {active ? <Check /> : null}
              </button>;
            })}
          </div>) : <div className="forge-model-no-results"><Search /><span><strong>{t('model.searchNoResults')}</strong><small>{t('model.searchTryAgain')}</small></span></div>}
        </div>
        <footer className="forge-model-popover-footer">
          <button type="button" onClick={() => closeAndRun(onOpenModels)}><Settings /><span>{t('model.manage')}</span><ChevronRight /></button>
        </footer>
      </>}
    </section> : null}
  </div>;
}

export function MissionsView({ snapshot, onNew }: { snapshot?: OverviewSnapshot; onNew: () => void }) {
  const { t } = useEfestoLocale();
  const missions = snapshot?.missions ?? [];
  const goals = snapshot?.goals ?? [];
  const goalName = (id: string) => goals.find((goal) => goal.id === id)?.title ?? id;
  return <Workspace icon={Target} eyebrow={t('missions.eyebrow')} title={t('missions.title')} copy={t('missions.copy')} action={<button type="button" className="primary-action" onClick={onNew}><Target /> {t('missions.newGoal')}</button>}>
    {!snapshot ? <Empty icon={CircleOff} title={t('missions.offlineTitle')} copy={t('missions.offlineCopy')} /> : missions.length === 0 ? <Empty icon={Target} title={t('missions.emptyTitle')} copy={t('missions.emptyCopy')} /> : <div className="record-list">{missions.map((mission) => <article key={mission.id}><div className="record-icon"><Target /></div><div><strong>{goalName(mission.goalId)}</strong><small>{mission.id} · {t('missions.attempt', { count: mission.attempt ?? 0 })}</small></div><StatePill state={mission.executionPhase ?? mission.status} /></article>)}</div>}
  </Workspace>;
}

export function FindsView({ opportunities, connected, onFeedback }: { opportunities: OpportunitySummary[]; connected: boolean; onFeedback: (id: string, signal: 'useful' | 'saved' | 'dismissed' | 'not_interested') => void }) {
  const { t } = useEfestoLocale();
  return <Workspace icon={Sparkles} eyebrow={t('finds.eyebrow')} title={t('finds.title')} copy={t('finds.copy')}>
    {!connected ? <Empty icon={CircleOff} title={t('missions.offlineTitle')} copy={t('finds.offlineCopy')} /> : opportunities.length === 0 ? <Empty icon={Search} title={t('finds.emptyTitle')} copy={t('finds.emptyCopy')} /> : <div className="find-grid">{opportunities.map((item) => <article key={item.id}><header><span>{item.categoryLabel}</span><StatePill state={item.status} /></header><h2>{item.title}</h2><p>{item.sourceHost} · {t('finds.relevance', { value: formatRelevance(item.relevance) })}</p><div className="find-next"><small>{t('finds.nextStep')}</small><strong>{item.nextAction}</strong></div><div className="find-actions"><button type="button" onClick={() => onFeedback(item.id, 'useful')}><Check /> {t('finds.useful')}</button><button type="button" onClick={() => onFeedback(item.id, 'saved')}><History /> {t('finds.save')}</button><button type="button" onClick={() => onFeedback(item.id, 'dismissed')}><X /> {t('finds.dismiss')}</button></div></article>)}</div>}
  </Workspace>;
}

export function EvidenceView({ cases, selectedId, detail, loadingId, connected, githubAuthorizationBusy, onOpen, onRevokeGithubAuthorization }: { cases: CaseSummary[]; selectedId: string; detail?: CaseDetail; loadingId: string; connected: boolean; githubAuthorizationBusy: boolean; onOpen: (record: CaseSummary) => void; onRevokeGithubAuthorization: (authorizationId: string) => void }) {
  const { t, locale } = useEfestoLocale();
  return <Workspace icon={ShieldCheck} eyebrow={t('evidence.eyebrow')} title={t('evidence.title')} copy={t('evidence.copy')}>
    {!connected ? <Empty icon={CircleOff} title={t('missions.offlineTitle')} copy={t('evidence.offlineCopy')} /> : <div className="evidence-layout"><section className="case-list"><header><span>{t('evidence.cases')}</span><b>{cases.length}</b></header>{cases.length ? cases.map((record) => <button type="button" key={record.id} className={selectedId === record.id ? 'active' : ''} onClick={() => onOpen(record)}><FileSearch /><span><strong>{record.title}</strong><small>{statusLabel(record.status, t)} · {record.id}</small></span><ChevronRight /></button>) : <Empty icon={FileSearch} title={t('evidence.emptyTitle')} copy={t('evidence.emptyCopy')} />}</section><section className="evidence-detail">{!selectedId ? <Empty icon={ShieldCheck} title={t('evidence.selectCase')} copy={t('evidence.selectCaseCopy')} /> : loadingId === selectedId ? <Empty icon={Activity} title={t('evidence.loading')} copy={t('evidence.loadingCopy')} /> : !detail ? <Empty icon={CircleOff} title={t('evidence.unavailable')} copy={t('evidence.unavailableCopy')} /> : detail.evidence.length === 0 ? <Empty icon={ShieldCheck} title={t('evidence.emptyCase')} copy={t('evidence.emptyCaseCopy')} /> : <div className="evidence-receipts"><header><small>{t('evidence.caseLabel')}</small><h2>{recordTitle(detail.case, selectedId)}</h2></header>{detail.githubAuthorization ? <GitHubAuthorityCard authorization={detail.githubAuthorization} busy={githubAuthorizationBusy} onRevoke={onRevokeGithubAuthorization} /> : null}{detail.evidence.map((item, index) => <article key={item.id ?? index}><ShieldCheck /><div><strong>{item.summary ?? item.id ?? `${t('common.evidence')} ${index + 1}`}</strong><small>{typeof item.confidence === 'number' ? t('evidence.confidence', { value: Math.round(item.confidence * 100) }) : t('evidence.confidenceUnknown')}{item.capturedAt ? ` · ${formatDate(item.capturedAt, locale)}` : ''}</small>{item.tags?.length ? <p>{item.tags.join(' · ')}</p> : null}</div>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">{t('evidence.openSource')} <ExternalLink /></a> : <span className="source-missing">{t('evidence.noUrl')}</span>}</article>)}</div>}</section></div>}
  </Workspace>;
}

function GitHubAuthorityCard({ authorization, busy, onRevoke }: { authorization: GitHubAuthorizationSummary; busy: boolean; onRevoke: (authorizationId: string) => void }) {
  const { t, locale } = useEfestoLocale();
  const [confirming, setConfirming] = useState(false);
  const active = authorization.status === 'active';
  return <section className={`forge-evidence-authority status-${authorization.status}`} aria-label={t('evidence.githubAuthorityAria')}>
    <header><span className="forge-evidence-authority-mark"><ShieldCheck /></span><div><small>{t('evidence.githubAuthorityEyebrow')}</small><strong>{t('evidence.githubAuthorityTitle')}</strong></div><StatePill state={authorization.status} /></header>
    <p>{t('evidence.githubAuthorityCopy')}</p>
    <div className="forge-evidence-authority-grid"><span><small>{t('evidence.githubScope')}</small><strong>{authorization.scope}</strong></span><span><small>{t('evidence.githubCapabilities')}</small><strong>{authorization.approvedCapabilities.join(' · ')}</strong></span><span><small>{t('evidence.githubExpires')}</small><strong>{formatDate(authorization.expiresAt, locale)}</strong></span></div>
    {active ? confirming ? <div className="forge-evidence-authority-confirm"><small>{t('evidence.githubRevokeConfirmCopy')}</small><div><button type="button" className="danger-action" onClick={() => { setConfirming(false); onRevoke(authorization.id); }} disabled={busy}>{busy ? t('evidence.githubRevoking') : t('evidence.githubConfirmRevoke')}</button><button type="button" className="secondary-action" onClick={() => setConfirming(false)} disabled={busy}>{t('evidence.githubCancelRevoke')}</button></div></div> : <button type="button" className="forge-evidence-authority-revoke" onClick={() => setConfirming(true)} disabled={busy}>{t('evidence.githubRevoke')}</button> : <small className="forge-evidence-authority-closed"><ShieldCheck />{authorization.status === 'revoked' ? t('evidence.githubRevoked') : authorization.status === 'expired' ? t('evidence.githubExpired') : t('evidence.githubInvalid')}</small>}
  </section>;
}

export function ModelsView({ providers, selectedProviderId, selectedModel, modelForge, connected, onSelect, onAdd }: { providers: Provider[]; selectedProviderId: string; selectedModel: string; modelForge?: ModelForgeSummary; connected: boolean; onSelect: (providerId: string, model: string) => void; onAdd: (event: FormEvent<HTMLFormElement>) => void }) {
  const { t } = useEfestoLocale();
  return <Workspace icon={BrainCircuit} eyebrow={t('models.eyebrow')} title={t('models.title')} copy={t('models.copy')}>
    {!connected ? <Empty icon={CircleOff} title={t('missions.offlineTitle')} copy={t('models.offlineCopy')} /> : <div className="models-layout"><section className="model-list"><header><span>{t('models.available')}</span><b>{providers.reduce((total, provider) => total + provider.models.length, 0)}</b></header>{providers.length ? providers.flatMap((provider) => provider.models.map((model) => <button type="button" className={provider.id === selectedProviderId && model === selectedModel ? 'active' : ''} key={`${provider.id}:${model}`} onClick={() => onSelect(provider.id, model)}><BrainCircuit /><span><strong>{model}</strong><small>{provider.label} · {provider.managedBy === 'environment' ? t('model.privateEnvironment') : t('model.localKernel')}</small></span>{provider.id === selectedProviderId && model === selectedModel ? <Check /> : <ChevronRight />}</button>)) : <Empty icon={BrainCircuit} title={t('models.emptyTitle')} copy={t('models.emptyCopy')} />}{modelForge ? <div className="forge-hardware"><small>{t('models.forge')}</small><strong>{modelForge.runtime === 'available' ? `${modelForge.hardware.tier} · ${modelForge.hardware.ramGiB} GiB RAM` : t('models.runtimeMissing')}</strong><span>{t('models.recommended', { model: modelForge.recommended })}</span></div> : null}</section><form className="provider-form" onSubmit={onAdd}><header><Plug /><div><small>{t('models.kernelOwned')}</small><strong>{t('models.addProvider')}</strong></div></header><label>{t('models.type')}<select name="type" defaultValue="openai-compatible"><option value="openai-compatible">{t('model.compatibleApi')}</option><option value="ollama">{t('model.localOllama')}</option></select></label><label>{t('models.name')}<input name="label" required placeholder={t('models.providerPlaceholder')} /></label><label>{t('models.endpoint')}<input name="baseUrl" type="url" required placeholder={t('models.endpointPlaceholder')} /></label><label>{t('models.modelList')}<input name="models" required placeholder={t('models.modelsPlaceholder')} /></label><label>{t('models.credential')}<input name="apiKey" type="password" autoComplete="off" placeholder={t('models.credentialOptional')} /></label><button type="submit" className="primary-action"><Plug /> {t('models.saveKernel')}</button><p><ShieldCheck /> {t('models.credentialCopy')}</p></form></div>}
  </Workspace>;
}

export function AgentsView({ snapshot, onSettings, onNewGoal }: { snapshot?: OverviewSnapshot; onSettings: () => void; onNewGoal: () => void }) {
  const { t } = useEfestoLocale();
  const hermes = snapshot?.readiness.bootstrap?.hermes;
  return <Workspace icon={Bot} eyebrow={t('agents.eyebrow')} title={t('agents.title')} copy={t('agents.copy')} action={<button type="button" className="secondary-action" onClick={onSettings}><Settings /> {t('agents.configure')}</button>}>
    <div className="agent-hero"><div className="agent-mark"><Bot /></div><div><small>NOUS RESEARCH</small><h2>Hermes Agent</h2><p>{t('agents.discovery')}</p></div><StatePill state={hermes === 'ready' ? 'ready' : hermes ?? 'offline'} /></div><div className="agent-contract"><span><b>Kernel</b>{snapshot?.readiness.kernel ?? 'offline'}</span><span><b>Hermes</b>{hermes ?? t('status.noDiagnostic')}</span><span><b>{t('agents.missions')}</b>{snapshot?.missions.length ?? 0}</span><span><b>{t('agents.authority')}</b>{t('agents.kernelOnly')}</span></div><button type="button" className="primary-action" onClick={onNewGoal}><Target /> {t('agents.prepareMission')}</button>
  </Workspace>;
}

const integrationSections = [
  { id: 'featured', itemIds: ['kernel', 'hermes', 'model-providers'] },
  { id: 'local', itemIds: ['browser-extension', 'obsidian'] },
  { id: 'external', itemIds: ['mcp-gateway', 'github', 'gmail', 'google-drive', 'notion', 'google-calendar'] },
] as const;

export function IntegrationsView({ catalog, connected, onNavigate, onRefresh, onBack }: { catalog?: IntegrationCatalog; connected: boolean; onNavigate: (action: IntegrationAction) => void; onRefresh: () => void; onBack: () => void }) {
  const { t } = useEfestoLocale();
  const [sectionFilter, setSectionFilter] = useState<'all' | 'featured' | 'local' | 'external'>('all');
  const integrations = catalog?.integrations ?? [];
  const integrationsById = new Map(integrations.map((integration) => [integration.id, integration]));
  const visibleSections = sectionFilter === 'all' ? integrationSections : integrationSections.filter((section) => section.id === sectionFilter);
  const scrollToIntegration = (id: string) => document.getElementById(`forge-addon-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return <section className="workspace forge-integrations-workspace">
    <header className="forge-integrations-toolbar">
      <button type="button" className="forge-integrations-round-button" onClick={onBack} aria-label={t('integrations.back')}><ArrowLeft /></button>
      <label className="forge-integrations-directory-title"><select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value as typeof sectionFilter)} aria-label={t('integrations.directoryTitle')}><option value="all">{t('integrations.directoryTitle')}</option><option value="featured">{t('integrations.section.featured')}</option><option value="local">{t('integrations.section.local')}</option><option value="external">{t('integrations.section.external')}</option></select><ChevronDown aria-hidden="true" /></label>
      <button type="button" className="forge-integrations-round-button" onClick={() => onNavigate('settings')} aria-label={t('integrations.openSettings')}><Settings /></button>
    </header>
    <div className="forge-integrations-intro"><small>{t('integrations.eyebrow')}</small><h1>{t('integrations.title')}</h1><p>{t('integrations.copy')}</p></div>
    {!connected ? <Empty icon={CircleOff} title={t('missions.offlineTitle')} copy={t('integrations.offlineCopy')} /> : !catalog ? <Empty icon={Plug} title={t('integrations.unavailableTitle')} copy={t('integrations.unavailableCopy')} /> : <>
      <div className="forge-addon-icon-strip" aria-label={t('integrations.topAria')}>
        {integrations.map((integration) => <button type="button" key={integration.id} className={`forge-addon-icon-chip status-${integration.status}`} onClick={() => scrollToIntegration(integration.id)} aria-label={t(`integrations.${integration.id}.name`)} title={t(`integrations.${integration.id}.name`)}><IntegrationMark id={integration.id} /></button>)}
      </div>
      <div className="forge-integrations-trustline"><ShieldCheck /><span>{t('integrations.boundaryCopy')}</span><button type="button" onClick={onRefresh} aria-label={t('integrations.refresh')}><RefreshCw /></button></div>
      <div className="forge-addon-sections" aria-label={t('integrations.catalogAria')}>
        {visibleSections.map((section) => {
          const items = section.itemIds.map((id) => integrationsById.get(id)).filter((item): item is IntegrationSummary => Boolean(item));
          if (!items.length) return null;
          return <section className="forge-addon-section" key={section.id} aria-labelledby={`forge-addon-section-${section.id}`}>
            <header><h2 id={`forge-addon-section-${section.id}`}>{t(`integrations.section.${section.id}`)}</h2><span>{items.length}</span></header>
            <div className="forge-addon-list">{items.map((integration) => <IntegrationCard key={integration.id} integration={integration} onNavigate={onNavigate} />)}</div>
          </section>;
        })}
      </div>
    </>}
  </section>;
}

function IntegrationCard({ integration, onNavigate }: { integration: IntegrationSummary; onNavigate: (action: IntegrationAction) => void }) {
  const { t } = useEfestoLocale();
  const nameKey = `integrations.${integration.id}.name`;
  const copyKey = `integrations.${integration.id}.copy`;
  const countLabel = integration.id === 'model-providers' && typeof integration.count === 'number'
    ? t('integrations.modelsCount', { count: integration.count })
    : undefined;
  const configureMcp = integration.adapter === 'mcp' && integration.status !== 'ready';
  const actionLabel = configureMcp ? t('integrations.configure') : integration.action ? t(`integrations.action.${integration.action}`) : undefined;
  return <article id={`forge-addon-${integration.id}`} className={`forge-addon-row status-${integration.status}`}>
    <div className="forge-integration-icon"><IntegrationMark id={integration.id} /></div>
    <div className="forge-integration-copy"><small>{t(`integrations.kind.${integration.kind}`)}</small><h2>{t(nameKey)}</h2><p>{t(copyKey)}</p>{countLabel ? <span className="forge-integration-count">{countLabel}</span> : null}</div>
    <div className="forge-addon-row-footer"><div className="forge-integration-meta"><span>{integration.action && integration.capabilities.length ? t('integrations.capabilities', { count: integration.capabilities.length }) : integration.action ? t('integrations.noCapabilities') : t('integrations.noAction')}</span></div><div className="forge-addon-row-status"><StatePill state={integration.status} /><small>{integration.adapter === 'mcp' ? t('integrations.adapter.mcp') : t('integrations.adapter.native')}</small></div></div>
    {integration.action ? <button type="button" className="forge-addon-row-action" onClick={() => onNavigate(integration.action)} aria-label={actionLabel}>{configureMcp ? <Plus /> : <MoreHorizontal />}</button> : <span className="forge-integration-note" title={t('integrations.mcpPending')} role="img" aria-label={t('integrations.mcpPending')}><Plus /></span>}
  </article>;
}

function IntegrationMark({ id }: { id: string }) {
  const logo = integrationLogo(id);
  if (logo) return <Image className="forge-integration-logo-image" src={logo} alt="" width={32} height={32} data-integration-logo={id} data-testid={`integration-logo-${id}`} />;
  const Icon = integrationIcon(id);
  return <Icon aria-hidden="true" />;
}

function integrationLogo(id: string) {
  const logos: Record<string, string> = {
    'mcp-gateway': '/integrations/mcp.svg',
    github: '/integrations/github.svg',
    gmail: '/integrations/gmail.svg',
    'google-drive': '/integrations/google-drive.svg',
    notion: '/integrations/notion.svg',
    'google-calendar': '/integrations/google-calendar.svg',
  };
  return logos[id];
}

function integrationIcon(id: string) {
  if (id === 'kernel') return ShieldCheck;
  if (id === 'hermes') return Bot;
  if (id === 'obsidian') return BrainCircuit;
  if (id === 'browser-extension') return ExternalLink;
  if (id === 'model-providers') return BrainCircuit;
  return Workflow;
}

export function AutomationsView({ missions, connected, onNewGoal }: { missions: MissionSummary[]; connected: boolean; onNewGoal: () => void }) {
  const { t } = useEfestoLocale();
  const withCadence = missions.filter((mission) => typeof mission.cadence === 'string');
  return <Workspace icon={Workflow} eyebrow={t('automations.eyebrow')} title={t('automations.title')} copy={t('automations.copy')} action={<button type="button" className="primary-action" onClick={onNewGoal}><Target /> {t('automations.newGoal')}</button>}>
    {!connected ? <Empty icon={CircleOff} title={t('missions.offlineTitle')} copy={t('automations.offlineCopy')} /> : <><div className="automation-cards"><article><Workflow /><div><strong>{t('automations.watchtower')}</strong><small>{t('automations.watchtowerCopy')}</small></div><StatePill state="available" /></article><article><ShieldCheck /><div><strong>{t('automations.retries')}</strong><small>{t('automations.retriesCopy')}</small></div><StatePill state="available" /></article></div>{withCadence.length ? <div className="record-list">{withCadence.map((mission) => <article key={mission.id}><div className="record-icon"><Workflow /></div><div><strong>{String(mission.cadence)}</strong><small>{mission.id}</small></div><StatePill state={mission.executionPhase ?? mission.status} /></article>)}</div> : <p className="truth-card"><ShieldCheck /> {t('automations.noCadence')}</p>}</>}
  </Workspace>;
}


export function SettingsView({ connected, connecting, rememberSession, snapshot, catalog, githubBusy, onConnect, onDisconnect, onRefresh, onConfigureGithub, onRevokeGithub }: { connected: boolean; connecting: boolean; rememberSession: boolean; snapshot?: OverviewSnapshot; catalog?: IntegrationCatalog; githubBusy: boolean; onConnect: (event: FormEvent<HTMLFormElement>) => void; onDisconnect: () => void; onRefresh: () => void; onConfigureGithub: (event: FormEvent<HTMLFormElement>) => void; onRevokeGithub: () => void }) {
  const { t, locale, setLocale } = useEfestoLocale();
  const bootstrap = snapshot?.readiness.bootstrap;
  const mcpIntegrations = catalog?.integrations.filter((integration) => integration.adapter === 'mcp') ?? [];
  const github = catalog?.integrations.find((integration) => integration.id === 'github' && integration.adapter === 'native');
  return <Workspace icon={Settings} eyebrow={t('settings.eyebrow')} title={t('settings.title')} copy={t('settings.copy')}>
    <div className="settings-layout">
      <form className="connection-card" onSubmit={onConnect}>
        <header><span className={'kernel-dot ' + (connected ? 'online' : 'offline')} /><div><small>{t('settings.currentDevice')}</small><strong>{connected ? t('settings.authorized') : t('settings.connectKernel')}</strong></div></header>
        {!connected ? <>
          <label>{t('settings.kernelUrl')}<input name="baseUrl" aria-label={t('settings.kernelUrl')} type="url" defaultValue="http://127.0.0.1:4000" required /></label>
          <label>{t('settings.privateToken')}<input name="token" aria-label={t('settings.privateToken')} type="password" autoComplete="off" placeholder={t('settings.tokenPlaceholder')} /></label>
          <label>{t('settings.pairingCode')}<input name="pairingCode" aria-label={t('settings.pairingCode')} inputMode="text" autoComplete="off" placeholder={t('settings.pairingPlaceholder')} /></label>
          <label className="remember-row"><input name="rememberSession" type="checkbox" defaultChecked={rememberSession} /><span><strong>{t('settings.remember')}</strong><small>{t('settings.rememberCopy')}</small></span></label>
          <div className="connection-actions"><button type="submit" name="action" value="pair" className="primary-action" disabled={connecting}>{connecting ? t('settings.pairing') : t('settings.pair')}</button><button type="submit" name="action" value="token" className="secondary-action" disabled={connecting}>{t('settings.authorize')}</button></div>
        </> : <div className="connection-actions"><button type="button" className="primary-action" onClick={onRefresh}><RefreshCw /> {t('settings.checkNow')}</button><button type="button" className="danger-action" onClick={onDisconnect}>{t('settings.disconnect')}</button></div>}
      </form>
      <section className="readiness-card">
        <header><ShieldCheck /><div><small>{t('settings.realStatus')}</small><strong>{statusLabel(bootstrap?.overall ?? (connected ? 'connected' : 'offline'), t)}</strong></div></header>
        <ReadinessRow label="Kernel" value={bootstrap?.kernel ?? (connected ? 'ready' : 'offline')} ready={connected} />
        <ReadinessRow label="Hermes" value={bootstrap?.hermes ?? t('status.noDiagnostic')} ready={bootstrap?.hermes === 'ready'} />
        <ReadinessRow label="Obsidian" value={bootstrap?.obsidian ?? t('status.notConfigured')} ready={bootstrap?.obsidian === 'ready'} />
        <ReadinessRow label={t('settings.extension')} value={bootstrap?.pairing ?? t('status.notPaired')} ready={bootstrap?.pairing === 'paired'} />
        <a href="http://127.0.0.1:4000/replay-lab" target="_blank" rel="noreferrer">{t('settings.openReplay')} <ExternalLink /></a>
        {mcpIntegrations.length ? <section className="settings-addon-ledger" aria-labelledby="settings-addon-ledger-title">
          <header><Plug /><div><small>{t('integrations.adapter.mcp')}</small><strong id="settings-addon-ledger-title">{t('integrations.externalTitle')}</strong></div></header>
          <p>{t('integrations.externalCopy')}</p>
          <div>{mcpIntegrations.map((integration) => <article key={integration.id}><span className="settings-addon-mark"><IntegrationMark id={integration.id} /></span><span><strong>{t('integrations.' + integration.id + '.name')}</strong><small>{integration.scopes.join(' · ')}</small></span><StatePill state={integration.status} /></article>)}</div>
          <small className="settings-addon-note"><ShieldCheck /> {t('integrations.mcpPending')}</small>
        </section> : null}
        {github ? <GitHubSettingsCard github={github} busy={githubBusy} onConfigure={onConfigureGithub} onRevoke={onRevokeGithub} /> : null}
        <div className="language-preferences" aria-labelledby="efesto-language-title">
          <header><Languages /><div><small>{t('locale.language')}</small><strong id="efesto-language-title">{t('locale.interface')}</strong></div></header>
          <label>{t('locale.interface')}<select value={locale} onChange={(event) => setLocale(event.target.value as EfestoLocale)} aria-label={t('locale.interface')}>{EFESTO_LOCALES.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
          <p>{t('locale.help')}</p>
        </div>
      </section>
    </div>
  </Workspace>;
}

function GitHubSettingsCard({ github, busy, onConfigure, onRevoke }: { github: IntegrationSummary; busy: boolean; onConfigure: (event: FormEvent<HTMLFormElement>) => void; onRevoke: () => void }) {
  const { t } = useEfestoLocale();
  const configured = github.status === 'ready';
  const environmentManaged = github.managedBy === 'environment';
  return <section className={'settings-addon-ledger settings-github-card status-' + github.status} aria-labelledby="settings-github-title">
    <header><span className="settings-github-mark"><IntegrationMark id="github" /></span><div><small>{t('integrations.adapter.native')}</small><strong id="settings-github-title">{t('integrations.github.name')}</strong></div><StatePill state={github.status} /></header>
    <p>{configured ? t('settings.githubConfiguredCopy') : t('settings.githubCopy')}</p>
    <div className="settings-github-scope"><span><strong>{t('settings.githubScopeLabel')}</strong><small>{github.scopes.join(' · ')}</small></span><span><strong>{t('settings.githubCapabilitiesLabel')}</strong><small>{github.capabilities.length ? github.capabilities.join(' · ') : t('integrations.noCapabilities')}</small></span></div>
    {configured ? environmentManaged ? <small className="settings-addon-note"><ShieldCheck /> {t('settings.githubEnvironmentManaged')}</small> : <button type="button" className="danger-action settings-github-revoke" onClick={onRevoke} disabled={busy}>{busy ? t('settings.githubWorking') : t('settings.githubRevoke')}</button> : environmentManaged ? <small className="settings-addon-note"><ShieldCheck /> {t('settings.githubEnvironmentSetup')}</small> : <form className="settings-github-form" onSubmit={onConfigure}><label>{t('settings.githubToken')}<input name="githubToken" type="password" autoComplete="off" placeholder={t('settings.githubTokenPlaceholder')} required /></label><button type="submit" className="primary-action" disabled={busy}>{busy ? t('settings.githubWorking') : t('settings.githubConnect')}</button></form>}
    <small className="settings-addon-note"><ShieldCheck /> {t('settings.githubBoundary')}</small>
  </section>;
}

function Workspace({ icon: Icon, eyebrow, title, copy, action, children }: { icon: typeof Target; eyebrow: string; title: string; copy: string; action?: ReactNode; children: ReactNode }) { return <section className="workspace"><header className="workspace-heading"><span><Icon /></span><div><small>{eyebrow}</small><h1>{title}</h1><p>{copy}</p></div>{action ? <div className="workspace-heading-action">{action}</div> : null}</header><div className="workspace-body">{children}</div></section>; }
function Empty({ icon: Icon, title, copy }: { icon: typeof Target; title: string; copy: string }) { return <div className="empty-state"><Icon /><strong>{title}</strong><p>{copy}</p></div>; }
function StatePill({ state }: { state: string }) { const { t } = useEfestoLocale(); const tone = ['ready', 'completed', 'forged', 'available', 'new'].includes(state) ? 'good' : ['failed', 'invalid', 'degraded', 'expired', 'revoked'].includes(state) ? 'bad' : ['running', 'investigating', 'verifying', 'queued', 'waiting_for_agent'].includes(state) ? 'working' : 'neutral'; return <span className={`state-pill ${tone}`}><i />{statusLabel(state, t)}</span>; }
function ReadinessRow({ label, value, ready }: { label: string; value: string; ready: boolean }) { const { t } = useEfestoLocale(); return <div className="readiness-row"><span>{label}</span><strong className={ready ? 'ready' : ''}><i />{statusLabel(value, t)}</strong></div>; }
function statusLabel(value: string, t: (key: string) => string) { const statusKeys: Record<string, string> = { active: 'status.active', available: 'status.available', completed: 'status.completed', configured: 'status.configured', connected: 'status.connected', degraded: 'status.degraded', expired: 'status.expired', failed: 'status.failed', forged: 'status.forged', invalid: 'status.invalid', new: 'status.new', not_configured: 'status.notConfigured', offline: 'status.offline', paired: 'status.paired', queued: 'status.queued', ready: 'status.ready', revoked: 'status.revoked', running: 'status.running', unavailable: 'status.unavailable', verifying: 'status.verifying', investigating: 'status.investigating', waiting_for_agent: 'status.waitingForAgent', unconfigured: 'status.unconfigured', checking: 'status.checking' }; return statusKeys[value] ? t(statusKeys[value]) : value.replaceAll('_', ' '); }
export function brainState(phase: BrainPhase, t: (key: string) => string) { if (phase === 'thinking') return { label: t('state.conversing'), detail: t('state.modelStreaming') }; if (phase === 'investigating') return { label: t('state.investigating'), detail: t('state.hermesMission') }; if (phase === 'verifying') return { label: t('state.verifyingEvidence'), detail: t('state.kernelGates') }; if (phase === 'queued') return { label: t('state.missionPrepared'), detail: t('state.waitingAgent') }; if (phase === 'forged') return { label: t('state.evidenceForged'), detail: t('state.persistedResult') }; if (phase === 'failed') return { label: t('state.attentionRequired'), detail: t('state.lastMissionFailed') }; if (phase === 'ready') return { label: t('state.forgeReady'), detail: t('state.newGoalReady') }; return { label: t('state.localOffline'), detail: t('state.noActivity') }; }
function formatDate(value: string, locale: EfestoLocale) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(locale === 'pt' ? 'pt-PT' : locale === 'en' ? 'en-GB' : 'es-ES', { dateStyle: 'medium' }).format(date); }
function formatRelevance(value: number) { return value <= 1 ? `${Math.round(value * 100)}%` : String(Math.round(value)); }
function recordTitle(record: Record<string, unknown>, fallback: string) { return typeof record.title === 'string' ? record.title : typeof record.question === 'string' ? record.question : fallback; }
