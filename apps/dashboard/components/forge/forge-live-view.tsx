'use client';

import { Check, ChevronDown, Plug, RefreshCw, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ForgeMissionModel, ForgeModel, ForgeSource, ForgeStepState } from '../../lib/forge/forge-model';
import { buildForgeStory, MAX_GRAPH_NODES, readFailureCode } from '../../lib/forge/forge-story';
import { goalTermSegments } from '../../lib/forge/goal-terms';
import { ForgeCrawlerRenderer, type CrawlerStage } from './forge-crawler-renderer';

const NARROW_MAX = 760;
const VISIBLE_WIDE = 12;
const VISIBLE_NARROW = 6;
const STEP_SHORT = ['Goal', 'Búsqueda', 'Evidence', 'SUPPORT', 'Find'];

type Props = {
  model: ForgeModel;
  onConnect?: () => void;
  onOpenFinds?: () => void;
  /** Re-confirms a mission the Kernel left read without SUPPORT and without a lease (model.relaunch). */
  onRelaunch?: (goalId: string) => void;
  relaunchPending?: boolean;
  /** Visible heading level context; Home uses h2 under its own title. */
  headingId?: string;
};

export function ForgeLiveView({ model, onConnect, onOpenFinds, onRelaunch, relaunchPending = false, headingId = 'forge-live-title' }: Props) {
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
    <ForgeHeader model={model} headingId={headingId} onConnect={onConnect} onRelaunch={onRelaunch} relaunchPending={relaunchPending} replaying={Boolean(mission && playing && reconstructing && mission.motion === 'settled')} />
    {mission
      ? <ForgeBody key={mission.missionId} model={mission} narrow={narrow} reducedMotion={reducedMotion} onOpenFinds={onOpenFinds} onPlaying={setPlaying} onReconstructing={setReconstructing} />
      : <div className="forge-live-cold" aria-hidden="true"><div className="forge-live-stage is-cold"><p className="forge-slabel">La web · índice del buscador<span>fondo decorativo · no se cuenta</span></p></div></div>}
    <p className="forge-sr-only" aria-live="polite" aria-atomic="true">{model.summary}</p>
  </section>;
}

function ForgeBody({ model, narrow, reducedMotion, onOpenFinds, onPlaying, onReconstructing }: {
  model: ForgeMissionModel; narrow: boolean; reducedMotion: boolean; onOpenFinds?: () => void;
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
      <p className="forge-slabel" aria-hidden="true">La web · índice del buscador<span>fondo decorativo · no se cuenta</span></p>
      <div className="forge-bench" data-mode={waiting ? 'waiting' : searching ? 'searching' : 'searched'}>
        <p ref={chipRef} className="forge-chip" title={exact ? `Consultas que Hermes hizo, registradas por el Kernel: ${queries.map((item) => `«${item}»`).join(' · ')}` : 'Hermes busca a partir del Goal; la consulta exacta no la publica el Kernel'}>
          <span className="fn" aria-hidden="true">hermes.search(</span>
          <span ref={queryRef} className="forge-bench-q" aria-hidden={exact && queries.length > 1 ? 'true' : undefined}>{waiting ? '' : `«${exact ? lastQuery : story.query.text}»`}</span>
          {exact && queries.length > 1 ? <span className="forge-sr-only">{queries.map((item) => `«${item}»`).join(', ')}</span> : null}
          <i ref={caretRef} className="forge-caret" aria-hidden="true" />
          <span className="fn" aria-hidden="true">)</span>
          {waiting ? null : exact ? (queries.length > 1 ? <em className="forge-chip-tag">{queries.length} consultas</em> : null) : <em className="forge-chip-tag">desde el Goal</em>}
        </p>
        {waiting ? <div className="forge-bench-wait">
          <p className="forge-bench-title"><span className="forge-bench-embers" aria-hidden="true"><i /><i /><i /></span>{model.phase === 'queued' ? 'Esperando turno del agente' : 'Esperando a que Hermes se conecte'}</p>
          {model.nextStep ? <p className="forge-bench-next">{model.nextStep}</p> : null}
        </div> : null}
      </div>
      <div className="forge-ticker" aria-hidden="true"><div className="forge-ticker-ttl"><i /><i /><i />&nbsp;forge.log</div><div ref={tickerRef} className="forge-ticker-lines" /></div>
      <div className="forge-live-anvil" aria-hidden="true" />
    </div>
    <dl ref={funnelRef} className="forge-live-counters" aria-label="Contadores de la misión" data-cells={story.resultCount !== undefined ? 4 : 3}>
      {story.resultCount !== undefined ? <div data-k="results" data-on="true"><dt>resultados devueltos</dt><dd>{story.resultCount}</dd></div> : null}
      <div data-k="candidates" data-on="true"><dt>candidatos</dt><dd>{model.counts.sources}</dd></div>
      <div data-k="evidence" data-on="true"><dt>Evidence</dt><dd>{model.counts.evidence}</dd></div>
      <div data-k="support" data-on="true" className="is-support"><dt>SUPPORT</dt><dd>{model.counts.supported}</dd></div>
    </dl>
    <aside className="forge-live-panel" aria-label="Candidatos → Evidence">
      <header className="forge-panel-head"><h3>Candidatos → Evidence</h3><span ref={countRef} className="forge-panel-count">{model.counts.sources} de {model.counts.sources}</span></header>
      {visibleSources.length ? <ul className="forge-live-sources" aria-label={`Fuentes de la misión (${sources.length})`}>
        {visibleSources.map((source) => <li key={source.id} ref={setCardRef(source.id, finalStage(source))} className="forge-source" data-state={source.state}>
          <SourceCard source={source} goalTerms={model.goalTerms} onOpenFinds={onOpenFinds} />
        </li>)}
      </ul> : noSourcesCopy(model) ? <p className="forge-live-nosources">{noSourcesCopy(model)}</p> : null}
      {hiddenCount > 0 || expanded ? <button type="button" className="forge-live-more" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
        {expanded ? 'Mostrar menos fuentes' : `Ver ${hiddenCount} ${hiddenCount === 1 ? 'fuente más' : 'fuentes más'}`}<ChevronDown aria-hidden="true" />
      </button> : null}
      <details className="forge-live-legend" open={legendOpen} onToggle={(event) => setLegendOpen(event.currentTarget.open)}>
        <summary>Leyenda</summary>
        <ul>
          <li><i className="lg-spark" />Chispa = candidato que eligió Hermes</li>
          <li><i className="lg-molten" />Hilo fundido = página leída → Evidence</li>
          <li><i className="lg-gold" />Oro = Kernel SUPPORT → Find</li>
          <li><i className="lg-steel" />Acero = leída, sin SUPPORT</li>
          <li><i className="lg-ash" />Ceniza = no leída, con su motivo</li>
        </ul>
        <p>Datos reales de la misión ({countWord(model.counts.sources, 'candidato', 'candidatos')}, {model.counts.evidence} Evidence, {model.counts.supported} SUPPORT){story.nodes.length < sources.length ? ` · el grafo dibuja ${MAX_GRAPH_NODES}` : ''}. El grafo de fondo es decorativo.</p>
        {reducedMotion ? <p className="forge-live-rm">Movimiento reducido: se muestra el estado final, sin animación.</p> : null}
      </details>
      {canReplay ? <button type="button" className="forge-live-replay" disabled={playing} onClick={() => setReplayTick((value) => value + 1)}>
        <RotateCcw aria-hidden="true" />{playing ? 'Reproduciendo…' : 'Repetir la forja'}<span className="forge-sr-only"> (animación con los mismos datos del Kernel)</span>
      </button> : null}
    </aside>
  </div>;
}

function ForgeHeader({ model, headingId, onConnect, onRelaunch, relaunchPending, replaying }: { model: ForgeModel; headingId: string; onConnect?: () => void; onRelaunch?: (goalId: string) => void; relaunchPending?: boolean; replaying: boolean }) {
  if (model.kind === 'offline') {
    return <header className="forge-live-head">
      <div className="forge-live-goal">
        <small className="forge-live-eyebrow">FORJA · {OFFLINE_COPY[model.reason].eyebrow}</small>
        <h2 id={headingId}>{OFFLINE_COPY[model.reason].title}</h2>
        <p className="forge-live-phase"><i data-tone={model.reason === 'connecting' ? 'hot' : 'off'} /><span>{OFFLINE_COPY[model.reason].detail}</span></p>
      </div>
      {onConnect && model.reason !== 'connecting' ? <button type="button" className="forge-live-connect" onClick={onConnect}><Plug aria-hidden="true" />Conectar Kernel</button> : null}
    </header>;
  }
  if (model.kind === 'empty') {
    return <header className="forge-live-head">
      <div className="forge-live-goal">
        <small className="forge-live-eyebrow">FORJA · LISTA</small>
        <h2 id={headingId}>Sin misión activa</h2>
        <p className="forge-live-phase"><i data-tone="idle" /><span>Prepara un Goal y confírmalo: aquí verás sus candidatos, la Evidence y el veredicto SUPPORT reales del Kernel.</span></p>
      </div>
    </header>;
  }
  const current = model.steps.findIndex((step) => step.state === 'active');
  const activeIndex = current >= 0 ? current : lastIndex(model.steps, (step) => step.state !== 'pending' && step.state !== 'skipped');
  const meta = metaPill(model, replaying);
  return <header className="forge-live-head">
    <div className="forge-live-goal">
      <p className="forge-live-kick"><small className="forge-live-eyebrow">GOAL · MISIÓN DEL KERNEL</small><span className="forge-live-id" title={model.missionId}>{shortId(model.missionId)}</span>{meta ? <span className="forge-bench-meta" data-replaying={replaying ? 'true' : undefined} title={meta.join('')}>{meta[0]}<span className="forge-meta-more">{meta[1]}</span></span> : null}</p>
      <h2 id={headingId}>{model.goalTitle || 'Goal sin título'}</h2>
      <p className="forge-live-phase"><i data-tone={phaseTone(model)} /><span><strong>{model.phaseLabel}<PhaseClock since={model.phaseSince} live={model.motion === 'active'} /></strong> {model.phaseDetail}</span></p>
      {model.relaunch && onRelaunch ? <div className="forge-live-relaunch">
        <button type="button" className="forge-live-relaunch-btn" disabled={relaunchPending} onClick={() => { if (model.relaunch) onRelaunch(model.relaunch.goalId); }}>
          <RefreshCw aria-hidden="true" />{relaunchPending ? 'Relanzando…' : 'Relanzar misión'}
        </button>
        <p>El Kernel la dejó leída sin SUPPORT y nadie la está trabajando. Relanzar la vuelve a poner en cola para Hermes con el mismo Goal.</p>
      </div> : null}
      <div className="forge-live-stepbar">
        <ol className="forge-live-steps" aria-label="Progreso de la misión">
          {model.steps.map((step, index) => <li key={step.id} data-state={step.state} data-gold={index >= 3 ? 'true' : undefined} aria-current={index === activeIndex ? 'step' : undefined}>
            <em aria-hidden="true">{step.state === 'failed' ? '×' : index + 1}</em>
            <span className="forge-step-label">{STEP_SHORT[index] ?? step.label}</span>
            <span className="forge-sr-only">: {step.label}, {stepStateLabel(step.state)}</span>
          </li>)}
        </ol>
        <p className="forge-live-stepnow" aria-hidden="true"><span className="forge-stepnow-word">Paso </span>{activeIndex + 1} de 5<span className="forge-stepnow-label"> · {model.steps[activeIndex]?.label}</span></p>
      </div>
    </div>
  </header>;
}

/** Dashed pill next to the kick (the mockup's tag slot): [short head, rest]. */
function metaPill(model: ForgeMissionModel, replaying: boolean): [string, string] | undefined {
  if (model.phase === 'queued' || model.phase === 'waiting_agent') return undefined;
  if (replaying) return ['Reconstrucción', ' · datos reales del Kernel'];
  if (model.phase === 'searching') return model.search.exactQueries.length ? ['Consultas de Hermes', ' registradas por el Kernel'] : ['Hermes busca desde el Goal', ' · la consulta exacta no la publica el Kernel'];
  if (model.counts.sources > 0) {
    const returned = model.searchResultCount !== undefined ? ` · ${model.searchResultCount} ${model.searchResultCount === 1 ? 'resultado devuelto' : 'resultados devueltos'}` : '';
    return ['Búsqueda web terminada', `${returned} · ${model.counts.sources} ${model.counts.sources === 1 ? 'candidato real' : 'candidatos reales'}`];
  }
  return undefined;
}

function shortId(id: string): string {
  return id.length > 22 ? `${id.slice(0, 16)}…${id.slice(-4)}` : id;
}

function countWord(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Final visual stage of a card when no play-through runs (reduced motion, no canvas, beyond the graph). */
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
  return <time className="forge-live-clock" dateTime={since} title={new Date(since).toLocaleString('es-ES')}> · {live ? formatElapsed(elapsed) : `hace ${formatAgo(elapsed)}`}</time>;
}

function SourceCard({ source, goalTerms, onOpenFinds }: { source: ForgeSource; goalTerms: string[]; onOpenFinds?: () => void }) {
  const highlight = source.state === 'supported' || source.state === 'evidence' || source.state === 'unsupported';
  const read = source.state !== 'candidate';
  const code = source.state === 'read_failed' ? readFailureCode(source.reasonCode) : read ? 'leída' : undefined;
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
      <a href={source.url} target="_blank" rel="noreferrer noopener" className="forge-source-link" title={source.url} aria-label={`Abrir fuente ${source.host} (se abre en otra pestaña)`}>{source.host}</a>
      {code ? <span className="forge-source-code" data-tone={source.state === 'read_failed' ? 'bad' : 'ok'} aria-hidden="true">{code}</span> : null}
    </div>
    {source.path ? <p className="forge-source-path">{source.host}{source.path}</p> : null}
    <div className="forge-source-content">
      {hasBody ? <div className="forge-source-pending" aria-hidden="true"><s /><s /></div> : null}
      <div className="forge-source-body">
        {source.findTitle ? <h3 className="forge-source-findtitle">{onOpenFinds
          ? <button type="button" className="forge-source-find" onClick={onOpenFinds}>{source.findTitle}<span className="forge-sr-only"> · ver Find</span></button>
          : source.findTitle}</h3> : null}
        {quote ? <blockquote cite={source.url} title={quote.clipped ? source.quote : undefined}>
          <p>«{source.quoteTruncatedStart ? '… ' : ''}<Highlighted text={quote.text} terms={highlight ? goalTerms : []} />{source.quoteTruncatedEnd || quote.clipped ? ' …' : ''}»</p>
        </blockquote> : source.state !== 'unsupported' && source.evidenceTitle && source.evidenceTitle !== source.findTitle ? <p className="forge-source-title"><Highlighted text={source.evidenceTitle} terms={highlight ? goalTerms : []} /></p>
          : candidateTitle ? <p className="forge-source-title is-candidate">{candidateTitle}</p> : null}
        {source.findTitle ? null : <p className="forge-source-meta">
          <span className="forge-meta-final">{metaLine(source)}</span>
          {read && !hasBody ? <span className="forge-meta-interim" data-at="pending" aria-hidden="true">Pendiente de lectura del Kernel</span> : null}
          {source.state === 'unsupported' ? <span className="forge-meta-interim" data-at="evidence" aria-hidden="true">Leída: Evidence guardada · esperando veredicto</span> : null}
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
  not_connected: { eyebrow: 'SIN CONEXIÓN', title: 'La forja está apagada', detail: 'Solo se enciende con misiones reales de tu Kernel local. Sin conexión no hay fuentes, Evidence ni datos de ejemplo.' },
  connecting: { eyebrow: 'CONECTANDO', title: 'Encendiendo la forja…', detail: 'Esperando la primera lectura del Kernel. Aún no se muestra ninguna fuente ni cifra.' },
  kernel_unreachable: { eyebrow: 'KERNEL SIN RESPUESTA', title: 'La forja está en pausa', detail: 'El Kernel dejó de responder. No se muestran fuentes ni cifras hasta que vuelva.' },
} as const;

const BADGES: Record<ForgeSource['state'], string> = {
  candidate: 'CANDIDATO',
  read_failed: 'NO LEÍDA',
  evidence: 'EVIDENCE',
  supported: 'KERNEL SUPPORT',
  // Read and stored as Evidence; the Kernel verdict (no SUPPORT) is the line under it, as in the mockup.
  unsupported: 'EVIDENCE',
};

function metaLine(source: ForgeSource): string {
  switch (source.state) {
    case 'candidate': return 'Candidato de Hermes · pendiente de lectura del Kernel';
    case 'read_failed': return `× ${source.reason ?? 'El Kernel no pudo leer la página'}`;
    case 'evidence': return quoteNote(source, 'Leída: Evidence guardada · el Kernel no publicó veredicto');
    case 'supported': return source.findTitle ? `Find forjado: ${source.findTitle}` : quoteNote(source, 'Kernel SUPPORT · la página cubre los términos del Goal');
    case 'unsupported': return source.reason ? `× Leída, sin SUPPORT: ${lowerFirst(source.reason)}` : '× Leída, sin Kernel SUPPORT';
  }
}

function lowerFirst(text: string): string {
  return text ? text[0].toLocaleLowerCase('es') + text.slice(1) : text;
}

function quoteNote(source: ForgeSource, fallback: string): string {
  if (source.quoteState === 'unavailable') return `${fallback} · extracto no publicado por este Kernel`;
  if (source.quoteState === 'loading') return `${fallback} · leyendo extracto…`;
  return fallback;
}

function sourceAria(source: ForgeSource): string {
  const quote = source.quote ? `Extracto de Evidence: ${source.quote}.` : '';
  return `${BADGES[source.state]} · ${source.host}. ${quote} ${metaLine(source)}`.replace(/\s+/g, ' ').trim();
}

/** Adapter placeholder titles ("Public source: host") repeat the host line; they carry no content. */
const GENERIC_CANDIDATE_TITLE = /^public source:\s*\S+$/i;

function noSourcesCopy(model: ForgeMissionModel): string {
  if (model.phase === 'searching') return 'Aún no hay candidatos: Hermes los está buscando. El grafo no dibuja nodos sin URLs reales.';
  if (model.phase === 'waiting_agent' || model.phase === 'queued') return 'Sin candidatos todavía: la misión espera a Hermes.';
  if (model.phase === 'completed_empty') return 'La búsqueda terminó sin candidatos que verificar.';
  return 'El Kernel no publicó fuentes para esta misión.';
}

function phaseTone(model: ForgeMissionModel): string {
  if (model.phase === 'forged') return 'gold';
  if (model.motion === 'active') return 'hot';
  if (model.phase === 'failed' || model.phase === 'blocked' || model.phase === 'read_failed_all') return 'alert';
  return 'ash';
}

function stepStateLabel(state: ForgeStepState): string {
  return { pending: 'pendiente', active: 'en curso', done: 'hecho', gold: 'hecho con Kernel SUPPORT', failed: 'sin resultado', skipped: 'no aplica' }[state];
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
  return `${Math.floor(hours / 24)} días`;
}

/** Coarse elapsed time for a settled phase; precise to the minute, never to a stale second. */
export function formatAgo(seconds: number): string {
  if (seconds < 60) return 'menos de 1 min';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} días`;
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
