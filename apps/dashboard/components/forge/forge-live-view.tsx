'use client';

import { Check, ChevronDown, ExternalLink, Plug, RotateCcw, Search, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ForgeMissionModel, ForgeModel, ForgeSource, ForgeStepState } from '../../lib/forge/forge-model';
import { buildForgeScene } from '../../lib/forge/forge-scene';
import { goalTermSegments } from '../../lib/forge/goal-terms';
import { ForgeRenderer, type CardStage, type SceneSpec } from './forge-renderer';

const NARROW_MAX = 760;
const VISIBLE_WIDE = 12;
const VISIBLE_NARROW = 6;

type Props = {
  model: ForgeModel;
  onConnect?: () => void;
  onOpenFinds?: () => void;
  /** Visible heading level context; Home uses h2 under its own title. */
  headingId?: string;
};

export function ForgeLiveView({ model, onConnect, onOpenFinds, headingId = 'forge-live-title' }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const anvilRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const stagesRef = useRef(new Map<string, CardStage>());
  const rendererRef = useRef<ForgeRenderer | undefined>(undefined);
  const measureRef = useRef<() => void>(() => undefined);
  // Mobile-first: start narrow; a wide container flips this before first paint (layout effect).
  const [narrow, setNarrow] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [legendOpen, setLegendOpen] = useState<boolean | undefined>(undefined);
  const [replay, setReplay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reducedMotion = useReducedMotion();
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  const mission = model.kind === 'mission' ? model : undefined;
  const scene = useMemo(() => buildForgeScene(model), [model]);
  const sources = useMemo(() => mission?.sources ?? [], [mission]);
  const limit = narrow ? VISIBLE_NARROW : VISIBLE_WIDE;
  const visibleSources = useMemo(() => (expanded ? sources : sources.slice(0, limit)), [expanded, limit, sources]);
  const hiddenCount = sources.length - visibleSources.length;
  const showTray = Boolean(mission && (mission.counts.supported > 0 || mission.phase === 'forged'));
  const missionKey = mission?.missionId ?? model.kind;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: ForgeRenderer;
    try {
      renderer = new ForgeRenderer(canvas, {
        reducedMotion: () => reducedRef.current,
        onStage: (id, stage) => {
          stagesRef.current.set(id, stage);
          const el = cardRefs.current.get(id);
          if (el) el.dataset.stage = stage;
        },
        onPlaying: setPlaying,
        onTray: (landed) => { if (trayRef.current) trayRef.current.dataset.landed = String(landed); },
      });
    } catch { return; }
    rendererRef.current = renderer;
    measureRef.current();
    const onVisibility = () => renderer.setVisibility(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver((entries) => renderer.setOnScreen(entries.some((entry) => entry.isIntersecting)));
      observer.observe(canvas);
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
      renderer.destroy();
      rendererRef.current = undefined;
    };
  }, []);

  // A different mission replays from scratch; stale card stages never leak across missions.
  useEffect(() => { stagesRef.current.clear(); setReplay((value) => value + 1); }, [missionKey]);

  const measure = useCallback(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const anvil = anvilRef.current;
    if (!root || !stage || !anvil) return;
    const width = root.clientWidth;
    const isNarrow = width > 0 ? width < NARROW_MAX : true;
    if (isNarrow !== narrow) { setNarrow(isNarrow); return; }
    const renderer = rendererRef.current;
    if (!renderer) return;
    const box = stage.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return;
    const anvilBox = anvil.getBoundingClientRect();
    const scale = isNarrow ? Math.min(0.78, anvilBox.width / 330) : Math.min(1, Math.max(0.62, anvilBox.width / 340));
    const anvilSpec = {
      x: anvilBox.left - box.left + anvilBox.width / 2,
      y: anvilBox.top - box.top + anvilBox.height * (isNarrow ? 0.62 : 0.56),
      scale,
    };
    const trayBox = showTray ? trayRef.current?.getBoundingClientRect() : undefined;
    const centerX = box.width / 2;
    const byId = new Map(scene.elements.map((item) => [item.id, item]));
    const threads: SceneSpec['threads'] = [];
    let laneLeft = 0;
    let laneRight = 0;
    let laneDown = 0;
    for (const source of visibleSources) {
      const el = cardRefs.current.get(source.id);
      const element = byId.get(source.id);
      if (!el || !element) continue;
      const card = el.getBoundingClientRect();
      const left = card.left - box.left;
      const top = card.top - box.top;
      const base = { id: source.id, kind: element.kind, ...(element.readFailed ? { readFailed: true } : {}) };
      if (isNarrow) threads.push({ ...base, ax: left, ay: top + 22, side: 'down', lane: laneDown++ });
      else if (left + card.width / 2 < centerX) threads.push({ ...base, ax: left + card.width, ay: top + Math.min(card.height / 2, 34), side: 'left', lane: laneLeft++ });
      else threads.push({ ...base, ax: left, ay: top + Math.min(card.height / 2, 34), side: 'right', lane: laneRight++ });
    }
    renderer.update({
      width: box.width,
      height: box.height,
      layout: isNarrow ? 'narrow' : 'wide',
      anvil: anvilSpec,
      tray: trayBox ? { x: trayBox.left - box.left, y: trayBox.top - box.top + trayBox.height - 24, w: trayBox.width } : null,
      threads,
      mood: scene.mood,
      motion: scene.motion,
      searchPulse: scene.searchPulse,
      replay,
    });
  }, [narrow, replay, scene, showTray, visibleSources]);

  measureRef.current = measure;
  useLayoutEffect(() => { measure(); }, [measure, reducedMotion]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver !== 'function') return;
    let frame = 0;
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); });
    observer.observe(root);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [measure]);

  useEffect(() => {
    if (legendOpen !== undefined || typeof window.matchMedia !== 'function') return;
    setLegendOpen(!window.matchMedia('(max-width: 720px)').matches);
  }, [legendOpen]);

  const setCardRef = useCallback((id: string) => (el: HTMLElement | null) => {
    if (!el) { cardRefs.current.delete(id); return; }
    cardRefs.current.set(id, el);
    const stage = stagesRef.current.get(id);
    if (stage) el.dataset.stage = stage;
  }, []);

  const phaseKey = model.kind === 'mission' ? model.phase : model.kind;
  const canReplay = Boolean(mission && sources.length > 0 && !reducedMotion && mission.motion === 'settled');
  return <section
    ref={rootRef}
    className="forge-live"
    data-kind={model.kind}
    data-phase={phaseKey}
    data-mood={scene.mood}
    data-layout={narrow ? 'narrow' : 'wide'}
    data-playing={playing ? 'true' : undefined}
    data-reduced-motion={reducedMotion ? 'true' : undefined}
    aria-labelledby={headingId}
  >
    <ForgeHeader model={model} headingId={headingId} onConnect={onConnect} />
    <div ref={stageRef} className="forge-live-stage">
      <canvas ref={canvasRef} className="forge-live-canvas" aria-hidden="true" />
      <div ref={anvilRef} className="forge-live-anvil">
        {mission ? <ForgeWorkbench model={mission} replaying={playing && mission.motion === 'settled'} /> : null}
        <span className="forge-live-anvil-label" aria-hidden="true">KERNEL · GOAL</span>
      </div>
      {mission ? <>
        {visibleSources.length ? <ul className="forge-live-sources" aria-label={`Fuentes de la misión (${sources.length})`}>
          {visibleSources.map((source) => <li key={source.id} ref={setCardRef(source.id)} className="forge-source" data-state={source.state}>
            <SourceCard source={source} goalTerms={mission.goalTerms} onOpenFinds={onOpenFinds} />
          </li>)}
        </ul> : <p className="forge-live-nosources">{noSourcesCopy(mission)}</p>}
        {hiddenCount > 0 || expanded ? <button type="button" className="forge-live-more" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Mostrar menos fuentes' : `Ver ${hiddenCount} ${hiddenCount === 1 ? 'fuente más' : 'fuentes más'}`}<ChevronDown />
        </button> : null}
        {showTray ? <div ref={trayRef} className="forge-live-tray" aria-hidden="true"><span>FIND · KERNEL SUPPORT ({mission.counts.supported})</span></div> : null}
      </> : null}
    </div>
    {mission ? <footer className="forge-live-foot">
      <dl className="forge-live-counters" aria-label="Contadores de la misión">
        <div><dt>fuentes</dt><dd>{mission.counts.sources}</dd></div>
        <div><dt>leídas</dt><dd>{mission.counts.read}</dd></div>
        <div><dt>Evidence</dt><dd>{mission.counts.evidence}</dd></div>
        <div className="is-support"><dt>con SUPPORT</dt><dd>{mission.counts.supported}</dd></div>
      </dl>
      {canReplay ? <button type="button" className="forge-live-replay" disabled={playing} onClick={() => { stagesRef.current.clear(); setReplay((value) => value + 1); }}>
        <RotateCcw aria-hidden="true" />{playing ? 'Reproduciendo…' : 'Repetir la forja'}<span className="forge-sr-only"> (animación con los mismos datos del Kernel)</span>
      </button> : null}
      <details className="forge-live-legend" open={legendOpen ?? false} onToggle={(event) => setLegendOpen(event.currentTarget.open)}>
        <summary>Leyenda</summary>
        <ul>
          <li><i className="lg-spark" />Chispa = candidato real de la búsqueda (no es Evidence)</li>
          <li><i className="lg-ember" />Brasa = página leída por el Kernel</li>
          <li><i className="lg-molten" />Hilo fundido = Evidence guardada</li>
          <li><i className="lg-gold" />Acero-oro = Kernel SUPPORT → Find</li>
          <li><i className="lg-term" />Dorado en el texto = términos del Goal en el extracto</li>
          <li><i className="lg-ash" />Ceniza = sin SUPPORT o no se pudo leer (con su motivo)</li>
        </ul>
        {reducedMotion ? <p className="forge-live-rm">Movimiento reducido: se muestra el estado final, sin animación.</p> : null}
      </details>
    </footer> : null}
    <p className="forge-sr-only" aria-live="polite" aria-atomic="true">{model.summary}</p>
  </section>;
}

function ForgeHeader({ model, headingId, onConnect }: { model: ForgeModel; headingId: string; onConnect?: () => void }) {
  if (model.kind === 'offline') {
    return <header className="forge-live-head">
      <div className="forge-live-goal">
        <small className="forge-live-eyebrow">FORJA · {OFFLINE_COPY[model.reason].eyebrow}</small>
        <h2 id={headingId}>{OFFLINE_COPY[model.reason].title}</h2>
        <p className="forge-live-phase"><i data-tone={model.reason === 'connecting' ? 'hot' : 'off'} /><span>{OFFLINE_COPY[model.reason].detail}</span></p>
      </div>
      {onConnect && model.reason !== 'connecting' ? <button type="button" className="forge-live-connect" onClick={onConnect}><Plug />Conectar Kernel</button> : null}
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
  return <header className="forge-live-head">
    <div className="forge-live-goal">
      <small className="forge-live-eyebrow">GOAL · MISIÓN DEL KERNEL</small>
      <h2 id={headingId}>{model.goalTitle || 'Goal sin título'}</h2>
      <p className="forge-live-phase"><i data-tone={phaseTone(model)} /><span><strong>{model.phaseLabel}<PhaseClock since={model.phaseSince} live={model.motion === 'active'} /></strong> {model.phaseDetail}</span></p>
    </div>
    <ol className="forge-live-steps" aria-label="Progreso de la misión">
      {model.steps.map((step, index) => <li key={step.id} data-state={step.state} aria-current={index === activeIndex ? 'step' : undefined}>
        <b aria-hidden="true">{step.state === 'done' || step.state === 'gold' ? <Check /> : step.state === 'failed' ? <X /> : index + 1}</b>
        <span>{step.label}</span>
        <span className="forge-sr-only">: {stepStateLabel(step.state)}</span>
      </li>)}
    </ol>
    <p className="forge-live-stepnow" aria-hidden="true">Paso {activeIndex + 1} de 5 · {model.steps[activeIndex]?.label}</p>
  </header>;
}

/**
 * What the anvil is working on, in words: the search Hermes runs from the Goal (the Kernel does not
 * publish the exact query string unless a row carries it), the mission keywords, and for waiting
 * states the honest next step.
 */
function ForgeWorkbench({ model, replaying }: { model: ForgeMissionModel; replaying: boolean }) {
  const waiting = model.phase === 'queued' || model.phase === 'waiting_agent';
  const searching = model.phase === 'searching';
  const searched = model.counts.sources > 0;
  if (waiting) {
    return <div className="forge-bench" data-mode="waiting">
      <p className="forge-bench-title"><span className="forge-bench-embers" aria-hidden="true"><i /><i /><i /></span>{model.phase === 'queued' ? 'Esperando turno del agente' : 'Esperando a que Hermes se conecte'}</p>
      {model.nextStep ? <p className="forge-bench-next">{model.nextStep}</p> : null}
    </div>;
  }
  if (!searching && !searched) return null;
  const queries = model.search.exactQueries;
  return <div className="forge-bench" data-mode={searching ? 'searching' : 'searched'}>
    <p className="forge-bench-query">
      <Search aria-hidden="true" />
      <span className="forge-bench-q">{queries.length ? queries.map((query) => `«${query}»`).join(' · ') : `«${model.search.goal}»`}</span>
      {searching ? <span className="forge-bench-caret" aria-hidden="true" /> : null}
    </p>
    <p className="forge-bench-meta" data-replaying={replaying ? 'true' : undefined}>
      {replaying && !searching ? 'Reconstrucción · datos reales del Kernel' : searching
        ? (queries.length ? 'Consultas de Hermes publicadas por el Kernel' : 'Hermes busca en la web pública a partir del Goal · la consulta exacta no la publica el Kernel')
        : `Búsqueda web terminada · ${model.counts.sources} ${model.counts.sources === 1 ? 'candidato real' : 'candidatos reales'}`}
    </p>
    {model.search.keywords.length ? <ul className="forge-bench-keywords" aria-label="Palabras clave de la misión">
      {model.search.keywords.map((keyword) => <li key={keyword}>{keyword}</li>)}
    </ul> : null}
  </div>;
}

function PhaseClock({ since, live }: { since?: string; live: boolean }) {
  const now = useNow(live && Boolean(since) ? 1000 : 0);
  if (!since || !now) return null;
  const elapsed = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  if (!Number.isFinite(elapsed)) return null;
  // Live phases show how long the Kernel has been in this phase; settled ones when it ended.
  return <time className="forge-live-clock" dateTime={since} title={new Date(since).toLocaleString('es-ES')}> · {live ? '' : 'hace '}{formatElapsed(elapsed)}</time>;
}

function SourceCard({ source, goalTerms, onOpenFinds }: { source: ForgeSource; goalTerms: string[]; onOpenFinds?: () => void }) {
  const badge = BADGES[source.state];
  const interim = INTERIM[source.state];
  const highlight = source.state === 'supported' || source.state === 'evidence' || source.state === 'unsupported';
  return <article aria-label={sourceAria(source)}>
    <header>
      <span className="forge-source-badge">
        <span className="forge-badge-final">{source.state === 'supported' ? <Check aria-hidden="true" /> : null}{badge}</span>
        {source.state !== 'candidate' ? <span className="forge-badge-interim" data-at="landed" aria-hidden="true">CANDIDATO</span> : null}
        {interim === 'EVIDENCE' ? <span className="forge-badge-interim" data-at="evidence" aria-hidden="true">EVIDENCE</span> : null}
      </span>
      <span className="forge-source-host" title={source.url}>{source.host}{source.path ? <small>{source.path}</small> : null}</span>
    </header>
    {source.quote ? <blockquote cite={source.url}>
      <p>«{source.quoteTruncatedStart ? '… ' : ''}<Highlighted text={source.quote} terms={highlight ? goalTerms : []} />{source.quoteTruncatedEnd ? ' …' : ''}»</p>
    </blockquote> : source.evidenceTitle ? <p className="forge-source-title"><Highlighted text={source.evidenceTitle} terms={highlight ? goalTerms : []} /></p>
      : source.candidateTitle ? <p className="forge-source-title is-candidate">{source.candidateTitle}</p> : null}
    {source.state === 'supported' && source.goalTerms?.length ? <ul className="forge-source-terms" aria-label="Términos del Goal presentes en la Evidence">
      {source.goalTerms.map((term) => <li key={term}><Check aria-hidden="true" />{term}</li>)}
    </ul> : null}
    <p className="forge-source-meta">{metaLine(source)}</p>
    <div className="forge-source-actions">
      {source.findTitle && onOpenFinds ? <button type="button" className="forge-source-find" onClick={onOpenFinds}><Sparkles aria-hidden="true" />Ver Find</button> : null}
      <a href={source.url} target="_blank" rel="noreferrer noopener" className="forge-source-link">Abrir fuente<ExternalLink aria-hidden="true" /><span className="forge-sr-only"> {source.host} (se abre en otra pestaña)</span></a>
    </div>
  </article>;
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
  unsupported: 'SIN SUPPORT',
};

/** The earlier real stage of the same record, shown while its own transition is still playing. */
const INTERIM: Record<ForgeSource['state'], string | undefined> = {
  candidate: undefined,
  read_failed: 'CANDIDATO',
  evidence: 'CANDIDATO',
  supported: 'EVIDENCE',
  unsupported: 'EVIDENCE',
};

function metaLine(source: ForgeSource): string {
  switch (source.state) {
    case 'candidate': return 'Candidato de Hermes · pendiente de lectura del Kernel';
    case 'read_failed': return `× ${source.reason ?? 'El Kernel no pudo leer la página'}`;
    case 'evidence': return quoteNote(source, 'Evidence guardada · el Kernel no publicó veredicto');
    case 'supported': return source.findTitle ? `Find forjado: ${source.findTitle}` : quoteNote(source, 'Kernel SUPPORT · la página cubre los términos del Goal');
    case 'unsupported': return `× ${source.reason ?? 'Sin Kernel SUPPORT'}`;
  }
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

function noSourcesCopy(model: ForgeMissionModel): string {
  if (model.phase === 'searching') return 'Aún no hay candidatos: Hermes los está buscando. La forja no dibuja chispas sin URLs reales.';
  if (model.phase === 'waiting_agent' || model.phase === 'queued') return 'Aún sin candidatos: cada URL real que encuentre Hermes saldrá del yunque como una chispa.';
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
