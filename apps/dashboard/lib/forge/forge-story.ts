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
export type LogTone = 'k' | 'txt' | 'ok' | 'bad' | 'au' | 'c';
export type LogSeg = { tone: LogTone; text: string };
export type LogCue =
  | { kind: 'query' }
  | { kind: 'results' }
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
  /** Exact query only when the Kernel row publishes it; otherwise the forge says "desde el Goal". */
  query: { text: string; exact: boolean };
  resultCount?: number;
  nodes: StoryNode[];
  hiddenNodes: number;
  reach: StoryReach;
  log: LogLine[];
  counts: { candidates: number; evidence: number; supported: number };
};

export function buildForgeStory(model: ForgeMissionModel): ForgeStory {
  const exact = model.search.exactQueries;
  const query = exact.length ? { text: exact.join(' · '), exact: true } : { text: model.search.goal || model.goalTitle, exact: false };
  const all = model.sources.map(storyNode);
  const nodes = all.slice(0, MAX_GRAPH_NODES);
  const reach = storyReach(model);
  const log: LogLine[] = [];
  log.push({ id: 'query', cue: { kind: 'query' }, segs: exact.length
    ? [{ tone: 'k', text: '$ hermes.search ' }, { tone: 'txt', text: `«${clip(query.text, 30)}»` }]
    : [{ tone: 'k', text: '$ hermes.search ' }, { tone: 'txt', text: '← Goal' }, { tone: 'c', text: '  # consulta no publicada' }] });
  if (model.searchResultCount !== undefined) {
    log.push({ id: 'results', cue: { kind: 'results' }, segs: [{ tone: 'k', text: '← buscador ' }, { tone: 'txt', text: `${model.searchResultCount} ${model.searchResultCount === 1 ? 'resultado' : 'resultados'}` }] });
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
    ...(model.searchResultCount !== undefined ? { resultCount: model.searchResultCount } : {}),
    nodes,
    hiddenNodes: all.length - nodes.length,
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
  pick: number[]; pull: number[]; read: number[];
  /** One hammer strike per Kernel SUPPORT node, in node order. */
  strike: number[]; strikeNode: number[];
  verdict: number; find: number; end: number;
  hold: Record<StoryReach, number>;
};

export function storyTimeline(story: Pick<ForgeStory, 'nodes'>): StoryTimeline {
  const n = story.nodes.length;
  const q0 = 0.8;
  const q1 = 1.9;
  const crawl0 = 2.0;
  const spider0 = 4.25;
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
    q0, q1, crawl0, spider0, pick, pull, read, strike, strikeNode, verdict, find, end,
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
