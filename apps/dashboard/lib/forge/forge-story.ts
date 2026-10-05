import type { ForgeMissionModel, ForgeSource } from './forge-model';

/**
 * The crawler-forge story: a pure projection of the Kernel mission (ForgeMissionModel) onto the
 * spider graph, the forge.log ticker and the play-through timeline.
 *
 * Honesty contract (forge-story.test.ts):
 * - every graph node is a real Mission candidate / Kernel verification row, nothing else;
 * - the background web graph is decorative and never counted here;
 * - the search query text and the search result count exist only when the Kernel row carries them;
 * - every log line comes from a real record: a candidate, a Kernel read (or its failure code),
 *   a Kernel SUPPORT verdict or a Kernel-backed Find. While the Kernel is verifying, per-page
 *   progress does not exist, so the log says the batch is in progress and nothing more.
 */

export const MAX_GRAPH_NODES = 8;

export type StoryOutcome = 'pending' | 'support' | 'evidence' | 'unsupported' | 'unread';
export type StoryNode = {
  id: string;
  host: string;
  path: string;
  outcome: StoryOutcome;
  /** Read result shown next to the host: a Kernel failure code (403, ENOTFOUND…) or "leída". */
  code?: string;
  codeTone: 'ok' | 'bad' | 'none';
  findTitle?: string;
};
/**
 * A page a search returned (display-only searchTelemetry): named around the spider, never a graph
 * node, never counted as a candidate, Evidence or SUPPORT. `candidate` marks the ones Hermes also
 * proposed as candidates (those still appear as real nodes on their own).
 */
export type StoryResult = { query: number; host: string; title?: string; candidate: boolean };
export type LogTone = 'k' | 'txt' | 'ok' | 'bad' | 'au' | 'c';
export type LogSeg = { tone: LogTone; text: string };
export type LogCue =
  | { kind: 'query'; index: number }
  | { kind: 'results'; index: number }
  | { kind: 'pick'; node: number }
  | { kind: 'reading' }
  | { kind: 'read'; node: number }
  | { kind: 'support'; node: number }
  | { kind: 'find'; node: number };
export type LogLine = { id: string; cue: LogCue; segs: LogSeg[] };
/** How far the real Kernel data goes: the play-through holds there until the data moves on. */
export type StoryReach = 'idle' | 'searching' | 'candidates' | 'final';

export type ForgeStory = {
  missionId: string;
  /**
   * Exact queries only when the Kernel recorded them (Mission searchTelemetry); otherwise the forge
   * types the Goal and says "desde el Goal". `text` is the first query (or the Goal).
   */
  query: { text: string; exact: boolean; all: string[] };
  /** Per-search result counts as recorded (undefined where the record has none). */
  runCounts: (number | undefined)[];
  /** Total results returned, only when every recorded search carries its count. */
  resultCount?: number;
  nodes: StoryNode[];
  hiddenNodes: number;
  /** Pages the recorded searches returned (≤30), only when the Kernel row carries them. */
  results: StoryResult[];
  reach: StoryReach;
  log: LogLine[];
  counts: { candidates: number; evidence: number; supported: number };
};

export function buildForgeStory(model: ForgeMissionModel): ForgeStory {
  const exact = model.search.exactQueries;
  const runs = model.search.runs ?? [];
  const query = exact.length
    ? { text: exact[0], exact: true, all: [...exact] }
    : { text: model.search.goal || model.goalTitle, exact: false, all: [model.search.goal || model.goalTitle] };
  const all = model.sources.map(storyNode);
  const nodes = all.slice(0, MAX_GRAPH_NODES);
  const reach = storyReach(model);
  const candidateUrls = new Set(model.sources.map((source) => source.url));
  const results: StoryResult[] = exact.length ? runs.flatMap((run, index) => (run.results ?? []).map((result) => ({
    query: index, host: result.host, ...(result.title ? { title: result.title } : {}), candidate: candidateUrls.has(result.url),
  }))) : [];
  const log: LogLine[] = [];
  if (exact.length) {
    exact.forEach((text, index) => {
      log.push({ id: `query:${index}`, cue: { kind: 'query', index }, segs: [{ tone: 'k', text: '$ hermes.search ' }, { tone: 'txt', text: `«${clip(text, 30)}»` }] });
      const count = runs[index]?.resultCount;
      if (count !== undefined) {
        log.push({ id: `results:${index}`, cue: { kind: 'results', index }, segs: [{ tone: 'k', text: '← buscador ' }, { tone: 'txt', text: `${count} ${count === 1 ? 'resultado' : 'resultados'}` }] });
      }
    });
  } else {
    log.push({ id: 'query', cue: { kind: 'query', index: 0 }, segs: [{ tone: 'k', text: '$ hermes.search ' }, { tone: 'txt', text: '← Goal' }, { tone: 'c', text: '  # consulta no publicada' }] });
  }
  nodes.forEach((node, index) => log.push({ id: `pick:${node.id}`, cue: { kind: 'pick', node: index }, segs: [{ tone: 'k', text: '+ candidato ' }, { tone: 'txt', text: clip(node.host, 30) }] }));
  if (reach === 'candidates') {
    log.push({ id: 'reading', cue: { kind: 'reading' }, segs: [{ tone: 'k', text: 'kernel.read ' }, { tone: 'txt', text: `${all.length} ${all.length === 1 ? 'candidato' : 'candidatos'} ` }, { tone: 'c', text: '· en curso' }] });
  }
  nodes.forEach((node, index) => {
    if (node.outcome === 'pending') return;
    log.push({ id: `read:${node.id}`, cue: { kind: 'read', node: index }, segs: [{ tone: 'k', text: 'kernel.read ' }, { tone: 'txt', text: `${clip(node.host, 24)} ` }, node.outcome === 'unread'
      ? { tone: 'bad', text: node.code ?? 'ERROR' }
      : { tone: 'ok', text: '✓ Evidence' }] });
  });
  nodes.forEach((node, index) => {
    if (node.outcome !== 'support' && node.outcome !== 'unsupported') return;
    log.push({ id: `support:${node.id}`, cue: { kind: 'support', node: index }, segs: [{ tone: 'k', text: 'kernel.support ' }, { tone: 'txt', text: `${clip(node.host, 22)} ` }, node.outcome === 'support'
      ? { tone: 'au', text: '✓ SUPPORT' }
      : { tone: 'bad', text: '× sin SUPPORT' }] });
  });
  nodes.forEach((node, index) => {
    if (node.outcome !== 'support' || !node.findTitle) return;
    log.push({ id: `find:${node.id}`, cue: { kind: 'find', node: index }, segs: [{ tone: 'k', text: 'forge.find ' }, { tone: 'au', text: `✓ ${shortTitle(node.findTitle)}` }] });
  });
  return {
    missionId: model.missionId,
    query,
    runCounts: exact.map((_, index) => runs[index]?.resultCount),
    ...(model.searchResultCount !== undefined ? { resultCount: model.searchResultCount } : {}),
    nodes,
    hiddenNodes: all.length - nodes.length,
    results,
    reach,
    log,
    counts: { candidates: model.counts.sources, evidence: model.counts.evidence, supported: model.counts.supported },
  };
}

function storyReach(model: ForgeMissionModel): StoryReach {
  if (model.phase === 'waiting_agent' || model.phase === 'queued') return 'idle';
  if (model.phase === 'searching' && !model.sources.length) return 'searching';
  // Searching or verifying: play through to the verdicts the Kernel already published, else hold on the candidates.
  if (model.phase === 'searching' || model.phase === 'verifying') return model.sources.some((item) => item.state !== 'candidate') ? 'final' : 'candidates';
  return 'final';
}

function storyNode(source: ForgeSource): StoryNode {
  const base = { id: source.id, host: source.host, path: source.path };
  switch (source.state) {
    case 'supported': return { ...base, outcome: 'support', code: 'leída', codeTone: 'ok', ...(source.findTitle ? { findTitle: source.findTitle } : {}) };
    case 'unsupported': return { ...base, outcome: 'unsupported', code: 'leída', codeTone: 'ok' };
    case 'evidence': return { ...base, outcome: 'evidence', code: 'leída', codeTone: 'ok' };
    case 'read_failed': return { ...base, outcome: 'unread', code: readFailureCode(source.reasonCode), codeTone: 'bad' };
    default: return { ...base, outcome: 'pending', codeTone: 'none' };
  }
}

/** Short machine code for a Kernel read failure ("web.read returned HTTP 403" → "403"). */
export function readFailureCode(reason?: string): string {
  if (!reason) return 'ERROR';
  const http = reason.match(/HTTP\s+(\d{3})/i);
  if (http) return http[1];
  const sys = reason.match(/\b(ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|EHOSTUNREACH|CERT_[A-Z_]+)\b/);
  if (sys) return sys[1];
  if (/timeout|timed out|abort/i.test(reason)) return 'TIMEOUT';
  if (/empty content/i.test(reason)) return 'VACÍA';
  if (/bot-protection/i.test(reason)) return 'ANTI-BOT';
  if (/private network/i.test(reason)) return 'RED PRIVADA';
  return 'ERROR';
}

/** Ticker-sized Find title: the part before " | " or ": " when that reads as a title, else clipped. */
export function shortTitle(title: string): string {
  const head = title.split(/\s+\|\s+|:\s+/)[0]?.trim() ?? title;
  return clip(head.length >= 12 ? head : title, 36);
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// ---------------------------------------------------------------- play-through timeline (seconds)

export type StoryTimeline = {
  q0: number; q1: number; crawl0: number; spider0: number;
  /** When the crawl edges start reaching the real candidates (crawl0, or after the result webs). */
  nodes0: number;
  /** Per query: typing start / end in the chip, and when its result count comes back. */
  qa: number[]; qb: number[]; ra: number[];
  pick: number[]; pull: number[]; read: number[];
  /** One hammer strike per Kernel SUPPORT node, in node order. */
  strike: number[]; strikeNode: number[];
  verdict: number; find: number; end: number;
  hold: Record<StoryReach, number>;
};

/**
 * opts.resultWebs: the renderer draws the pages each search returned around the spider (desktop,
 * only when the Kernel row carries them). Then every query's results get a short dwell before the
 * next query types, and the spider starts picking candidates after the last one.
 */
export function storyTimeline(story: Pick<ForgeStory, 'nodes'> & { query?: { all: string[] } }, opts: { resultWebs?: boolean } = {}): StoryTimeline {
  const n = story.nodes.length;
  const q0 = 0.8;
  const q1 = 1.9;
  const crawl0 = 2.0;
  // The first query types before the crawl; every further query Hermes recorded (up to the telemetry
  // cap of 8) types while it crawls, faster when there are many, and all are typed before the spider.
  const queries = Math.max(1, Math.min(8, story.query?.all.length ?? 1));
  const qa = [q0], qb = [q1];
  let ra: number[];
  let spider0 = 4.25;
  let nodes0 = crawl0;
  if (opts.resultWebs) {
    // each query's returned pages stay named for a dwell before the next query types
    const dwell = queries <= 3 ? 2 : Math.max(1, 6 / queries);
    ra = [q1 + 0.35];
    for (let i = 1; i < queries; i += 1) { const a = ra[i - 1] + dwell; qa.push(a); qb.push(a + 0.55); ra.push(a + 0.9); }
    spider0 = Math.max(spider0, ra[queries - 1] + dwell + 0.4);
    nodes0 = Math.max(crawl0, spider0 - 2);
  } else {
    const step = queries > 1 ? Math.min(0.85, 1.9 / (queries - 1)) : 0;
    for (let i = 1; i < queries; i += 1) { qa.push(crawl0 + 0.1 + (i - 1) * step); qb.push(crawl0 + 0.1 + (i - 1) * step + step * 0.65); }
    ra = qb.map((end) => end + 0.35);
  }
  const pickStep = n ? clampNum(2.4 / n, 0.3, 0.6) : 0;
  const pick = story.nodes.map((_, k) => spider0 + pickStep * (k + 1));
  const pickEnd = n ? pick[n - 1] : spider0;
  const pullStep = n ? clampNum(1.4 / n, 0.18, 0.35) : 0;
  const pull = story.nodes.map((_, k) => pickEnd + 0.4 + pullStep * k);
  const pullEnd = n ? pull[n - 1] : pickEnd;
  const readStep = n ? clampNum(2.6 / n, 0.3, 0.65) : 0;
  const read0 = pullEnd + 1.1;
  const read = story.nodes.map((_, k) => read0 + readStep * k);
  const readEnd = n ? read[n - 1] : read0;
  const strikeNode = story.nodes.map((node, k) => (node.outcome === 'support' ? k : -1)).filter((k) => k >= 0);
  const strike = strikeNode.map((_, j) => readEnd + 1.4 + j * 1.2);
  const verdict = strike.length ? strike[0] : readEnd + 1.2;
  const find = strike.length ? strike[strike.length - 1] + 0.9 : verdict + 0.4;
  const end = find + 2.2;
  return {
    q0, q1, crawl0, spider0, nodes0, qa, qb, ra, pick, pull, read, strike, strikeNode, verdict, find, end,
    // idle holds before the query is typed (no search yet); searching holds before the crawl reaches any
    // real node (the spider roams the decorative graph meanwhile).
    hold: { idle: q0 - 0.3, searching: crawl0 - 0.05, candidates: read0 - 0.15, final: end },
  };
}

/** Where a story clock at time t is, as the 5 product steps (0 Goal … 4 Find). */
export function storyStep(timeline: StoryTimeline, t: number): number {
  if (t < timeline.crawl0) return 1;
  if (!timeline.read.length || t < timeline.read[0]) return 1;
  if (t < timeline.verdict) return 2;
  if (t < timeline.find) return 3;
  return 4;
}

function clampNum(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
