/**
 * Crawler-forge canvas renderer (v3): the approved mockup's visual language driven only by the
 * story built from real Kernel data (lib/forge/forge-story.ts).
 *
 * Data → light:
 * - graph nodes = the real candidates of the mission (one node per candidate, at most 8 drawn);
 * - crawl edges, the spider walk and the spark that falls into the anvil = that candidate;
 * - molten thread to its card = a real Kernel read that stored Evidence; ash = a real failed read,
 *   tagged with its Kernel code; gold + hammer strike + ingot = a real Kernel SUPPORT.
 * Atmosphere (dust, the decorative web graph labelled "fondo decorativo · no se cuenta", glow,
 * embers, steam, bloom) carries no data and is never counted.
 *
 * Clock: the story time t plays to the hold of the current data reach (idle → searching →
 * candidates → final) and waits there until the Kernel data moves on; then it continues. A new
 * mission or "Repetir la forja" restarts it. Reduced motion draws the held frame once. The loop
 * pauses when the tab is hidden or the forge is off screen.
 */
import type { ForgeStory, LogLine, StoryNode, StoryReach, StoryTimeline } from '../../lib/forge/forge-story';
import { storyStep, storyTimeline } from '../../lib/forge/forge-story';

export type CrawlerStage = 'hidden' | 'candidate' | 'reading' | 'evidence' | 'gold' | 'steel' | 'ash';
export type CrawlerElements = {
  body: HTMLElement;
  stage: HTMLElement;
  chip: HTMLElement | null;
  funnel: HTMLElement | null;
  /** Card element per story node id. */
  card: (id: string) => HTMLElement | undefined;
  /** Query text inside the chip (typed during the play-through). */
  queryText: HTMLElement | null;
  caret: HTMLElement | null;
  ticker: HTMLElement | null;
  /** Funnel numbers, keyed by data-k (results | candidates | evidence | support). */
  cells: () => Map<string, HTMLElement>;
  panelCount: HTMLElement | null;
  steps: () => HTMLElement[];
};
export type CrawlerHooks = {
  reducedMotion: () => boolean;
  onStage: (id: string, stage: CrawlerStage) => void;
  onPlaying: (playing: boolean) => void;
};

type P = { x: number; y: number };
type R = { x: number; y: number; w: number; h: number; cx: number; cy: number };
type RGB = [number, number, number];
type BgNode = { x: number; y: number; p: number; z: number; hub: boolean };
type GNode = P & { k: number; via: BgNode; crawl: P[]; delay: number; side: 1 | -1; leaf?: { dx: number; dy: number } };
type Geo = {
  W: number; H: number; S: R; mob: boolean; chip: R; bar: P; s: number; floorY: number; q: P;
  band: { x0: number; x1: number; y0: number; y1: number };
  cells: Map<string, R>; cards: Map<string, R>; tray: { x: number; y: number; w: number } | null;
  nodes: GNode[]; rest: P;
};

const EM_SCALE = 0.25;
const CRAWL_N = 24;
const EMBER: RGB = [238, 135, 72], MOLTEN: RGB = [255, 122, 42], HOT: RGB = [255, 214, 160], WHITE: RGB = [255, 248, 232];
const GOLD: RGB = [245, 196, 81], STEEL: RGB = [196, 205, 216], ASH: RGB = [122, 115, 109];
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const easeIn = (k: number) => k * k * k;
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const smooth = (k: number) => k * k * (3 - 2 * k);
const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a)})`;
const mixc = (a: RGB, b: RGB, k: number): RGB => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function bez(p: P[], u: number): P {
  const v = 1 - u;
  return { x: v * v * v * p[0].x + 3 * v * v * u * p[1].x + 3 * v * u * u * p[2].x + u * u * u * p[3].x, y: v * v * v * p[0].y + 3 * v * v * u * p[1].y + 3 * v * u * u * p[2].y + u * u * u * p[3].y };
}
/** Samples a cubic into a reusable buffer (no per-frame allocation); returns the buffer trimmed to n + 1 points. */
function samp(p: P[], u0: number, u1: number, n = 36, out: P[] = []): P[] {
  for (let i = 0; i <= n; i += 1) {
    const u = lerp(u0, u1, i / n), a = 1 - u, b0 = a * a * a, b1 = 3 * a * a * u, b2 = 3 * a * u * u, b3 = u * u * u;
    const o = out[i] ?? (out[i] = { x: 0, y: 0 });
    o.x = b0 * p[0].x + b1 * p[1].x + b2 * p[2].x + b3 * p[3].x; o.y = b0 * p[0].y + b1 * p[1].y + b2 * p[2].y + b3 * p[3].y;
  }
  out.length = n + 1;
  return out;
}

// Node placements inside the crawl band (u, v in 0..1); the 4-node set is the approved mockup's.
const PLACES_WIDE: Record<number, number[][]> = {
  1: [[0.45, 0.55]], 2: [[0.3, 0.62], [0.72, 0.5]], 3: [[0.25, 0.66], [0.78, 0.58], [0.55, 0.3]],
  8: [[0.25, 0.66], [0.82, 0.6], [0.6, 0.3], [0.43, 0.6], [0.08, 0.32], [0.94, 0.2], [0.34, 0.16], [0.68, 0.86]],
};
const PLACES_NARROW: Record<number, number[][]> = {
  1: [[0.5, 0.6]], 2: [[0.24, 0.62], [0.76, 0.5]], 3: [[0.2, 0.64], [0.84, 0.56], [0.56, 0.34]],
  8: [[0.19, 0.64], [0.87, 0.58], [0.63, 0.36], [0.41, 0.74], [0.06, 0.3], [0.95, 0.16], [0.3, 0.12], [0.72, 0.9]],
};
const SIDES_WIDE = [1, -1, 1, 1, 1, -1, 1, -1] as const;
const SIDES_NARROW = [-1, -1, 1, 1, 1, -1, 1, -1] as const;
const LEAVES_WIDE = [[-8, 44], [-30, 40], [40, -34], [28, 40]];
const LEAVES_NARROW = [[0, 26], [-14, 24], [18, -22], [14, 24]];
let FONT_MONO = '"Geist Mono","JetBrains Mono",ui-monospace,monospace';
/** next/font exposes Geist Mono under a generated family name: read it so canvas labels use it too. */
function resolveMonoFont() {
  try {
    const family = getComputedStyle(document.documentElement).getPropertyValue('--font-geist-mono').trim();
    if (family) FONT_MONO = `${family},"JetBrains Mono",ui-monospace,monospace`;
  } catch { /* keep the fallback stack */ }
}

export class ForgeCrawlerRenderer {
  private fx: CanvasRenderingContext2D;
  private bg: CanvasRenderingContext2D;
  /** Emissive layer: a quarter-resolution canvas under the crisp fx layer, blended additively by CSS.
   *  It replaces a read-back bloom (drawImage of the fx canvas + ctx.filter blur every frame), which
   *  stalled the main thread on every frame; glows and lines are mirrored into it as they are drawn. */
  private em?: CanvasRenderingContext2D;
  private emCanvas?: HTMLCanvasElement;
  /** Cached background layers: the decorative web graph and two depth layers of dust. */
  private bgGraph?: HTMLCanvasElement;
  private bgDust: HTMLCanvasElement[] = [];
  private grid = new Map<number, BgNode[]>();
  private gridCell = 40;
  private sprites = new Map<number, HTMLCanvasElement>();
  private buf: P[][] = [[], [], [], []];
  private dpr = 1;
  private G?: Geo;
  private BGN: BgNode[] = [];
  private BGE: [number, number][] = [];
  private DUST: { x: number; y: number; z: number; p: number }[] = [];
  private story?: ForgeStory;
  private tl?: StoryTimeline;
  private t = 0;
  private ambient = 0;
  private last = 0;
  private raf = 0;
  private visible = true;
  private onScreen = true;
  private playing = false;
  private stages = new Map<string, CrawlerStage>();
  private domKey = '';
  private replaying = false;

  constructor(private fxCanvas: HTMLCanvasElement, private bgCanvas: HTMLCanvasElement, private el: CrawlerElements, private hooks: CrawlerHooks) {
    const fx = fxCanvas.getContext('2d');
    const bg = bgCanvas.getContext('2d');
    if (!fx || !bg) throw new Error('canvas 2d unavailable');
    this.fx = fx; this.bg = bg;
    if (typeof document !== 'undefined' && fxCanvas.parentElement) {
      const emCanvas = document.createElement('canvas');
      const em = emCanvas.getContext('2d');
      if (em) {
        emCanvas.className = 'forge-live-glow'; emCanvas.setAttribute('aria-hidden', 'true');
        fxCanvas.parentElement.insertBefore(emCanvas, fxCanvas);
        this.emCanvas = emCanvas; this.em = em;
      }
    }
    resolveMonoFont();
  }

  /** New Kernel data. restart = new mission or "Repetir la forja": the play-through starts over. */
  setStory(story: ForgeStory, restart: boolean) {
    const prev = this.story;
    const reachOrder: StoryReach[] = ['idle', 'searching', 'candidates', 'final'];
    const back = prev && reachOrder.indexOf(story.reach) < reachOrder.indexOf(prev.reach);
    this.story = story;
    this.tl = storyTimeline(story);
    if (restart || back || !prev) { this.t = 0; this.stages.clear(); this.replaying = restart; }
    if (this.hooks.reducedMotion()) this.t = this.tl.hold[story.reach];
    this.measure();
    this.kick();
  }

  measure() {
    const { body, stage } = this.el;
    const F = body.getBoundingClientRect();
    if (F.width < 1 || !this.story) return;
    const rel = (node: Element): R => { const r = node.getBoundingClientRect(); return { x: r.left - F.left, y: r.top - F.top, w: r.width, h: r.height, cx: r.left - F.left + r.width / 2, cy: r.top - F.top + r.height / 2 }; };
    const S = rel(stage);
    const mob = S.w < 560 || F.width < 640;
    const cards = new Map<string, R>();
    for (const node of this.story.nodes) { const c = this.el.card(node.id); if (c) cards.set(node.id, rel(c)); }
    const cells = new Map<string, R>();
    for (const [k, v] of this.el.cells()) cells.set(k, rel(v.closest('[data-k]') ?? v));
    let H = body.scrollHeight;
    if (mob) {
      const first = this.story.nodes[0] && cards.get(this.story.nodes[0].id);
      H = Math.min(H, Math.max(S.y + S.h + 120, (first ? first.y + first.h : S.y + S.h) + 24));
    }
    const W = F.width;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    const size = (c: HTMLCanvasElement, w: number, h: number) => {
      const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
      if (c.width !== pw) c.width = pw;
      if (c.height !== ph) c.height = ph;
      c.style.width = `${w}px`; c.style.height = `${h}px`;
    };
    size(this.fxCanvas, W, H);
    size(this.bgCanvas, S.w, S.h);
    this.fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.bg.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.emCanvas && this.em) {
      const k = EM_SCALE * dpr, ew = Math.max(1, Math.round(W * k)), eh = Math.max(1, Math.round(H * k));
      if (this.emCanvas.width !== ew) this.emCanvas.width = ew;
      if (this.emCanvas.height !== eh) this.emCanvas.height = eh;
      this.emCanvas.style.width = `${W}px`; this.emCanvas.style.height = `${H}px`;
      this.em.setTransform(k, 0, 0, k, 0, 0);
    }
    const chip = this.el.chip ? rel(this.el.chip) : { x: S.cx - 60, y: S.y + 20, w: 120, h: 34, cx: S.cx, cy: S.y + 37 };
    const funnel = this.el.funnel ? rel(this.el.funnel) : undefined;
    const s = mob ? 0.62 : clamp(S.w / 790, 0.78, 0.96);
    const floorY = mob || !funnel ? S.y + S.h - 6 : funnel.y - 10;
    const bar = { x: S.cx + (mob ? 0 : 50 * (s / 0.96)), y: floorY - 160 * s };
    const q = { x: chip.cx, y: chip.y + chip.h + (mob ? 36 : 20) };
    const band = mob ? { x0: S.x + 18, x1: S.x + S.w - 18, y0: q.y + 34, y1: bar.y - 52 } : { x0: S.x + 46, x1: S.x + S.w - 46, y0: q.y + 46, y1: bar.y - 92 };
    const sig = `${Math.round(S.x)}:${Math.round(S.y)}:${Math.round(S.w)}:${Math.round(S.h)}:${mob}:${dpr}:${Math.round(bar.y)}`;
    if (sig !== this.bgSig) { this.bgSig = sig; this.buildBackground(S, mob, bar.y); }
    const n = this.story.nodes.length;
    const table = (mob ? PLACES_NARROW : PLACES_WIDE)[n] ?? (mob ? PLACES_NARROW : PLACES_WIDE)[8];
    const nodes: GNode[] = this.story.nodes.map((node, k) => {
      const [u, v] = table[k];
      const x = lerp(band.x0, band.x1, u), y = lerp(band.y0, band.y1, v);
      const mx = lerp(q.x, x, 0.5), my = lerp(q.y, y, 0.45);
      let via = this.BGN[0] ?? { x: mx, y: my, p: 0, z: 1, hub: false }, bd = 1e9;
      for (const b of this.BGN) { const d = (b.x - mx) ** 2 + (b.y - my) ** 2; if (d < bd) { bd = d; via = b; } }
      let side: 1 | -1 = n === 4 || n === 8 ? (mob ? SIDES_NARROW : SIDES_WIDE)[k] : (u > 0.62 ? -1 : 1);
      const w = this.textWidth(node.host, mob ? 10 : 11) + 10;
      if (side > 0 && x + 12 + w > S.x + S.w - 6) side = -1;
      else if (side < 0 && x - 12 - w < S.x + 6) side = 1;
      const hasLeaf = n <= 4 && node.path && node.path !== '/';
      const lf = (mob ? LEAVES_NARROW : LEAVES_WIDE)[k];
      const crawl: P[] = [];
      for (let i = 0; i <= CRAWL_N; i += 1) { const w2 = i / CRAWL_N, a2 = 1 - w2; crawl.push({ x: a2 * a2 * q.x + 2 * a2 * w2 * via.x + w2 * w2 * x, y: a2 * a2 * q.y + 2 * a2 * w2 * via.y + w2 * w2 * y }); }
      return { x, y, k, via, crawl, delay: (Math.abs(x - q.x) / (S.w / 2)) * 0.9 + k * 0.03, side, ...(hasLeaf ? { leaf: { dx: lf[0], dy: lf[1] } } : {}) };
    });
    this.G = {
      W, H, S, mob, chip, bar, s, floorY, q, band, cells, cards, nodes,
      tray: mob ? null : { x: bar.x + 178 * s, y: floorY - 18, w: 92 },
      rest: { x: q.x + (mob ? -120 : -230), y: q.y + (mob ? 8 : 14) },
    };
    this.domKey = '';
    this.draw();
  }
  private bgSig = '';

  setVisibility(visible: boolean) { this.visible = visible; this.kick(); }
  setOnScreen(onScreen: boolean) { this.onScreen = onScreen; this.kick(); }
  destroy() { cancelAnimationFrame(this.raf); this.raf = 0; this.emCanvas?.remove(); }

  private textWidth(text: string, size: number): number {
    this.fx.save(); this.fx.font = `550 ${size}px ${FONT_MONO}`; const w = this.fx.measureText(text).width; this.fx.restore(); return w;
  }

  private buildBackground(S: R, mob: boolean, barY: number) {
    const r = rng(11);
    this.BGN = [];
    const sp = mob ? 27 : 34;
    for (let y = S.y + 8; y < S.y + S.h; y += sp * 0.87) for (let x = S.x + 6; x < S.x + S.w; x += sp) {
      const jx = x + (r() - 0.5) * sp * 0.9 + (Math.round((y - S.y) / (sp * 0.87)) % 2 ? sp / 2 : 0), jy = y + (r() - 0.5) * sp * 0.8;
      if (jx < S.x || jx > S.x + S.w) continue;
      this.BGN.push({ x: jx, y: jy, p: r() * 6.28, z: 0.4 + 0.6 * r(), hub: r() < 0.07 });
    }
    this.BGE = [];
    const N = this.BGN;
    for (let i = 0; i < N.length; i += 1) {
      const a = N[i];
      const near: [number, number][] = [];
      for (let j = i + 1; j < N.length; j += 1) { const d2 = (N[j].x - a.x) ** 2 + (N[j].y - a.y) ** 2; if (d2 < (sp * 1.6) ** 2) near.push([j, d2]); }
      near.sort((u, v) => u[1] - v[1]);
      for (const [j] of near.slice(0, a.hub ? 4 : 2)) this.BGE.push([i, j]);
    }
    const rd = rng(5);
    this.DUST = [];
    const count = Math.round((S.w * S.h) / (mob ? 200 : 280));
    for (let i = 0; i < Math.min(count, mob ? 700 : 1800); i += 1) this.DUST.push({ x: S.x + rd() * S.w, y: S.y + rd() * S.h, z: 0.2 + 0.8 * rd(), p: rd() * 6.28 });
    // spatial grid for nearest-node lookups (spider feet, roam points)
    this.gridCell = sp * 1.2; this.grid.clear();
    for (const n of this.BGN) { const key = this.gridKey(n.x, n.y); const cell = this.grid.get(key); if (cell) cell.push(n); else this.grid.set(key, [n]); }
    // Static layers, drawn once: the decorative graph and two depth layers of dust that scroll.
    const dpr = this.dpr, mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr)); const x = c.getContext('2d'); x?.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, x] as const; };
    const fade = (y: number) => clamp((barY + 20 - y) / 120) * 0.85 + 0.15;
    const [gc, gx] = mk(S.w, S.h);
    if (gx) {
      gx.translate(-S.x, -S.y); gx.lineWidth = 0.6;
      // batch edges by quantised alpha: a handful of strokes instead of one per edge
      const buckets = new Map<number, [BgNode, BgNode][]>();
      for (const [i, j] of this.BGE) { const a = N[i], b = N[j]; const al = Math.round(0.055 * fade((a.y + b.y) / 2) * 400); const list = buckets.get(al); if (list) list.push([a, b]); else buckets.set(al, [[a, b]]); }
      for (const [al, list] of buckets) { gx.strokeStyle = rgba([235, 190, 150], al / 400); gx.beginPath(); for (const [a, b] of list) { gx.moveTo(a.x, a.y); gx.lineTo(b.x, b.y); } gx.stroke(); }
      for (const n of N) { gx.fillStyle = rgba([240, 200, 165], (n.hub ? 0.32 : 0.16) * n.z * fade(n.y)); const r = n.hub ? 1.6 : 1; gx.fillRect(n.x - r / 2, n.y - r / 2, r, r); }
    }
    this.bgGraph = gc;
    this.bgDust = [0, 1].map((layer) => {
      const [dc, dx] = mk(S.w, S.h);
      if (dx) for (const d of this.DUST) {
        if ((d.z >= 0.6 ? 1 : 0) !== layer) continue;
        dx.fillStyle = rgba([210, 190, 175], (0.05 + 0.1 * d.z) * 0.8);
        dx.fillRect(d.x - S.x, d.y - S.y, d.z * 1.1, d.z * 1.1);
      }
      return dc;
    });
  }
  private gridKey(x: number, y: number) { return Math.floor(x / this.gridCell) * 4096 + Math.floor(y / this.gridCell); }

  // ------------------------------------------------------------------ loop
  private kick() {
    if (!this.story) return;
    if (this.hooks.reducedMotion()) {
      cancelAnimationFrame(this.raf); this.raf = 0;
      if (this.tl) this.t = this.tl.hold[this.story.reach];
      this.setPlaying(false);
      this.draw();
      return;
    }
    if (this.visible && !this.onScreen && this.tl && this.t > 0 && this.t < this.tl.hold[this.story.reach]) {
      // Scrolled away mid play-through (e.g. reading the cards on a phone): settle on the real
      // verdicts at once instead of freezing half-way, so the cards and the replay control are final.
      cancelAnimationFrame(this.raf); this.raf = 0;
      this.t = this.tl.hold[this.story.reach];
      this.setPlaying(false);
      this.draw();
      return;
    }
    if (!this.visible || !this.onScreen) { cancelAnimationFrame(this.raf); this.raf = 0; return; }
    if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.frame); }
  }

  private frame = (now: number) => {
    this.raf = 0;
    if (!this.story || !this.tl) return;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    const hold = this.tl.hold[this.story.reach];
    const atHold = this.t >= hold;
    // At a hold the forge only breathes. It keeps the display rate while frames are cheap and drops to
    // ~30 fps on a device where a frame costs more than a third of a 60 Hz budget.
    if (atHold && this.costMs > 5.5 && this.last && now - this.last < 30) { this.raf = requestAnimationFrame(this.frame); return; }
    this.last = now;
    this.ambient += dt;
    if (this.t < hold) this.t = Math.min(hold, this.t + dt);
    this.setPlaying(this.t < hold);
    const c0 = performance.now();
    this.animating = true;
    this.draw();
    this.animating = false;
    this.noteCost(performance.now() - c0);
    if (this.visible && this.onScreen && !this.hooks.reducedMotion()) this.raf = requestAnimationFrame(this.frame);
  };

  /** Exponential average of the main-thread cost of one frame (ms), exposed for profiling. */
  private costMs = 0;
  private animating = false;
  private bgTick = 0;
  private costFrames = 0;
  private noteCost(ms: number) {
    this.costMs = this.costFrames ? this.costMs * 0.92 + ms * 0.08 : ms;
    this.costFrames += 1;
    if (this.costFrames % 30 === 0) this.fxCanvas.dataset.frameMs = this.costMs.toFixed(2);
  }

  private setPlaying(value: boolean) {
    if (value === this.playing) return;
    this.playing = value;
    if (!value) this.replaying = false;
    this.hooks.onPlaying(value);
  }

  // ------------------------------------------------------------------ frame
  private draw() {
    const G = this.G, story = this.story, T = this.tl;
    if (!G || !story || !T) return;
    const t = this.t, A = this.ambient, fx = this.fx, bg = this.bg, mob = G.mob, S = G.S, q = G.q;
    const reach = story.reach;
    const holdSearch = reach === 'searching' && t >= T.hold.searching - 0.01;

    // ======== background: dust + decorative web graph (never counted)
    // The background drifts at a few px/s: repainting it every third frame is invisible and saves a
    // canvas upload per frame. The scan pulse (fast) and any static redraw always repaint it.
    let scanR = clamp((t - T.crawl0) / 2.2) * Math.hypot(S.w, S.h) * 0.9;
    let scanA = t > T.crawl0 ? 1 - clamp((t - T.crawl0 - 1.8) / 1.2) : 0;
    if (holdSearch) { const ph = (A % 3.2) / 3.2; scanR = ph * Math.hypot(S.w, S.h) * 0.9; scanA = 1 - clamp((ph - 0.6) / 0.4); }
    this.bgTick = (this.bgTick + 1) % 3;
    if (!this.animating || scanA > 0.004 || this.bgTick === 0) {
    bg.clearRect(0, 0, S.w, S.h);
    // dust: two cached depth layers drifting up at their own speed (wrapping), with a slow sway and shimmer
    this.bgDust.forEach((layer, i) => {
      const speed = i ? 2.4 : 1.2, off = (A * speed) % S.h, sway = Math.sin(A * (i ? 0.17 : 0.11) + i) * (i ? 3 : 2);
      bg.globalAlpha = 0.8 + 0.2 * Math.sin(A * (i ? 1.3 : 0.9) + i * 2);
      bg.drawImage(layer, sway, -off, S.w, S.h); bg.drawImage(layer, sway, S.h - off, S.w, S.h);
    });
    bg.globalAlpha = 0.92 + 0.08 * Math.sin(A * 0.6);
    if (this.bgGraph) bg.drawImage(this.bgGraph, 0, 0, S.w, S.h);
    bg.globalAlpha = 1;
    bg.save(); bg.translate(-S.x, -S.y);
    // scan pulse: once when the crawl starts; it repeats while Hermes is still searching
    // scan pulse: only the edges inside the moving ring are drawn live, batched by alpha
    if (scanA > 0.004) {
      bg.lineWidth = 0.6;
      const N = this.BGN, levels: number[] = [];
      for (const [i, j] of this.BGE) {
        const a = N[i], b = N[j], d = Math.hypot((a.x + b.x) / 2 - q.x, (a.y + b.y) / 2 - q.y) - scanR;
        if (d < -100 || d > 100) continue;
        const al = 0.22 * Math.exp(-((d / 40) ** 2)) * scanA; if (al < 0.01) continue;
        levels.push(Math.min(15, Math.round(al * 60)), i, j);
      }
      for (let lv = 1; lv <= 15; lv += 1) {
        let any = false;
        for (let m = 0; m < levels.length; m += 3) { if (levels[m] !== lv) continue; if (!any) { bg.beginPath(); any = true; } const a = N[levels[m + 1]], b = N[levels[m + 2]]; bg.moveTo(a.x, a.y); bg.lineTo(b.x, b.y); }
        if (any) { bg.strokeStyle = rgba([235, 190, 150], lv / 60); bg.stroke(); }
      }
    }
    bg.restore();
    }

    // ======== fx
    fx.clearRect(0, 0, G.W, G.H);
    if (this.em) this.em.clearRect(0, 0, G.W, G.H);
    fx.save();
    const qOn = clamp((t - T.q0 + 0.2) / 0.5);
    this.glow(q.x, q.y, (mob ? 26 : 38) * (1 + 0.08 * Math.sin(A * 3)), MOLTEN, 0.55 * qOn);
    fx.fillStyle = rgba(WHITE, qOn); fx.beginPath(); fx.arc(q.x, q.y, mob ? 3 : 3.8, 0, 7); fx.fill();
    fx.strokeStyle = rgba(EMBER, 0.6 * qOn); fx.lineWidth = 1; fx.beginPath(); fx.arc(q.x, q.y, (mob ? 8 : 11) + 2 * Math.sin(A * 2), 0, 7); fx.stroke();
    this.line([{ x: q.x, y: G.chip.y + G.chip.h }, { x: q.x, y: q.y - 4 }], EMBER, 0.5 * qOn, 1);

    const nodes = G.nodes, sn = story.nodes, n = nodes.length;
    const pickEnd = n ? T.pick[n - 1] : T.spider0;
    // crawl edges from the query to each real candidate through one decorative index node
    for (const r of nodes) {
      const t0 = T.crawl0 + r.delay, u = clamp((t - t0) / 0.75);
      if (u <= 0) continue;
      const picked = t > T.pick[r.k];
      const v = r.via, shownN = Math.max(2, Math.round(u * CRAWL_N) + 1);
      this.line(r.crawl, EMBER, 0.55 * (picked ? 0.45 : 1), 1.1, 3, shownN);
      if (u < 1) { const h = r.crawl[shownN - 1]; this.glow(h.x, h.y, 10, HOT, 0.9); fx.fillStyle = rgba(WHITE, 1); fx.fillRect(h.x - 1.2, h.y - 1.2, 2.4, 2.4); }
      const vb = Math.exp(-(((u - 0.5) / 0.12) ** 2)); if (vb > 0.02) this.glow(v.x, v.y, 8, EMBER, 0.7 * vb);
    }
    // candidate nodes
    for (const r of nodes) {
      const t0 = T.crawl0 + r.delay + 0.75, on = clamp((t - t0) / 0.25);
      if (on <= 0) continue;
      const tag = clamp((t - T.pick[r.k]) / 0.3);
      if (t > T.pull[r.k] + 0.05) { this.glow(r.x, r.y, 6, ASH, 0.5); fx.fillStyle = rgba([120, 110, 100], 0.7); fx.beginPath(); fx.arc(r.x, r.y, 1.6, 0, 7); fx.fill(); continue; }
      const pulse = 1 + 0.2 * Math.sin(A * 5 + r.k);
      this.glow(r.x, r.y, (tag ? 20 : 11) * pulse, tag ? HOT : EMBER, (0.7 + 0.3 * tag) * on);
      fx.fillStyle = rgba(WHITE, on); fx.beginPath(); fx.arc(r.x, r.y, tag ? 2.8 : 1.8, 0, 7); fx.fill();
      if (tag) { fx.strokeStyle = rgba(GOLD, 0.8 * tag); fx.lineWidth = 1; fx.beginPath(); fx.arc(r.x, r.y, 7 + 5 * (1 - tag), 0, 7); fx.stroke(); }
    }
    // page leaves: the real page path of the candidate
    for (const r of nodes) {
      if (!r.leaf) continue;
      const a = clamp((t - T.pick[r.k] - 0.2) / 0.4) * (t > T.pull[r.k] ? 1 - clamp((t - T.pull[r.k]) / 0.3) : 1);
      if (a <= 0) continue;
      const lx = r.x + r.leaf.dx, ly = r.y + r.leaf.dy;
      this.line([{ x: r.x, y: r.y }, { x: lx, y: ly }], HOT, 0.6 * a, 0.8, 3);
      this.glow(lx, ly, 7, HOT, 0.7 * a); fx.fillStyle = rgba(WHITE, a); fx.fillRect(lx - 1.2, ly - 1.2, 2.4, 2.4);
    }
    // the spider (Hermes' crawler)
    const spider = this.spiderAt(t, holdSearch);
    if (spider) this.drawSpider(spider.p, spider.a, spider.walk);

    // pull: the candidate falls as a spark into the anvil
    let heat = 0.22 + 0.05 * Math.sin(A * 2.3);
    for (const r of nodes) {
      const k = r.k, p = this.pullPath(r), g0 = T.pull[k] - 0.3, land = T.pull[k] + 0.85;
      const ga = clamp((t - g0) / 0.3) * (1 - clamp((t - land - 0.2) / 0.6));
      if (ga > 0) this.line(samp(p, 0, clamp((t - g0) / 0.35), 30, this.buf[0]), EMBER, 0.28 * ga, 0.8, 2);
      if (t > T.pull[k] && t < land + 0.02) {
        const u = easeIn(clamp((t - T.pull[k]) / 0.85)) * 0.82 + clamp((t - T.pull[k]) / 0.85) * 0.18;
        const trail = samp(p, u, Math.max(0, u - 13 * 0.022), 13, this.buf[1]);
        this.line(trail, HOT, 0.8, 1.6, 8);
        const h = trail[0]; this.glow(h.x, h.y, mob ? 18 : 24, HOT, 1); fx.fillStyle = '#fffaf0'; fx.beginPath(); fx.arc(h.x, h.y, 2.4, 0, 7); fx.fill();
      }
      if (t > land) heat += 0.6 * Math.exp(-(t - land) / 0.6);
    }
    for (let k = 0; k < n; k += 1) if (sn[k].outcome !== 'pending' && t > T.read[k]) heat += 0.3 * Math.exp(-(t - T.read[k]) / 0.5);
    // Kernel verifying the batch: the anvil stays hot and breathes (no per-page claim)
    if (reach === 'candidates' && t >= T.hold.candidates - 0.01) heat += 0.18 + 0.14 * Math.sin(A * 2.2);
    const strikes = T.strike;
    const lastStrike = strikes.length ? strikes[strikes.length - 1] : Infinity;
    let strikeK = 0;
    for (const st of strikes) if (t > st) strikeK = Math.max(strikeK, Math.exp(-(t - st) / 0.3));
    const goldOn = strikes.length > 0 && t > strikes[0];
    if (goldOn) heat += 0.2;
    heat = clamp(heat, 0, 1.4);
    this.drawAnvil(heat, goldOn, strikeK);

    // landing pops
    for (const r of nodes) {
      const d = t - (T.pull[r.k] + 0.85); if (d < 0 || d > 0.7) continue;
      const rr = rng(40 + r.k);
      for (let i = 0; i < 16; i += 1) {
        const an = -Math.PI * (0.08 + 0.84 * rr()), sp = (70 + 120 * rr()) * (mob ? 0.7 : 1);
        const e = (1 - Math.exp(-3 * d)) / 3, x = G.bar.x + Math.cos(an) * sp * e * 3, y = G.bar.y + Math.sin(an) * sp * e * 3 + 260 * d * d;
        this.line([{ x, y }, { x: x - Math.cos(an) * 5, y: y - Math.sin(an) * 5 + 4 * d }], HOT, 1 - d / 0.7, 1.1);
      }
    }

    // Kernel reads: molten threads to the cards (Evidence), ash for the unread ones
    let ashIndex = 0;
    let supIndex = 0;
    for (let k = 0; k < n; k += 1) {
      const node = sn[k], st = T.read[k];
      if (node.outcome === 'pending') continue;
      if (node.outcome === 'unread') { const j = ashIndex++; if (t < st) continue; this.drawAsh(k, j, t, st); continue; }
      const sj = node.outcome === 'support' ? supIndex++ : -1;
      if (t < st) continue;
      const p = this.readPath(node, k, sj);
      if (!p) continue;
      const u = easeOut(clamp((t - st) / 0.9));
      const strikeAt = sj >= 0 ? strikes[sj] : Infinity;
      const toGold = sj >= 0 ? clamp((t - strikeAt) / 0.6) : 0;
      const cool = node.outcome !== 'support' ? clamp((t - T.verdict - 0.5) / 1.2) : 0;
      const col = toGold ? mixc(MOLTEN, GOLD, toGold) : mixc(MOLTEN, STEEL, cool * 0.8);
      const pts = samp(p, 0, u, 48, this.buf[2]);
      this.molten(pts, col, (1 - cool * 0.45) * (0.9 + 0.1 * Math.sin(A * 7 + k)), mob ? 1 : 1.3);
      for (let j = 0; j < 3; j += 1) { const w = ((A * 0.55 + j / 3 + k * 0.2) % 1) * u; const pp = bez(p, w); this.glow(pp.x, pp.y, 7, toGold ? GOLD : HOT, 0.5 - cool * 0.35); }
      const h = pts[pts.length - 1]; this.glow(h.x, h.y, 14 + 6 * toGold, toGold ? GOLD : HOT, 0.95); fx.fillStyle = '#fffaf0'; fx.beginPath(); fx.arc(h.x, h.y, 2.2, 0, 7); fx.fill();
    }

    // hammer + strike per Kernel SUPPORT
    if (strikes.length) this.drawHammer(t, strikes);
    for (const st of strikes) {
      if (t <= st || t >= st + 0.9) continue;
      const u = (t - st) / 0.9, R = (14 + 460 * easeOut(u)) * G.s;
      fx.save(); fx.globalCompositeOperation = 'lighter'; fx.translate(G.bar.x, G.bar.y + 6 * G.s); fx.scale(1, 0.3);
      fx.strokeStyle = rgba([255, 232, 180], 0.65 * (1 - u) ** 1.6); fx.lineWidth = 1.5 + 4 * (1 - u); fx.beginPath(); fx.arc(0, 0, R, 0, 7); fx.stroke(); fx.restore();
      if (u < 0.25) this.glow(G.bar.x, G.bar.y - 2, 110 * G.s * (1 - u * 2), WHITE, 0.9 * (1 - u / 0.25));
      const rr = rng(9); fx.save(); fx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 70; i += 1) {
        const an = -Math.PI * (0.02 + 0.96 * rr()), sp = (160 + 380 * rr()) * G.s, life = 0.5 + 0.5 * rr(); const d = t - st; if (d > life) continue;
        const e = (1 - Math.exp(-2.3 * d)) / 2.3, x = G.bar.x + Math.cos(an) * sp * e, y = G.bar.y - 4 + Math.sin(an) * sp * e + 450 * d * d * G.s;
        const e2 = (1 - Math.exp(-2.3 * Math.max(0, d - 0.03))) / 2.3, x2 = G.bar.x + Math.cos(an) * sp * e2, y2 = G.bar.y - 4 + Math.sin(an) * sp * e2 + 450 * (d - 0.03) ** 2 * G.s;
        const c = d / life < 0.35 ? WHITE : d / life < 0.7 ? GOLD : MOLTEN; fx.strokeStyle = rgba(c, 0.95 * (1 - d / life)); fx.lineWidth = 1.3; fx.beginPath(); fx.moveTo(x, y); fx.lineTo(x2, y2); fx.stroke();
      }
      fx.restore();
    }
    // ingots: one per SUPPORT, into the tray (desktop) or into the Find card (phone)
    if (G.tray && strikes.length && t > strikes[0] + 0.08) {
      const tr = G.tray, m = clamp((t - strikes[0] - 0.68) / 0.7);
      fx.save(); let g = fx.createLinearGradient(0, tr.y, 0, tr.y + 8); g.addColorStop(0, '#3a332d'); g.addColorStop(1, '#221d1a');
      fx.fillStyle = g; fx.beginPath(); fx.moveTo(tr.x + 8, tr.y + 4); fx.lineTo(tr.x + tr.w - 8, tr.y + 4); fx.lineTo(tr.x + tr.w, tr.y + 12); fx.lineTo(tr.x, tr.y + 12); fx.closePath(); fx.fill();
      g = fx.createLinearGradient(tr.x, 0, tr.x + tr.w, 0); g.addColorStop(0, 'rgba(245,196,81,0)'); g.addColorStop(0.5, rgba(GOLD, 0.3 + 0.6 * m)); g.addColorStop(1, 'rgba(245,196,81,0)'); fx.fillStyle = g; fx.fillRect(tr.x, tr.y + 12, tr.w, 1); fx.restore();
    }
    strikes.forEach((st, j) => {
      if (t <= st + 0.08) return;
      const tau = t - st - 0.08, heatI = 1 - clamp((tau - 0.05) / 0.7), sc = tau < 0.25 ? 0.55 + 0.45 * easeOut(tau / 0.25) : 1;
      let x = G.bar.x, y = G.bar.y - 5 * G.s, w = mob ? 30 : 46, al = clamp(tau / 0.1);
      const mm = clamp((tau - 0.6) / 0.7), e = easeInOut(mm);
      if (G.tray) {
        const count = strikes.length, iw = count > 2 ? 34 : 46, gap = iw * 0.5;
        const tx = G.tray.x + G.tray.w / 2 + (j - (count - 1) / 2) * gap;
        x = lerp(x, tx, e); y = lerp(y, G.tray.y + 2 - (count > 2 ? 0 : 0), e) - Math.sin(Math.PI * e) * 46; w = lerp(w, iw, e);
      } else {
        const sid = sn[T.strikeNode[j]]?.id;
        const card = sid ? G.cards.get(sid) : undefined;
        const target = j === 0 && card ? { x: G.W / 2, y: card.y + 14 } : (G.cells.get('support') ? { x: G.cells.get('support')!.cx, y: G.cells.get('support')!.y + 8 } : { x: G.W / 2, y: G.floorY });
        x = lerp(x, target.x, e); y = lerp(y, target.y, e) - Math.sin(Math.PI * e) * 26; w = lerp(w, 22, e); al *= 1 - clamp((tau - 1.25) / 0.25);
      }
      if (al > 0) this.ingot(x, y, w, heatI, sc, al);
      if (tau < 1.8) {
        fx.save(); fx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 12; i += 1) {
          const tt = tau - i * 0.03; if (tt < 0 || tt > 1.5) continue; const k2 = tt / 1.5;
          const px = G.bar.x + (i - 6) * 3 * easeOut(k2) * G.s * 4 + Math.sin(i * 2.1 + tt * 2) * 9 * k2, py = G.bar.y - easeOut(k2) * 90 * G.s; const rr = (6 + 26 * k2) * G.s * 1.4;
          this.puff(px, py, rr, 0.18 * (1 - k2) ** 1.4);
        }
        fx.restore();
      }
    });
    // embers rising around the anvil (atmosphere)
    {
      const rr = rng(3);
      for (let i = 0; i < (mob ? 26 : 46); i += 1) {
        const per = 2.2 + rr() * 2.6, ph = rr() * per, ox = (rr() - 0.5) * (mob ? 200 : 420) * G.s, u = ((A + ph) % per) / per;
        const x = G.bar.x + ox + Math.sin(u * 6 + i) * 10, y = G.bar.y - u * (mob ? 150 : 260) * G.s * (0.7 + rr() * 0.6);
        const a = Math.sin(u * Math.PI) * (0.35 + 0.4 * heat) * (0.5 + rr() * 0.5);
        fx.fillStyle = rgba(rr() < 0.5 ? HOT : MOLTEN, a); fx.fillRect(x, y, 1.6, 1.6);
      }
    }
    fx.restore();

    // crisp labels after bloom
    fx.save();
    for (const r of nodes) {
      const a = clamp((t - T.pick[r.k] - 0.1) / 0.3) * (1 - clamp((t - T.pull[r.k]) / 0.25));
      this.label(sn[r.k].host, r.x + r.side * 12, r.y, a, { align: r.side > 0 ? 'left' : 'right', ring: GOLD });
    }
    if (!mob) for (const r of nodes) {
      if (!r.leaf) continue;
      const a = 0.85 * clamp((t - T.pick[r.k] - 0.35) / 0.4) * (1 - clamp((t - T.pull[r.k]) / 0.25));
      const x = r.x + r.leaf.dx + 9;
      this.label(this.fit(sn[r.k].path, 10, S.x + S.w - 12 - x), x, r.y + r.leaf.dy, a, { align: 'left', size: 10, col: [170, 158, 146] });
    }
    if (spider && spider.tag > 0) this.label('hermes · crawler', spider.p.x, spider.p.y - (mob ? 20 : 26), spider.tag * 0.9, { align: 'center', size: mob ? 9 : 10, col: [245, 205, 130] });
    let aj = 0;
    for (let k = 0; k < n; k += 1) {
      const node = sn[k]; if (node.outcome !== 'unread') continue;
      const j = aj++, st = T.read[k]; if (t < st + 0.45) continue;
      const end = this.ashEnd(j, node);
      const text = `no leída · ${node.code ?? 'ERROR'}`;
      const a = clamp((t - st - 0.45) / 0.3) * 0.95;
      if (end.labelSide > 0) this.label(text, end.x + 8, end.y, a, { size: mob ? 9.5 : 10.5, col: [205, 150, 136] });
      else this.label(text, end.x - 8, end.y, a, { size: mob ? 9.5 : 10.5, col: [205, 150, 136], align: 'right' });
    }
    if (G.tray && strikes.length && t > lastStrike + 1.4) {
      const c = strikes.length;
      this.label(`${c} ${c === 1 ? 'FIND' : 'FINDS'}`, G.tray.x + G.tray.w / 2, G.tray.y + 26, clamp((t - lastStrike - 1.4) / 0.4) * 0.9, { align: 'center', size: 10, col: [245, 205, 120], weight: 700 });
    }
    fx.restore();

    this.updateDom();
  }

  // ------------------------------------------------------------------ spider
  private spiderAt(t: number, holdSearch: boolean): { p: P & { dx: number; dy: number }; a: number; tag: number; walk: number } | undefined {
    const G = this.G!, T = this.tl!;
    if (holdSearch) {
      // still searching: the crawler roams the decorative index around the query (no node is real yet)
      const pts = this.roamPoints();
      const A = this.ambient, seg = 1.3, i = Math.floor(A / seg), u = easeInOut(clamp((A % seg) / seg));
      const a = pts[i % pts.length], b = pts[(i + 1) % pts.length];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, bow = Math.sin(u * Math.PI) * (G.mob ? 10 : 18);
      return { p: { x: lerp(a.x, b.x, u) - (dy / len) * bow, y: lerp(a.y, b.y, u) + (dx / len) * bow, dx: dx / len, dy: dy / len }, a: 1, tag: 1, walk: A };
    }
    const n = G.nodes.length;
    const pickEnd = n ? T.pick[n - 1] : T.spider0;
    const a = clamp((t - T.spider0 + 0.3) / 0.4) * (1 - clamp((t - (pickEnd + 1.6)) / 0.9));
    if (a <= 0.01) return undefined;
    const tag = clamp((t - T.spider0) / 0.4) * (1 - clamp((t - (pickEnd + 1.4)) / 0.6));
    return { p: this.spiderPos(t), a, tag, walk: t };
  }
  private roamCache?: { key: string; pts: P[] };
  private roamPoints(): P[] {
    const G = this.G!;
    const key = `${G.q.x}:${G.q.y}:${this.BGN.length}`;
    if (this.roamCache?.key === key) return this.roamCache.pts;
    const { band, q } = G;
    const targets = [[0.3, 0.25], [0.62, 0.45], [0.45, 0.7], [0.2, 0.55], [0.75, 0.2], [0.55, 0.12]].map(([u, v]) => ({ x: lerp(band.x0, band.x1, u), y: lerp(band.y0, band.y1, v) }));
    const pts = [q, ...targets.map((p) => this.nearestNode(p.x, p.y, 60) ?? p)];
    this.roamCache = { key, pts };
    return pts;
  }
  private spiderPos(t: number): P & { dx: number; dy: number } {
    const G = this.G!, T = this.tl!;
    const st: P[] = [G.q, ...G.nodes, G.rest];
    const n = G.nodes.length;
    const times = [T.spider0, ...T.pick, (n ? T.pick[n - 1] : T.spider0) + 0.9];
    if (t <= times[0]) return { ...st[0], dx: 0, dy: 1 };
    for (let i = 1; i < times.length; i += 1) {
      if (t <= times[i]) {
        const a = st[i - 1], b = st[i], u = easeInOut(clamp((t - times[i - 1]) / (times[i] - times[i - 1])));
        const bow = Math.sin(u * Math.PI) * (G.mob ? 14 : 26) * (i % 2 ? 1 : -1);
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        return { x: lerp(a.x, b.x, u) - (dy / len) * bow, y: lerp(a.y, b.y, u) + (dx / len) * bow, dx: dx / len, dy: dy / len };
      }
    }
    const e = st[st.length - 1]; return { x: e.x, y: e.y, dx: -1, dy: 0 };
  }
  private nearestNode(px: number, py: number, maxD: number): P | undefined {
    let best: P | undefined, bd = maxD * maxD;
    const c = this.gridCell, r = Math.ceil(maxD / c), cx = Math.floor(px / c), cy = Math.floor(py / c);
    for (let gx = cx - r; gx <= cx + r; gx += 1) for (let gy = cy - r; gy <= cy + r; gy += 1) {
      const cell = this.grid.get(gx * 4096 + gy); if (!cell) continue;
      for (const n of cell) { const d = (n.x - px) ** 2 + (n.y - py) ** 2; if (d < bd) { bd = d; best = n; } }
    }
    return best;
  }
  private drawSpider(p: P & { dx: number; dy: number }, a: number, walk: number) {
    const G = this.G!, fx = this.fx, mob = G.mob;
    const L = mob ? 22 : 32, ang = Math.atan2(p.dy, p.dx);
    const pos = (tt: number) => (this.story?.reach === 'searching' && this.t >= (this.tl?.hold.searching ?? 0) - 0.01 ? this.spiderAt(0, true)!.p : this.spiderPos(tt));
    for (let i = 0; i < 8; i += 1) {
      const side = i < 4 ? 1 : -1, k = i % 4, la = ang + side * (0.55 + k * 0.55);
      const phase = (i % 2) * 0.09, stepT = Math.floor((walk + phase) / 0.18) * 0.18 - phase, lift = clamp((walk - stepT) / 0.07);
      const footAt = (tt: number) => { const qq = tt === walk ? p : pos(tt); const ix = qq.x + Math.cos(la) * L * 1.15, iy = qq.y + Math.sin(la) * L * 1.15; return this.nearestNode(ix, iy, L * 1.1) ?? { x: ix, y: iy }; };
      const f0 = footAt(stepT - 0.18), f1 = footAt(stepT);
      const fxp = lerp(f0.x, f1.x, smooth(lift)), fyp = lerp(f0.y, f1.y, smooth(lift)) - Math.sin(lift * Math.PI) * 4;
      const mx = (p.x + fxp) / 2, my = (p.y + fyp) / 2, nx = -(fyp - p.y), ny = fxp - p.x, nl = Math.hypot(nx, ny) || 1;
      const kx = mx + (nx / nl) * L * 0.32 * side * -1, ky = my + (ny / nl) * L * 0.32 * side * -1 - L * 0.12;
      this.line([{ x: p.x, y: p.y }, { x: kx, y: ky }, { x: fxp, y: fyp }], [255, 170, 100], 0.75 * a, mob ? 1 : 1.2, 4);
      this.glow(fxp, fyp, 5, HOT, 0.7 * a); fx.fillStyle = rgba(WHITE, 0.9 * a); fx.fillRect(fxp - 1, fyp - 1, 2, 2);
      fx.fillStyle = rgba([255, 190, 130], 0.8 * a); fx.beginPath(); fx.arc(kx, ky, 1.3, 0, 7); fx.fill();
    }
    this.glow(p.x, p.y, mob ? 22 : 30, GOLD, 0.75 * a);
    fx.save(); fx.globalAlpha = a; fx.fillStyle = '#fff4dc'; fx.beginPath(); fx.arc(p.x, p.y, mob ? 3.6 : 4.6, 0, 7); fx.fill();
    fx.strokeStyle = rgba(GOLD, 0.9); fx.lineWidth = 1.2; fx.beginPath(); fx.arc(p.x, p.y, (mob ? 7 : 9) + Math.sin(this.ambient * 9) * 0.8, 0, 7); fx.stroke();
    fx.fillStyle = rgba(GOLD, 1); fx.beginPath(); fx.arc(p.x + p.dx * (mob ? 6 : 8), p.y + p.dy * (mob ? 6 : 8), 1.8, 0, 7); fx.fill(); fx.restore();
  }

  // ------------------------------------------------------------------ paths
  private pullPath(r: GNode): P[] {
    const G = this.G!, b = G.bar, s = G.s, n = G.nodes.length;
    const end = { x: b.x + (r.k - (n - 1) / 2) * (n > 4 ? 10 : 18) * s, y: b.y - 4 };
    return [{ x: r.x, y: r.y }, { x: r.x, y: lerp(r.y, b.y, 0.55) }, { x: lerp(end.x, r.x, 0.2), y: end.y - (G.mob ? 44 : 80) }, end];
  }
  private readPath(node: StoryNode, k: number, supportIndex: number): P[] | undefined {
    const G = this.G!, b = G.bar, s = G.s;
    if (G.mob) {
      const card = G.cards.get(node.id);
      if (supportIndex === 0 && card) { const end = { x: G.W / 2, y: card.y + 1 }, p0 = { x: b.x + 6 * s, y: b.y + 3 }; return [p0, { x: p0.x + 4, y: p0.y + 60 }, { x: end.x, y: end.y - 70 }, end]; }
      const cell = G.cells.get(supportIndex >= 0 ? 'support' : 'evidence');
      if (!cell) return undefined;
      const end = { x: cell.cx + 8 + (k % 3) * 4, y: cell.y + 4 }, p0 = { x: b.x + 22 * s, y: b.y + 2 };
      return [p0, { x: p0.x + 34, y: p0.y + 30 }, { x: end.x + 20, y: end.y - 60 }, end];
    }
    const c = G.cards.get(node.id);
    if (!c || c.y + 20 > G.H) return undefined;
    const end = { x: c.x - 3, y: c.y + Math.min(32, c.h / 2) }, p0 = { x: b.x + 52 * s, y: b.y - 1 };
    return [p0, { x: p0.x + 150, y: p0.y - Math.max(90, (p0.y - end.y) * 0.8) }, { x: end.x - 170, y: end.y }, end];
  }
  private ashEnd(j: number, node: StoryNode): P & { labelSide: 1 | -1 } {
    const G = this.G!, b = G.bar, S = G.S;
    if (G.mob) {
      if (j < 2) return { x: S.x + 26, y: b.y + (j === 0 ? 44 : 76), labelSide: 1 };
      return { x: S.x + S.w - 26, y: b.y + (j === 2 ? 44 : 76), labelSide: -1 };
    }
    // desktop: stacked above the horn, left of the anvil, clear of the forge.log box
    const lw = this.textWidth(`no leída · ${node.code ?? 'ERROR'}`, 10.5) + 10;
    const x = clamp(b.x - 215 * G.s, S.x + 24 + lw, b.x - 90 * G.s);
    return { x, y: b.y - 26 - 30 * j, labelSide: -1 };
  }
  private drawAsh(k: number, j: number, t: number, st: number) {
    const G = this.G!, b = G.bar, s = G.s, mob = G.mob, fx = this.fx;
    const node = this.story!.nodes[k];
    const end = this.ashEnd(j, node);
    const p0 = { x: b.x - 50 * s, y: b.y - 2 };
    const p = [p0, { x: p0.x - (mob ? 30 : 70), y: p0.y - (mob ? 50 : 110) }, { x: end.x + (mob ? 30 : 60) * (end.x < p0.x ? 1 : -1), y: end.y - (mob ? 60 : 90) }, end];
    const u = easeOut(clamp((t - st) / 0.8)), h = bez(p, u), cool = clamp((t - st - 0.35) / 0.5);
    this.line(samp(p, Math.max(0, u - 0.2), u, 14, this.buf[3]), mixc(HOT, ASH, cool), 0.6 * (1 - clamp((t - st - 0.9) / 0.6)), 1, 4);
    this.glow(h.x, h.y, 9, mixc(HOT, ASH, cool), 0.8 * (1 - cool * 0.6));
    const d = t - st - 0.8;
    if (d > 0 && d < 2.2) { const r = rng(70 + k); for (let i = 0; i < 18; i += 1) { const vx = (r() - 0.5) * 30, vy = -10 - r() * 18; const x = h.x + vx * d, y = h.y + vy * d + 22 * d * d; fx.fillStyle = rgba(ASH, (1 - clamp(d / 2.2)) * 0.7); fx.fillRect(x, y, 1.6, 1.6); } }
    fx.fillStyle = rgba([150, 140, 130], 0.9 * cool); fx.beginPath(); fx.arc(end.x, end.y, 2, 0, 7); fx.fill();
  }

  // ------------------------------------------------------------------ primitives
  /** Radial glow sprite per (quantised) colour, drawn with globalAlpha: no gradient object per glow. */
  private sprite(c: RGB, soft = false): HTMLCanvasElement | undefined {
    const key = ((c[0] >> 3) << 12) | ((c[1] >> 3) << 6) | (c[2] >> 3) | (soft ? 1 << 20 : 0);
    let sp = this.sprites.get(key);
    if (sp) return sp;
    if (typeof document === 'undefined') return undefined;
    if (this.sprites.size > 64) this.sprites.clear();
    sp = document.createElement('canvas'); sp.width = sp.height = 64;
    const x = sp.getContext('2d'); if (!x) return undefined;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (soft) { g.addColorStop(0, rgba(c, 1)); g.addColorStop(1, rgba(c, 0)); } else { g.addColorStop(0, rgba(c, 1)); g.addColorStop(0.3, rgba(c, 0.4)); g.addColorStop(1, rgba(c, 0)); }
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    this.sprites.set(key, sp);
    return sp;
  }
  private glow(x: number, y: number, r: number, c: RGB, a: number, emissive = 0.4) {
    if (a <= 0.004 || r <= 0) return;
    const sp = this.sprite(c);
    if (!sp) return;
    const fx = this.fx, ga = fx.globalAlpha;
    fx.globalAlpha = ga * clamp(a); fx.drawImage(sp, x - r, y - r, r * 2, r * 2); fx.globalAlpha = ga;
    const em = this.em;
    if (em && emissive > 0) { const R = r * 1.8; em.globalAlpha = clamp(a * emissive); em.drawImage(sp, x - R, y - R, R * 2, R * 2); em.globalAlpha = 1; }
  }
  private puff(x: number, y: number, r: number, a: number) {
    const sp = this.sprite([236, 232, 228], true);
    if (!sp || a <= 0.004) return;
    const fx = this.fx, ga = fx.globalAlpha; fx.globalAlpha = ga * a; fx.drawImage(sp, x - r, y - r, r * 2, r * 2); fx.globalAlpha = ga;
  }
  /** Crisp stroke on the fx layer; its halo (formerly shadowBlur, a per-stroke blur) goes to the emissive layer. */
  private line(pts: P[], c: RGB, a: number, w: number, blur = 0, count = pts.length) {
    if (count < 2 || a <= 0.004) return;
    const trace = (ctx: CanvasRenderingContext2D) => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < count; i += 1) ctx.lineTo(pts[i].x, pts[i].y); };
    const fx = this.fx;
    fx.lineCap = 'round'; fx.lineJoin = 'round';
    fx.strokeStyle = rgba(c, a); fx.lineWidth = w; trace(fx); fx.stroke();
    const em = this.em;
    if (em) { em.lineCap = 'round'; em.lineJoin = 'round'; em.strokeStyle = rgba(c, a * Math.min(0.5, 0.12 + blur * 0.05)); em.lineWidth = w * 2 + blur * 1.5 + 2; trace(em); em.stroke(); }
  }
  private molten(pts: P[], c: RGB, a: number, w: number) {
    this.line(pts, c, a * 0.18, w * 5); this.line(pts, c, a * 0.45, w * 2.2); this.line(pts, mixc(c, WHITE, 0.55), a, w * 0.8);
  }
  private fit(text: string, size: number, max: number): string {
    if (max <= 20) return '';
    if (this.textWidth(text, size) <= max) return text;
    let s = text;
    while (s.length > 4 && this.textWidth(`${s}…`, size) > max) s = s.slice(0, -1);
    return `${s}…`;
  }
  private label(text: string, x: number, y: number, a: number, opt: { size?: number; col?: RGB; align?: 'left' | 'right' | 'center'; ring?: RGB; weight?: number } = {}) {
    if (a <= 0.01 || !text) return;
    const fx = this.fx, G = this.G!;
    const size = opt.size ?? (G.mob ? 10 : 11), col = opt.col ?? [236, 220, 204], align = opt.align ?? 'left';
    fx.save(); fx.font = `${opt.weight ?? 550} ${size}px ${FONT_MONO}`; fx.textBaseline = 'middle';
    const w = fx.measureText(text).width;
    let px = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    px = clamp(px, G.S.x + 8, G.S.x + G.S.w - 8 - w);
    fx.globalAlpha = a;
    fx.fillStyle = 'rgba(9,7,6,.78)'; fx.beginPath();
    if (typeof fx.roundRect === 'function') fx.roundRect(px - 5, y - size * 0.85, w + 10, size * 1.7, 5); else fx.rect(px - 5, y - size * 0.85, w + 10, size * 1.7);
    fx.fill();
    if (opt.ring) { fx.strokeStyle = rgba(opt.ring, 0.5); fx.lineWidth = 1; fx.stroke(); }
    fx.fillStyle = rgba(col, 1); fx.textAlign = 'left'; fx.fillText(text, px, y + 0.5);
    fx.restore();
  }
  // ------------------------------------------------------------------ anvil, hammer, ingot
  private anvilBody(c: CanvasRenderingContext2D) { c.beginPath(); c.moveTo(466, 505); c.bezierCurveTo(492, 499, 512, 497, 536, 497); c.lineTo(784, 497); c.lineTo(784, 521); c.lineTo(772, 527); c.bezierCurveTo(726, 530, 700, 537, 694, 557); c.lineTo(692, 580); c.bezierCurveTo(700, 592, 724, 598, 742, 600); c.lineTo(742, 612); c.lineTo(538, 612); c.lineTo(538, 600); c.bezierCurveTo(556, 598, 580, 592, 588, 580); c.lineTo(586, 557); c.bezierCurveTo(580, 538, 560, 531, 530, 528); c.bezierCurveTo(504, 525, 482, 516, 466, 505); c.closePath(); }
  private anvilTop(c: CanvasRenderingContext2D) { c.beginPath(); c.moveTo(466, 505); c.bezierCurveTo(490, 495, 512, 489, 538, 489); c.lineTo(778, 489); c.lineTo(784, 497); c.lineTo(536, 497); c.bezierCurveTo(512, 497, 492, 499, 466, 505); c.closePath(); }
  private drawAnvil(heat: number, gold: boolean, strike: number) {
    const ctx = this.fx, G = this.G!, { x, y } = G.bar, s = G.s;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-640, -492);
    ctx.save(); ctx.translate(640, 652); ctx.scale(1, 0.1);
    let g = ctx.createRadialGradient(0, 0, 0, 0, 0, 420); g.addColorStop(0, rgba(MOLTEN, 0.16 + 0.2 * heat)); g.addColorStop(1, rgba(MOLTEN, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 420, 0, 7); ctx.fill();
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, 230); g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 230, 0, 7); ctx.fill(); ctx.restore();
    g = ctx.createLinearGradient(0, 612, 0, 652); g.addColorStop(0, '#26211d'); g.addColorStop(1, '#0d0c0b'); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(560, 612); ctx.lineTo(720, 612); ctx.lineTo(730, 652); ctx.lineTo(550, 652); ctx.closePath(); ctx.fill();
    this.anvilBody(ctx); g = ctx.createLinearGradient(0, 497, 0, 612); g.addColorStop(0, '#3a312c'); g.addColorStop(0.18, '#221d1a'); g.addColorStop(0.6, '#151211'); g.addColorStop(1, '#0c0b0b'); ctx.fillStyle = g; ctx.fill();
    ctx.save(); this.anvilBody(ctx); ctx.clip();
    g = ctx.createLinearGradient(466, 0, 784, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,240,225,.05)'); g.addColorStop(0.42, 'rgba(255,240,225,0)'); g.addColorStop(0.72, 'rgba(255,240,225,.03)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(460, 495, 330, 120);
    ctx.globalCompositeOperation = 'lighter';
    g = ctx.createRadialGradient(640, 492, 0, 640, 500, 200); g.addColorStop(0, rgba(gold ? [255, 190, 80] : [255, 130, 50], 0.32 * heat + 0.07)); g.addColorStop(0.5, rgba([200, 80, 30], 0.1 * heat)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(460, 495, 330, 120); ctx.restore();
    ctx.save(); this.anvilBody(ctx); g = ctx.createLinearGradient(0, 497, 0, 612); g.addColorStop(0, rgba([255, 160, 90], 0.5 + 0.35 * heat)); g.addColorStop(0.35, rgba([255, 120, 60], 0.12)); g.addColorStop(1, rgba([255, 120, 60], 0.03));
    ctx.strokeStyle = g; ctx.lineWidth = 1 / s; ctx.stroke(); ctx.restore();
    this.anvilTop(ctx); g = ctx.createLinearGradient(0, 489, 0, 497); g.addColorStop(0, '#62554c'); g.addColorStop(1, '#2d2622'); ctx.fillStyle = g; ctx.fill();
    g = ctx.createLinearGradient(536, 0, 784, 0); g.addColorStop(0, 'rgba(255,200,150,.1)'); g.addColorStop(0.42, rgba([255, 226, 180], 0.55 + 0.4 * heat)); g.addColorStop(1, 'rgba(255,200,150,.12)'); ctx.fillStyle = g; ctx.fillRect(536, 496.5, 248, 1);
    ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalCompositeOperation = 'lighter';
    const r = 95 + heat * 120 + strike * 160;
    g = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
    g.addColorStop(0, rgba(WHITE, 0.9 * clamp(0.35 + heat + strike))); g.addColorStop(0.1, rgba(gold ? [255, 205, 110] : [255, 175, 90], 0.55 * clamp(0.3 + heat))); g.addColorStop(0.38, rgba([235, 100, 35], 0.1 + 0.12 * heat)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    g = ctx.createLinearGradient(-280, 0, 280, 0); g.addColorStop(0, 'rgba(255,150,70,0)'); g.addColorStop(0.5, rgba([255, 210, 150], 0.2 + 0.3 * heat + 0.5 * strike)); g.addColorStop(1, 'rgba(255,150,70,0)'); ctx.fillStyle = g; ctx.fillRect(-280, -1, 560, 2);
    ctx.globalCompositeOperation = 'source-over';
    if (this.em) {
      // the halo the old bloom pass gave the hot bar: a wide flat glow plus a round one above the face
      const em = this.em, sp = this.sprite(gold ? [255, 200, 90] : [255, 140, 50]), core = this.sprite(gold ? [255, 230, 170] : [255, 190, 120]);
      if (sp && core) {
        const R = (110 + heat * 90 + strike * 140) * s; em.globalAlpha = clamp(0.5 + 0.45 * heat + 0.4 * strike); em.drawImage(sp, x - R * 1.4, y - R * 0.5, R * 2.8, R);
        const C = (75 + heat * 65 + strike * 100) * s; em.globalAlpha = clamp(0.45 + 0.5 * heat + 0.5 * strike); em.drawImage(core, x - C, y - C, C * 2, C * 2);
        em.globalAlpha = 1;
      }
    }
    g = ctx.createLinearGradient(-56, 0, 56, 0); const edge = gold ? '#a8741c' : '#b8400e', mid = gold ? '#ffc861' : '#ff7a2a';
    g.addColorStop(0, edge); g.addColorStop(0.22, mid); g.addColorStop(0.5, '#fff3dc'); g.addColorStop(0.78, mid); g.addColorStop(1, edge);
    ctx.globalAlpha = 0.5 + 0.5 * clamp(heat + 0.25); ctx.fillStyle = g; ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(-56, -5, 112, 10, 4); else ctx.rect(-56, -5, 112, 10);
    ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,255,240,.75)'; ctx.fillRect(-40, -4, 80, 1);
    ctx.restore();
  }
  private hammerTheta(t: number, strikes: number[]): number {
    const rest = (208.6 * Math.PI) / 180, hit = (160 * Math.PI) / 180;
    let s = strikes[0];
    for (const st of strikes) if (t >= st - 0.6) s = st;
    let th = rest + 0.03 * Math.sin(this.ambient * 2.6);
    if (t >= s - 0.42 && t < s - 0.13) th = rest + 0.13 * easeInOut((t - (s - 0.42)) / 0.29);
    else if (t >= s - 0.13 && t < s) { const u = (t - (s - 0.13)) / 0.13; th = rest + 0.13 + (hit - rest - 0.13) * u * u * u; }
    else if (t >= s && t < s + 0.55) th = hit + (rest - hit) * easeOut((t - s) / 0.55);
    return th;
  }
  private hammerAt(th: number, alpha: number, faceHeat: number) {
    const ctx = this.fx, HP = { x: 210.5, y: -120 }, HR = 240;
    const hx = HP.x + HR * Math.cos(th), hy = HP.y + HR * Math.sin(th);
    const rx = (HP.x - hx) / HR, ry = (HP.y - hy) / HR, tx = Math.sin(th), ty = -Math.cos(th);
    ctx.save(); ctx.transform(tx, ty, rx, ry, hx, hy);
    let g = ctx.createLinearGradient(-6, 0, 6, 0); g.addColorStop(0, '#24160d'); g.addColorStop(0.35, '#7d5636'); g.addColorStop(0.62, '#4d311d'); g.addColorStop(1, '#1c1109');
    for (let k = 0; k < 12; k += 1) {
      const y0 = 14 + k * 12, y1 = y0 + 12.5, a = k < 6 ? 1 : 1 - (k - 5) / 7, w0 = 4 + (y0 / 150) * 1.6, w1 = 4 + (y1 / 150) * 1.6;
      ctx.globalAlpha = alpha * a; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-w0, y0); ctx.lineTo(w0, y0); ctx.lineTo(w1, y1); ctx.lineTo(-w1, y1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,170,100,.45)'; ctx.fillRect(w0 - 1.6, y0, 0.9, 12.5);
    }
    ctx.globalAlpha = alpha; ctx.fillStyle = '#121112'; ctx.fillRect(-6.5, 12, 13, 6);
    const head = () => { ctx.beginPath(); ctx.moveTo(-32, -14); ctx.lineTo(32, -14); ctx.lineTo(37, -9); ctx.lineTo(37, 9); ctx.lineTo(32, 14); ctx.lineTo(-32, 14); ctx.lineTo(-37, 9); ctx.lineTo(-37, -9); ctx.closePath(); };
    head(); g = ctx.createLinearGradient(0, -14, 0, 14); g.addColorStop(0, '#7e838b'); g.addColorStop(0.12, '#464a51'); g.addColorStop(0.5, '#25272b'); g.addColorStop(0.85, '#141517'); g.addColorStop(1, '#2e2622'); ctx.fillStyle = g; ctx.fill();
    ctx.save(); head(); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    g = ctx.createLinearGradient(-40, 0, 40, 0); g.addColorStop(0, 'rgba(255,120,50,0)'); g.addColorStop(1, 'rgba(255,140,60,.4)'); ctx.fillStyle = g; ctx.fillRect(-40, -16, 80, 32);
    if (faceHeat > 0.01) { g = ctx.createRadialGradient(37, 0, 0, 37, 0, 44); g.addColorStop(0, rgba([255, 240, 200], faceHeat)); g.addColorStop(0.4, rgba([255, 140, 50], faceHeat * 0.6)); g.addColorStop(1, 'rgba(255,100,30,0)'); ctx.fillStyle = g; ctx.fillRect(-8, -16, 46, 32); }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-31, -13.2, 62, 0.8); ctx.fillStyle = 'rgba(255,160,90,.55)'; ctx.fillRect(-31, 13, 62, 0.8);
    ctx.restore();
  }
  private drawHammer(t: number, strikes: number[]) {
    const G = this.G!, ctx = this.fx;
    const t0 = strikes[0] - 0.6, t1 = strikes[strikes.length - 1] + 1.1; if (t < t0 || t > t1) return;
    const alpha = clamp((t - t0) / 0.3) * (1 - clamp((t - (t1 - 0.35)) / 0.35));
    const th = this.hammerTheta(t, strikes), thp = this.hammerTheta(t - 1 / 60, strikes);
    let faceHeat = 0; for (const st of strikes) if (t >= st) faceHeat = Math.max(faceHeat, Math.exp(-(t - st) / 0.22));
    const s = G.s * (G.mob ? 0.92 : 1);
    ctx.save(); ctx.translate(G.bar.x, G.bar.y); ctx.scale(s, s);
    const d = th - thp;
    const near = strikes.find((st) => t >= st - 0.13 && t < st + 0.02);
    if (near !== undefined && Math.abs(d) > 0.02) {
      for (let k = 3; k >= 1; k -= 1) this.hammerAt(th - d * k * 0.5, alpha * 0.1, 0);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba([255, 230, 190], 0.2 * alpha); ctx.lineWidth = 22;
      ctx.beginPath(); ctx.arc(210.5, -120, 248, Math.min(th, th - d * 2.4), Math.max(th, th - d * 2.4)); ctx.stroke(); ctx.restore();
    }
    this.hammerAt(th, alpha, faceHeat); ctx.restore();
  }
  private ingot(x: number, yb: number, w: number, heat: number, sc: number, alpha: number) {
    const ctx = this.fx;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, yb); ctx.scale(sc, sc);
    const h = w * 0.36, hw = w / 2;
    ctx.shadowColor = rgba(mixc(GOLD, [255, 150, 60], heat), 0.7); ctx.shadowBlur = 16 + 20 * heat;
    ctx.beginPath(); ctx.moveTo(-hw + 6, -h); ctx.lineTo(hw - 6, -h); ctx.lineTo(hw, 0); ctx.lineTo(-hw, 0); ctx.closePath();
    const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, rgba(mixc([255, 238, 170], [255, 252, 240], heat), 1)); g.addColorStop(0.45, rgba(mixc([236, 182, 72], [255, 214, 140], heat), 1)); g.addColorStop(1, rgba(mixc([150, 100, 34], [255, 130, 50], heat), 1));
    ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(70,36,6,.65)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-hw + 9, -h - 4); ctx.lineTo(hw - 4, -h - 4); ctx.lineTo(hw - 6, -h); ctx.lineTo(-hw + 6, -h); ctx.closePath(); ctx.fillStyle = rgba(mixc([255, 236, 176], [255, 255, 245], heat), 1); ctx.fill();
    ctx.font = `800 ${Math.max(7, w * 0.17)}px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.fillStyle = rgba(mixc([84, 52, 12], [160, 70, 20], heat), 0.85); ctx.fillText('FIND', 1, -h * 0.3);
    ctx.restore();
  }

  // ------------------------------------------------------------------ DOM state per t
  private updateDom() {
    const story = this.story!, T = this.tl!, t = this.t, G = this.G!;
    const n = story.nodes.length;
    // chip: each recorded query (or the Goal it derives from) types in, one after another
    let qi = 0;
    for (let i = 1; i < T.qa.length && i < story.query.all.length; i += 1) if (t >= T.qa[i]) qi = i;
    const q = story.query.all[qi] ?? story.query.text;
    const typed = Math.round(clamp((t - T.qa[qi]) / (T.qb[qi] - T.qa[qi])) * q.length);
    const qText = typed >= q.length ? `«${q}»` : typed > 0 ? `«${q.slice(0, typed)}` : '';
    const lastTyped = T.qb[Math.min(T.qb.length, story.query.all.length) - 1] ?? T.q1;
    const caretOn = !this.hooks.reducedMotion() && (t < lastTyped + 0.5 || story.reach === 'idle') && Math.sin(this.ambient * 12) > -0.2;
    // steps (visual only while replaying; the real step state stays in the DOM for assistive tech)
    const step = storyStep(T, t);
    const shownLog = this.visibleLog(t);
    const maxLines = G.mob ? 1 : 4;
    const lines = shownLog.slice(-maxLines);
    const newest = lines[lines.length - 1];
    const typedChars = newest ? Math.round(clamp((t - newest.at) / 0.45) * newest.line.segs.reduce((sum, seg) => sum + seg.text.length, 0)) : 0;
    const picks = T.pick.filter((p) => t >= p).length;
    const allPicked = n > 0 && picks === n;
    const evid = story.nodes.filter((node, k) => node.outcome !== 'unread' && node.outcome !== 'pending' && t >= T.read[k] + 0.5).length;
    const readsDone = n > 0 && story.nodes.every((node, k) => node.outcome === 'pending' || t >= T.read[k] + 0.5) && story.nodes.some((node) => node.outcome !== 'pending');
    const sups = T.strike.filter((st) => t >= st + 0.05).length;
    const final = story.reach === 'final' && t >= T.end - 0.01;
    const cells: Record<string, string> = {
      candidates: t < (n ? T.pick[0] : Infinity) ? '·' : String(allPicked ? story.counts.candidates : picks),
      evidence: !story.nodes.some((node) => node.outcome !== 'pending') || t < T.read[0] + 0.5 ? '·' : String(readsDone ? story.counts.evidence : evid),
      support: story.reach !== 'final' || t < (T.strike.length ? T.strike[0] + 0.05 : T.verdict) ? '·' : String(t >= T.find ? story.counts.supported : sups),
    };
    if (story.resultCount !== undefined) {
      // results returned: each search's count lands when it comes back (only real recorded counts)
      let sum = 0;
      story.runCounts.forEach((count, i) => { if (count !== undefined && T.ra[i] !== undefined) sum += Math.round(clamp((t - T.ra[i]) / 0.6) * count); });
      cells.results = T.ra[0] === undefined || t < T.ra[0] ? '·' : String(t >= (T.ra[T.ra.length - 1] ?? 0) + 0.6 ? story.resultCount : sum);
    }
    const visible = allPicked ? story.counts.candidates : picks;
    const key = [qText, caretOn, step, this.playing, lines.length, newest?.line.id, typedChars, ...Object.values(cells), visible, final].join('|');
    for (let k = 0; k < n; k += 1) this.applyStage(story.nodes[k], k, t);
    if (key === this.domKey) return;
    this.domKey = key;
    if (this.el.queryText && this.el.queryText.textContent !== qText) this.el.queryText.textContent = qText;
    if (this.el.caret) this.el.caret.style.opacity = caretOn ? '1' : '0';
    const replay = this.playing;
    this.el.steps().forEach((li, i) => {
      if (!replay) { delete li.dataset.vis; return; }
      li.dataset.vis = i < step ? (i >= 3 ? 'gold' : 'done') : i === step ? 'now' : 'todo';
    });
    for (const [k, el] of this.el.cells()) {
      const v = cells[k]; if (v === undefined) continue;
      if (el.textContent !== v) el.textContent = v;
      const cell = el.closest('[data-k]') as HTMLElement | null;
      if (cell) cell.dataset.on = v === '·' ? 'false' : 'true';
    }
    if (this.el.panelCount) this.el.panelCount.textContent = `${visible} de ${story.counts.candidates}`;
    const ticker = this.el.ticker;
    if (ticker) {
      const frag = document.createDocumentFragment();
      lines.forEach((entry, index) => {
        const div = document.createElement('div'); div.className = 'ln';
        let left = index === lines.length - 1 ? typedChars : Infinity;
        for (const seg of entry.line.segs) {
          if (left <= 0) break;
          const span = document.createElement('span'); span.className = seg.tone;
          span.textContent = seg.text.slice(0, Math.max(0, left)); left -= seg.text.length;
          div.appendChild(span);
        }
        frag.appendChild(div);
      });
      ticker.replaceChildren(frag);
    }
  }

  private visibleLog(t: number): { at: number; line: LogLine }[] {
    const T = this.tl!, story = this.story!;
    const out: { at: number; line: LogLine }[] = [];
    let unsupported = 0;
    let finds = 0;
    for (const line of story.log) {
      const c = line.cue;
      let at = 0;
      switch (c.kind) {
        case 'query': at = T.qa[c.index] ?? T.q0; break;
        case 'results': at = T.ra[c.index] ?? T.q1 + 0.35; break;
        case 'pick': at = T.pick[c.node]; break;
        case 'reading': at = T.hold.candidates - 0.6; break;
        case 'read': at = T.read[c.node] + 0.5; break;
        case 'support': {
          const j = T.strikeNode.indexOf(c.node);
          at = j >= 0 ? T.strike[j] + 0.05 : T.verdict + 0.5 + 0.3 * unsupported++;
          break;
        }
        case 'find': at = T.find + 0.1 + 0.3 * finds++; break;
      }
      if (t >= at) out.push({ at, line });
    }
    return out.sort((a, b) => a.at - b.at);
  }

  private applyStage(node: StoryNode, k: number, t: number) {
    const T = this.tl!;
    let stage: CrawlerStage = 'hidden';
    if (t >= T.pick[k]) stage = 'candidate';
    if (node.outcome !== 'pending') {
      if (t >= T.read[k]) stage = 'reading';
      if (t >= T.read[k] + 0.5) stage = node.outcome === 'unread' ? 'ash' : 'evidence';
      const j = T.strikeNode.indexOf(k);
      if (j >= 0 && t >= T.strike[j] + 0.05) stage = 'gold';
      if (node.outcome === 'unsupported' && t >= T.verdict + 0.5) stage = 'steel';
    }
    if (this.stages.get(node.id) === stage) return;
    this.stages.set(node.id, stage);
    this.hooks.onStage(node.id, stage);
  }

  /** Whether the current play-through re-tells an already settled mission. */
  get isReplaying() { return this.replaying; }
}
