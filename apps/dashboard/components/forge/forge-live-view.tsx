'use client';

import { getLocale, t } from '../../lib/i18n';
import { Check, ChevronDown, Pencil, Plug, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { GoalEditSheet, type GoalEditRequest } from './goal-edit-sheet';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ForgeMissionModel, ForgeModel, ForgeSearchRun, ForgeSource, ForgeStepState } from '../../lib/forge/forge-model';
import { buildForgeStory, MAX_GRAPH_NODES, readFailureCode } from '../../lib/forge/forge-story';
import { goalTermSegments } from '../../lib/forge/goal-terms';
import { ForgeCrawlerRenderer, type CrawlerStage } from './forge-crawler-renderer';
import { SourceMark } from '../brand/source-mark';

const NARROW_MAX = 760;
const VISIBLE_WIDE = 12;
const VISIBLE_NARROW = 6;
const stepShort = () => ['Goal', t('f.search'), 'Evidence', 'SUPPORT', 'Find'];

type Props = {
  model: ForgeModel;
  onConnect?: () => void;
  onOpenFinds?: () => void;
  /** Re-confirms a mission the Kernel left read without SUPPORT and without a lease (model.relaunch). */
  onRelaunch?: (goalId: string) => void;
  relaunchPending?: boolean;
  /** "Buscar más": confirms a new attempt that keeps earlier Finds/Evidence (model.searchMore). */
  onSearchMore?: (goalId: string) => void;
  /** "Editar Goal": saves a Kernel Goal revision (model.editGoal); resolves true when the Kernel accepted it. */
  onEditGoal?: (request: GoalEditRequest) => Promise<boolean>;
  /** Visible heading level context; Home uses h2 under its own title. */
  headingId?: string;
};

export function ForgeLiveView({ model, onConnect, onOpenFinds, onRelaunch, relaunchPending = false, onSearchMore, onEditGoal, headingId = 'forge-live-title' }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(true);
  const reducedMotion = useReducedMotion();
  const mission = model.kind === 'mission' ? model : undefined;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sync = () => { const width = root.clientWidth; setNarrow(width > 0 ? width < NARROW_MAX : true); };
    sync();
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(sync);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const [playing, setPlaying] = useState(false);
  const [reconstructing, setReconstructing] = useState(false);
  const phaseKey = model.kind === 'mission' ? model.phase : model.kind;
  return <section
    ref={rootRef}
    className="forge-live"
    data-kind={model.kind}
    data-phase={phaseKey}
    data-layout={narrow ? 'narrow' : 'wide'}
    data-playing={playing ? 'true' : undefined}
    data-reduced-motion={reducedMotion ? 'true' : undefined}
    aria-labelledby={headingId}
  >
    <ForgeHeader model={model} headingId={headingId} onConnect={onConnect} onRelaunch={onRelaunch} relaunchPending={relaunchPending} onSearchMore={onSearchMore} onEditGoal={onEditGoal} replaying={Boolean(mission && playing && reconstructing && mission.motion === 'settled')} />
    {mission
      ? <ForgeBody key={mission.missionId} model={mission} narrow={narrow} reducedMotion={reducedMotion} onOpenFinds={onOpenFinds} onSearchMore={onSearchMore} searchMorePending={relaunchPending} onPlaying={setPlaying} onReconstructing={setReconstructing} />
      : <div className="forge-live-cold" aria-hidden="true"><div className="forge-live-stage is-cold"><p className="forge-slabel">{t('f.webIndex')}<span>{t('f.decorative')}</span></p></div></div>}
    <p className="forge-sr-only" aria-live="polite" aria-atomic="true">{model.summary}</p>
  </section>;
}

function ForgeBody({ model, narrow, reducedMotion, onOpenFinds, onSearchMore, searchMorePending = false, onPlaying, onReconstructing }: {
  model: ForgeMissionModel; narrow: boolean; reducedMotion: boolean; onOpenFinds?: () => void;
  onSearchMore?: (goalId: string) => void; searchMorePending?: boolean;
  onPlaying: (value: boolean) => void; onReconstructing: (value: boolean) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const chipRef = useRef<HTMLParagraphElement>(null);
  const queryRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLElement>(null);
  const tickerRef = useRef<HTMLDivElement>(null);
  const funnelRef = useRef<HTMLDListElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const stagesRef = useRef(new Map<string, CrawlerStage>());
  const rendererRef = useRef<ForgeCrawlerRenderer | undefined>(undefined);
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const [expanded, setExpanded] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [replayTick, setReplayTick] = useState(0);
  const searchMoreNoteId = useId();

  const story = useMemo(() => buildForgeStory(model), [model]);
  const sources = model.sources;
  const limit = narrow ? VISIBLE_NARROW : VISIBLE_WIDE;
  const visibleSources = useMemo(() => (expanded ? sources : sources.slice(0, limit)), [expanded, limit, sources]);
  const hiddenCount = sources.length - visibleSources.length;
  const waiting = model.phase === 'queued' || model.phase === 'waiting_agent';
  const searching = model.phase === 'searching';

  useLayoutEffect(() => {
    const fx = fxRef.current, bg = bgRef.current, body = bodyRef.current, stage = stageRef.current;
    if (!fx || !bg || !body || !stage) return;
    let renderer: ForgeCrawlerRenderer;
    try {
      renderer = new ForgeCrawlerRenderer(fx, bg, {
        body, stage,
        chip: chipRef.current,
        funnel: funnelRef.current,
        card: (id) => cardRefs.current.get(id),
        queryText: queryRef.current,
        caret: caretRef.current,
        ticker: tickerRef.current,
        cells: () => new Map([...(funnelRef.current?.querySelectorAll<HTMLElement>('[data-k] dd') ?? [])].map((dd) => [(dd.parentElement as HTMLElement).dataset.k ?? '', dd])),
        panelCount: countRef.current,
        steps: () => [...(body.closest('.forge-live')?.querySelectorAll<HTMLElement>('.forge-live-steps > li') ?? [])],
      }, {
        reducedMotion: () => reducedRef.current,
        onStage: (id, value) => {
          stagesRef.current.set(id, value);
          const el = cardRefs.current.get(id);
          if (el) el.dataset.stage = value;
        },
        onPlaying: (value) => { setPlaying(value); onPlaying(value); if (!value) onReconstructing(false); },
      });
    } catch { return; }
    rendererRef.current = renderer;
    const onVisibility = () => renderer.setVisibility(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver((entries) => renderer.setOnScreen(entries.some((entry) => entry.isIntersecting)));
      observer.observe(body);
    }
    let resize: ResizeObserver | undefined;
    let frame = 0;
    if (typeof ResizeObserver === 'function') {
      resize = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => renderer.measure()); });
      resize.observe(body);
      const list = body.querySelector('.forge-live-panel');
      if (list) resize.observe(list);
    }
    const panel = body.querySelector('.forge-live-panel');
    const onScroll = () => renderer.measure();
    panel?.addEventListener('scroll', onScroll, { passive: true });
    void document.fonts?.ready.then(() => renderer.measure());
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
      resize?.disconnect();
      cancelAnimationFrame(frame);
      panel?.removeEventListener('scroll', onScroll);
      renderer.destroy();
      rendererRef.current = undefined;
    };
  // The renderer lives as long as this mission's body (keyed by mission id).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First paint of a settled mission re-tells it ("Reconstrucción"); live data animates as it lands.
  const firstRef = useRef(true);
  useLayoutEffect(() => {
    if (firstRef.current) { firstRef.current = false; onReconstructing(model.motion === 'settled' && !reducedMotion); }
    rendererRef.current?.setStory(story, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, reducedMotion]);
  useLayoutEffect(() => {
    if (!replayTick) return;
    stagesRef.current.clear();
    onReconstructing(true);
    rendererRef.current?.setStory(story, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayTick]);
  useLayoutEffect(() => { rendererRef.current?.measure(); }, [narrow, visibleSources, legendOpen]);

  const setCardRef = useCallback((id: string, fallback: CrawlerStage) => (el: HTMLElement | null) => {
    if (!el) { cardRefs.current.delete(id); return; }
    cardRefs.current.set(id, el);
    el.dataset.stage = stagesRef.current.get(id) ?? fallback;
  }, []);

  const canReplay = Boolean(sources.length > 0 && !reducedMotion && model.motion === 'settled');
  const exact = story.query.exact;
  const queries = story.query.all;
  const lastQuery = queries[queries.length - 1] ?? story.query.text;
  return <div ref={bodyRef} className="forge-live-body">
    <canvas ref={fxRef} className="forge-live-fx" aria-hidden="true" />
    <div ref={stageRef} className="forge-live-stage">
      <canvas ref={bgRef} className="forge-live-bg" aria-hidden="true" />
      <p className="forge-slabel" aria-hidden="true">{t('f.webIndex')}<span>{t('f.decorative')}</span></p>
      <div className="forge-bench" data-mode={waiting ? 'waiting' : searching ? 'searching' : 'searched'}>
        <p ref={chipRef} className="forge-chip" title={exact ? `${t('f.queriesRecorded')} ${queries.map((item) => `«${item}»`).join(' · ')}` : t('f.queryNotPublished')}>
          <span className="fn" aria-hidden="true">hermes.search(</span>
          <span ref={queryRef} className="forge-bench-q" aria-hidden={exact && queries.length > 1 ? 'true' : undefined}>{waiting ? '' : `«${exact ? lastQuery : story.query.text}»`}</span>
          {exact && queries.length > 1 ? <span className="forge-sr-only">{queries.map((item) => `«${item}»`).join(', ')}</span> : null}
          <i ref={caretRef} className="forge-caret" aria-hidden="true" />
          <span className="fn" aria-hidden="true">)</span>
          {waiting ? null : exact ? (queries.length > 1 ? <em className="forge-chip-tag">{t('f.nQueries', { n: queries.length })}</em> : null) : <em className="forge-chip-tag">{t('f.fromGoal')}</em>}
        </p>
        {waiting ? <div className="forge-bench-wait">
          <p className="forge-bench-title"><span className="forge-bench-embers" aria-hidden="true"><i /><i /><i /></span>{model.phase === 'queued' ? t('f.waitingTurn') : t('f.waitingConnect')}</p>
          {model.nextStep ? <p className="forge-bench-next">{model.nextStep}</p> : null}
        </div> : null}
      </div>
      <div className="forge-live-anvil" aria-hidden="true" />
    </div>
    <dl ref={funnelRef} className="forge-live-counters" aria-label={t('f.counters')} data-cells={story.resultCount !== undefined ? 4 : 3}>
      {story.resultCount !== undefined ? <div data-k="results" data-on="true"><dt>{t('f.resultsReturned')}</dt><dd>{story.resultCount}</dd></div> : null}
      <div data-k="candidates" data-on="true"><dt>{t('f.candidates')}</dt><dd>{model.counts.sources}</dd></div>
      <div data-k="evidence" data-on="true"><dt>Evidence</dt><dd>{model.counts.evidence}</dd></div>
      <div data-k="support" data-on="true" className="is-support"><dt>SUPPORT</dt><dd>{model.counts.supported}</dd></div>
    </dl>
    <aside className="forge-live-panel" aria-label={t('f.candToEvidence')}>
      {/* forge.log lives beside the stage (below it on phones) so it never covers the anvil or the web. */}
      <div className="forge-ticker" aria-hidden="true"><div className="forge-ticker-ttl"><i /><i /><i />&nbsp;forge.log</div><div ref={tickerRef} className="forge-ticker-lines" /></div>
      <header className="forge-panel-head"><h3>{t('f.candToEvidence')}</h3><span ref={countRef} className="forge-panel-count">{model.counts.sources} {t('f.of')} {model.counts.sources}</span></header>
      {model.findingsFunnel ? <p className="forge-panel-funnel" title={funnelTitle(model.findingsFunnel)}>{funnelLine(model.findingsFunnel)}</p> : null}
      <ResultWebs runs={model.search.runs} />
      {visibleSources.length ? <ul className="forge-live-sources" aria-label={t('f.missionSources', { n: sources.length })}>
        {visibleSources.map((source) => <li key={source.id} ref={setCardRef(source.id, finalStage(source))} className="forge-source" data-state={source.state}>
          <SourceCard source={source} goalTerms={model.goalTerms} onOpenFinds={onOpenFinds} />
        </li>)}
      </ul> : noSourcesCopy(model) ? <p className="forge-live-nosources">{noSourcesCopy(model)}</p> : null}
      {hiddenCount > 0 || expanded ? <button type="button" className="forge-live-more" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
        {expanded ? t('f.showFewer') : t(hiddenCount === 1 ? 'f.showOneMore' : 'f.showNMore', { n: hiddenCount })}<ChevronDown aria-hidden="true" />
      </button> : null}
      {model.searchMore && onSearchMore && !model.relaunch ? <div className="forge-live-searchmore">
        <button type="button" className="forge-live-relaunch-btn forge-live-searchmore-btn" disabled={searchMorePending} aria-describedby={searchMoreNoteId} onClick={() => { if (model.searchMore) onSearchMore(model.searchMore.goalId); }}>
          <Search aria-hidden="true" />{searchMorePending ? 'Enviando…' : t('f.searchMore')}
        </button>
        <p id={searchMoreNoteId}>{t('f.searchMoreHelp')}</p>
      </div> : null}
      {model.prior ? <PriorAttempts prior={model.prior} goalTerms={model.goalTerms} onOpenFinds={onOpenFinds} /> : null}
      <details className="forge-live-legend" open={legendOpen} onToggle={(event) => setLegendOpen(event.currentTarget.open)}>
        <summary>{t('f.legend')}</summary>
        <ul>
          <li><i className="lg-spark" />{t('f.lgSpark')}</li>
          <li><i className="lg-molten" />{t('f.lgThread')}</li>
          <li><i className="lg-gold" />{t('f.lgGold')}</li>
          <li><i className="lg-steel" />{t('f.lgSteel')}</li>
          <li><i className="lg-ash" />{t('f.lgAsh')}</li>
          <li><i className="lg-probe" />{t('f.lgBlue')}</li>
          {story.results.length ? <li><i className="lg-web" />{t('f.lgSilver')}</li> : null}
        </ul>
        <p>{t('f.realDataLegend', { cand: countWord(model.counts.sources, t('f.candidate'), t('f.candidates')), ev: model.counts.evidence, sup: model.counts.supported, graph: story.nodes.length < sources.length ? t('f.graphDraws', { n: MAX_GRAPH_NODES }) : '' })}</p>
        {reducedMotion ? <p className="forge-live-rm">{t('f.reducedMotion')}</p> : null}
      </details>
      {canReplay ? <button type="button" className="forge-live-replay" disabled={playing} onClick={() => setReplayTick((value) => value + 1)}>
        <RotateCcw aria-hidden="true" />{playing ? 'Reproduciendo…' : t('f.replay')}<span className="forge-sr-only"> {t('f.replayHelp')}</span>
      </button> : null}
    </aside>
  </div>;
}

/**
 * The pages each recorded search returned (display-only searchTelemetry): named, never linked,
 * never read, never Evidence or SUPPORT. Rendered only when the Kernel row carries them.
 */
function ResultWebs({ runs }: { runs: readonly ForgeSearchRun[] }) {
  const groups = runs.map((run, index) => ({ run, index })).filter(({ run }) => run.results?.length);
  const total = groups.reduce((sum, { run }) => sum + (run.results?.length ?? 0), 0);
  if (!total) return null;
  return <details className="forge-live-webs">
    <summary>{t('f.searchSites')} <b>{total}</b></summary>
    <p className="forge-live-webs-note">{t('f.searchSitesHelp')}</p>
    {groups.map(({ run, index }) => <section key={index} aria-label={t('f.searchN', { n: index + 1 })}>
      <h4><span>{index + 1}</span>«{run.query}»</h4>
      <ol>
        {run.results!.map((result) => <li key={result.url} title={result.url}><b>{result.host}</b>{result.title ? <span>{result.title}</span> : null}</li>)}
      </ol>
    </section>)}
  </details>;
}

function ForgeHeader({ model, headingId, onConnect, onRelaunch, relaunchPending, onSearchMore, onEditGoal, replaying }: { model: ForgeModel; headingId: string; onConnect?: () => void; onRelaunch?: (goalId: string) => void; relaunchPending?: boolean; onSearchMore?: (goalId: string) => void; onEditGoal?: (request: GoalEditRequest) => Promise<boolean>; replaying: boolean }) {
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  if (model.kind === 'offline') {
    return <header className="forge-live-head">
      <div className="forge-live-goal">
        <small className="forge-live-eyebrow">FORJA · {OFFLINE_COPY[model.reason].eyebrow}</small>
        <h2 id={headingId}>{OFFLINE_COPY[model.reason].title}</h2>
        <p className="forge-live-phase"><i data-tone={model.reason === 'connecting' ? 'hot' : 'off'} /><span>{OFFLINE_COPY[model.reason].detail}</span></p>
      </div>
      {onConnect && model.reason !== 'connecting' ? <button type="button" className="forge-live-connect" onClick={onConnect}><Plug aria-hidden="true" />{t('s.connectKernel')}</button> : null}
    </header>;
  }
  if (model.kind === 'empty') {
    return <header className="forge-live-head">
      <div className="forge-live-goal">
        <small className="forge-live-eyebrow">{t('f.forgeReadyCap')}</small>
        <h2 id={headingId}>{t('f.noActiveMission')}</h2>
        <p className="forge-live-phase"><i data-tone="idle" /><span>{t('f.noActiveMissionCopy')}</span></p>
      </div>
    </header>;
  }
  const current = model.steps.findIndex((step) => step.state === 'active');
  const activeIndex = current >= 0 ? current : lastIndex(model.steps, (step) => step.state !== 'pending' && step.state !== 'skipped');
  const meta = metaPill(model, replaying);
  return <header className="forge-live-head">
    <div className="forge-live-goal">
      <p className="forge-live-kick"><small className="forge-live-eyebrow">{t('f.goalMissionCap')}</small><span className="forge-live-id" title={model.missionId}>{shortId(model.missionId)}</span>{meta ? <span className="forge-bench-meta" data-replaying={replaying ? 'true' : undefined} title={meta.join('')}>{meta[0]}<span className="forge-meta-more">{meta[1]}</span></span> : null}</p>
      <div className="forge-live-title">
        <h2 id={headingId}>{model.goalTitle || t('f.untitledGoal')}</h2>
        {model.editGoal && onEditGoal ? <button ref={editButton} type="button" className="forge-live-edit" aria-haspopup="dialog" aria-expanded={editing} onClick={() => setEditing(true)}>
          <span className="forge-live-edit-pill"><Pencil aria-hidden="true" /><span className="forge-live-edit-label">{t('s.editGoal')}</span></span>
        </button> : null}
      </div>
      {editing && model.editGoal && onEditGoal ? <GoalEditSheet goal={model.editGoal} onSave={onEditGoal} onClose={() => { setEditing(false); editButton.current?.focus(); }} /> : null}
      <p className="forge-live-phase"><i data-tone={phaseTone(model)} /><span><strong>{model.phaseLabel}<PhaseClock since={model.phaseSince} live={model.motion === 'active'} /></strong> {model.phaseDetail}</span></p>
      {model.relaunch && onSearchMore && model.searchMore ? <div className="forge-live-relaunch">
        {/* Stalled mission with "Buscar más" available: it re-queues the same Goal like Relanzar did, but
            keeps the earlier attempts, so a plain restart (which drops that history) is not offered here. */}
        <button type="button" className="forge-live-relaunch-btn forge-live-searchmore-btn" disabled={relaunchPending} onClick={() => { if (model.searchMore) onSearchMore(model.searchMore.goalId); }}>
          <Search aria-hidden="true" />{relaunchPending ? 'Enviando…' : t('f.searchMore')}
        </button>
        <p>{t('f.searchMoreWhy')}</p>
      </div> : model.relaunch && onRelaunch ? <div className="forge-live-relaunch">
        <button type="button" className="forge-live-relaunch-btn" disabled={relaunchPending} onClick={() => { if (model.relaunch) onRelaunch(model.relaunch.goalId); }}>
          <RefreshCw aria-hidden="true" />{relaunchPending ? 'Relanzando…' : t('f.relaunch')}
        </button>
        <p>{t('f.relaunchWhy')}</p>
      </div> : null}
      <div className="forge-live-stepbar">
        <ol className="forge-live-steps" aria-label={t('f.progress')}>
          {model.steps.map((step, index) => <li key={step.id} data-state={step.state} data-gold={index >= 3 ? 'true' : undefined} aria-current={index === activeIndex ? 'step' : undefined}>
            <em aria-hidden="true">{step.state === 'failed' ? '×' : index + 1}</em>
            <span className="forge-step-label">{stepShort()[index] ?? step.label}</span>
            <span className="forge-sr-only">: {step.label}, {stepStateLabel(step.state)}</span>
          </li>)}
        </ol>
        <p className="forge-live-stepnow" aria-hidden="true"><span className="forge-stepnow-word">{t('f.step')} </span>{activeIndex + 1} {t('f.of')} 5<span className="forge-stepnow-label"> · {model.steps[activeIndex]?.label}</span></p>
      </div>
    </div>
  </header>;
}

/** Dashed pill next to the kick (the mockup's tag slot): [short head, rest]. */
function metaPill(model: ForgeMissionModel, replaying: boolean): [string, string] | undefined {
  if (model.phase === 'queued' || model.phase === 'waiting_agent') return undefined;
  if (replaying) return [t('f.reconstruction'), ` ${t('f.realData')}`];
  if (model.phase === 'searching') return model.search.exactQueries.length ? [t('f.hermesQueries'), ` ${t('f.recordedByKernel')}`] : [t('f.hermesFromGoal'), ` ${t('f.exactNotPublished')}`];
  if (model.counts.sources > 0) {
    const returned = model.searchResultCount !== undefined ? ` · ${model.searchResultCount} ${model.searchResultCount === 1 ? t('f.resultReturned') : t('f.resultsReturned')}` : '';
    return [t('f.webSearchDone'), `${returned} · ${model.counts.sources} ${model.counts.sources === 1 ? t('f.realCandidate') : t('f.realCandidates')}`];
  }
  return undefined;
}

const FUNNEL_REASON_LABELS: Record<string, string> = { get malformed_url() { return t('f.badUrl'); }, get per_domain_cap() { return t('f.domainCap'); }, get duplicate() { return t('f.duplicate'); }, get other() { return t('f.others'); } };

/** "N candidatos devueltos · M descartados": adapter funnel before Kernel SUPPORT — never Hallazgos. */
export function funnelLine(funnel: { returned: number; discarded: number }): string {
  return `${funnel.returned} ${funnel.returned === 1 ? t('f.candReturned') : t('f.candsReturned')} · ${funnel.discarded} ${funnel.discarded === 1 ? t('f.discarded1') : t('f.discardedN')}`;
}

function funnelTitle(funnel: { byReason: Record<string, number | undefined> }): string {
  const parts = Object.entries(funnel.byReason).filter(([, n]) => n).map(([reason, n]) => `${FUNNEL_REASON_LABELS[reason] ?? reason}: ${n}`);
  return parts.length ? `Descartados por el adaptador antes del Kernel — ${parts.join(' · ')}` : t('f.noDiscards');
}

function shortId(id: string): string {
  return id.length > 22 ? `${id.slice(0, 16)}…${id.slice(-4)}` : id;
}

function countWord(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Final visual stage of a card when no play-through runs (reduced motion, no canvas, beyond the graph). */
/** Earlier attempts the Kernel kept ("Buscar más"): their read pages, outside this attempt's counters. */
function PriorAttempts({ prior, goalTerms, onOpenFinds }: { prior: NonNullable<ForgeMissionModel['prior']>; goalTerms: string[]; onOpenFinds?: () => void }) {
  const title = `${prior.attempts === 1 ? t('f.priorAttemptCap') : t('f.priorAttemptsN', { n: prior.attempts })} · ${prior.supported} SUPPORT · ${prior.evidence} Evidence`;
  return <details className="forge-live-prior" open={prior.supported > 0}>
    <summary>{title}<span className="forge-live-prior-note">conservados</span></summary>
    {prior.sources.length ? <ul className="forge-live-sources" aria-label={t('f.priorSources', { n: prior.sources.length })}>
      {prior.sources.map((source) => <li key={source.id} className="forge-source" data-state={source.state} data-stage={finalStage(source)} data-prior="true">
        <p className="forge-source-prior-tag">{t('f.priorAttempt')}</p>
        <SourceCard source={source} goalTerms={goalTerms} onOpenFinds={onOpenFinds} />
      </li>)}
    </ul> : <p className="forge-live-nosources">{t('f.priorNoPages')}</p>}
  </details>;
}

function finalStage(source: ForgeSource): CrawlerStage {
  switch (source.state) {
    case 'supported': return 'gold';
    case 'unsupported': return 'steel';
    case 'read_failed': return 'ash';
    case 'evidence': return 'evidence';
    default: return 'candidate';
  }
}

// A settled phase shows a coarse "hace N min" that keeps advancing; it used to read the clock once,
// so a run that ended while the page was open stayed at "hace 2 s" indefinitely.
const SETTLED_CLOCK_MS = 15_000;

function PhaseClock({ since, live }: { since?: string; live: boolean }) {
  const now = useNow(since ? (live ? 1000 : SETTLED_CLOCK_MS) : 0);
  if (!since || !now) return null;
  const elapsed = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  if (!Number.isFinite(elapsed)) return null;
  return <time className="forge-live-clock" dateTime={since} title={new Date(since).toLocaleString(getLocale())}> · {live ? formatElapsed(elapsed) : t('f.ago', { t: formatAgo(elapsed) })}</time>;
}

function SourceCard({ source, goalTerms, onOpenFinds }: { source: ForgeSource; goalTerms: string[]; onOpenFinds?: () => void }) {
  const highlight = source.state === 'supported' || source.state === 'evidence' || source.state === 'unsupported';
  const read = source.state !== 'candidate';
  const code = source.state === 'read_failed' ? readFailureCode(source.reasonCode) : read ? t('f.readLower') : undefined;
  const hasBody = Boolean(source.findTitle || source.quote || (source.evidenceTitle && source.evidenceTitle !== source.findTitle));
  // The mockup card shows the Find quote at a glance (≈3 lines) and steel cards only their reason;
  // the full quote stays in Evidence/Find and in the blockquote title.
  const quote = source.quote && source.state !== 'unsupported' ? clipQuote(source.quote, QUOTE_GLANCE) : undefined;
  const candidateTitle = source.candidateTitle && !GENERIC_CANDIDATE_TITLE.test(source.candidateTitle) ? source.candidateTitle : undefined;
  return <article aria-label={sourceAria(source)} className={source.findTitle ? 'is-find' : undefined}>
    <div className="forge-source-row">
      <span className="forge-source-badge">
        <span className="forge-badge-final">{source.state === 'supported' ? <Check aria-hidden="true" /> : null}{BADGES[source.state]}</span>
        {read ? <span className="forge-badge-interim" data-at="candidate" aria-hidden="true">CANDIDATO</span> : null}
        {read ? <span className="forge-badge-interim" data-at="reading" aria-hidden="true">LEYENDO</span> : null}
        {source.state === 'supported' || source.state === 'unsupported' ? <span className="forge-badge-interim" data-at="evidence" aria-hidden="true">EVIDENCE</span> : null}
      </span>
      <a href={source.url} target="_blank" rel="noreferrer noopener" className="forge-source-link" title={source.url} aria-label={t('f.openSourceAria', { host: source.host })}><SourceMark url={source.url} /><span className="forge-source-host">{source.host}</span></a>
      {code ? <span className="forge-source-code" data-tone={source.state === 'read_failed' ? 'bad' : 'ok'} aria-hidden="true">{code}</span> : null}
    </div>
    {source.path ? <p className="forge-source-path">{source.host}{source.path}</p> : null}
    <div className="forge-source-content">
      {hasBody ? <div className="forge-source-pending" aria-hidden="true"><s /><s /></div> : null}
      <div className="forge-source-body">
        {source.findTitle ? <h3 className="forge-source-findtitle">{onOpenFinds
          ? <button type="button" className="forge-source-find" onClick={onOpenFinds}>{source.findTitle}<span className="forge-sr-only"> {t('f.seeFind')}</span></button>
          : source.findTitle}</h3> : null}
        {quote ? <blockquote cite={source.url} title={quote.clipped ? source.quote : undefined}>
          <p>«{source.quoteTruncatedStart ? '… ' : ''}<Highlighted text={quote.text} terms={highlight ? goalTerms : []} />{source.quoteTruncatedEnd || quote.clipped ? ' …' : ''}»</p>
        </blockquote> : source.state !== 'unsupported' && source.evidenceTitle && source.evidenceTitle !== source.findTitle ? <p className="forge-source-title"><Highlighted text={source.evidenceTitle} terms={highlight ? goalTerms : []} /></p>
          : candidateTitle ? <p className="forge-source-title is-candidate">{candidateTitle}</p> : null}
        {source.findTitle ? null : <p className="forge-source-meta">
          <span className="forge-meta-final">{metaLine(source)}</span>
          {read && !hasBody ? <span className="forge-meta-interim" data-at="pending" aria-hidden="true">{t('f.pendingRead')}</span> : null}
          {source.state === 'unsupported' ? <span className="forge-meta-interim" data-at="evidence" aria-hidden="true">{t('f.readAwaiting')}</span> : null}
        </p>}
      </div>
    </div>
  </article>;
}

const QUOTE_GLANCE = 150;

export function clipQuote(text: string, max: number): { text: string; clipped: boolean } {
  const clean = text.trim();
  if (clean.length <= max) return { text: clean, clipped: false };
  const cut = clean.slice(0, max + 1);
  // Prefer ending on a sentence so the glance reads as a whole thought.
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentence > max * 0.5) return { text: cut.slice(0, sentence), clipped: true };
  const space = cut.lastIndexOf(' ');
  const head = (space > max * 0.6 ? cut.slice(0, space) : clean.slice(0, max)).replace(/[\s,;:.\-–—]+$/u, '');
  return { text: head, clipped: true };
}

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const segments = useMemo(() => goalTermSegments(text, terms), [terms, text]);
  return <>{segments.map((segment, index) => (segment.term ? <mark key={index} className="forge-term">{segment.text}</mark> : <span key={index}>{segment.text}</span>))}</>;
}

const OFFLINE_COPY = {
  get not_connected() { return { eyebrow: t('f.offlineCap'), title: t('f.forgeOff'), detail: t('f.forgeOffCopy') }; },
  get connecting() { return { eyebrow: t('f.connectingCap'), title: t('f.forgeStarting'), detail: t('f.forgeStartingCopy') }; },
  get kernel_unreachable() { return { eyebrow: t('f.kernelNoRespCap'), title: t('f.forgePaused'), detail: t('f.forgePausedCopy') }; },
};

const BADGES: Record<ForgeSource['state'], string> = {
  get candidate() { return t('f.candidateCap'); },
  get read_failed() { return t('f.notReadCap'); },
  evidence: 'EVIDENCE',
  supported: 'KERNEL SUPPORT',
  // Read and stored as Evidence; the Kernel verdict (no SUPPORT) is the line under it, as in the mockup.
  unsupported: 'EVIDENCE',
};

function metaLine(source: ForgeSource): string {
  switch (source.state) {
    case 'candidate': return t('f.candPending');
    case 'read_failed': return `× ${source.reason ?? t('f.cantRead')}`;
    case 'evidence': return quoteNote(source, t('f.readNoVerdict'));
    case 'supported': return source.findTitle ? t('f.findForgedTitle', { title: source.findTitle }) : quoteNote(source, t('f.supportCovers'));
    case 'unsupported': return source.reason ? t('f.readNoSupportReason', { reason: lowerFirst(source.reason) }) : t('f.readNoKernelSupport');
  }
}

function lowerFirst(text: string): string {
  return text ? text[0].toLocaleLowerCase('es') + text.slice(1) : text;
}

function quoteNote(source: ForgeSource, fallback: string): string {
  if (source.quoteState === 'unavailable') return `${fallback} · ${t('f.quoteUnpublished')}`;
  if (source.quoteState === 'loading') return `${fallback} · ${t('f.quoteLoading')}`;
  return fallback;
}

function sourceAria(source: ForgeSource): string {
  const quote = source.quote ? t('f.quote', { q: source.quote }) : '';
  return `${BADGES[source.state]} · ${source.host}. ${quote} ${metaLine(source)}`.replace(/\s+/g, ' ').trim();
}

/** Adapter placeholder titles ("Public source: host") repeat the host line; they carry no content. */
const GENERIC_CANDIDATE_TITLE = /^public source:\s*\S+$/i;

function noSourcesCopy(model: ForgeMissionModel): string {
  if (model.phase === 'searching') return t('f.noCandYet');
  if (model.phase === 'waiting_agent' || model.phase === 'queued') return t('f.noCandWaiting');
  if (model.phase === 'completed_empty') return t('f.noCandEnded');
  return t('f.noSources');
}

function phaseTone(model: ForgeMissionModel): string {
  if (model.phase === 'forged') return 'gold';
  if (model.motion === 'active') return 'hot';
  if (model.phase === 'failed' || model.phase === 'blocked' || model.phase === 'read_failed_all') return 'alert';
  return 'ash';
}

function stepStateLabel(state: ForgeStepState): string {
  return { pending: 'pendiente', active: t('f.inProgress'), done: 'hecho', gold: t('f.doneSupport'), failed: t('f.noResult'), skipped: t('f.notApplicable') }[state];
}

function lastIndex<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) if (predicate(items[index])) return index;
  return 0;
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${String(seconds % 60).padStart(2, '0')} s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
  return t('f.days', { n: Math.floor(hours / 24) });
}

/** Coarse elapsed time for a settled phase; precise to the minute, never to a stale second. */
export function formatAgo(seconds: number): string {
  if (seconds < 60) return t('f.lessThanMin');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return t('f.days', { n: Math.floor(hours / 24) });
}

function useNow(intervalMs: number): number | undefined {
  const [now, setNow] = useState<number>();
  useEffect(() => {
    setNow(Date.now());
    if (!intervalMs) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);
  return reduced;
}
