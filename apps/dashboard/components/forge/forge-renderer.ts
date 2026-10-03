/**
 * Canvas renderer for the Forge live view — the v2 mockup's visual language (hot bar on the anvil,
 * spark flights, molten Evidence threads, gold steel + hammer strike for Kernel SUPPORT, ash for a
 * rejection, ingots into the FIND tray) driven only by the scene spec built from real Kernel data.
 *
 * Data → light (see lib/forge/forge-scene.ts):
 * - one spark flight per real candidate URL (it lands on that candidate's card; while the Kernel
 *   still has to read it, the same candidate re-fires from the anvil now and then);
 * - one molten thread per real Evidence record; one gold temper + hammer strike + ingot per real
 *   Kernel SUPPORT; one ash crumble per real rejection.
 * Atmosphere (glow, smoke, rising embers, strike burst, search pulse) carries no data.
 *
 * Timing: whenever records appear or advance (first paint, a Kernel update, or "Repetir"), their
 * transitions are queued in pipeline order with short staggers, so a mission whose phases landed in
 * one Kernel read still reads as search → Evidence → SUPPORT. Reduced motion draws the final frame
 * once. The loop pauses when the tab is hidden or the canvas is off screen; idle states run at a
 * low frame rate and particle counts are lower on narrow screens.
 */
import type { ForgeElementKind, ForgeSceneMood, ForgeSceneMotion } from '../../lib/forge/forge-scene';

export type SceneThread = {
  id: string;
  kind: ForgeElementKind;
  readFailed?: boolean;
  /** Card anchor (node) in CSS px relative to the canvas. */
  ax: number;
  ay: number;
  side: 'left' | 'right' | 'down';
  lane: number;
};

export type SceneSpec = {
  width: number;
  height: number;
  layout: 'wide' | 'narrow';
  anvil: { x: number; y: number; scale: number };
  tray: { x: number; y: number; w: number } | null;
  threads: SceneThread[];
  mood: ForgeSceneMood;
  motion: ForgeSceneMotion;
  searchPulse: boolean;
  /** Bump to replay every visible record's transitions from the start. */
  replay: number;
};

export type CardStage = 'pending' | 'landed' | 'evidence' | 'gold' | 'ash';
export type RendererCallbacks = {
  reducedMotion: () => boolean;
  /** Visual stage of a card, so the HTML card lights up when its spark lands / its verdict hits. */
  onStage?: (id: string, stage: CardStage) => void;
  /** True while queued transitions are still playing. */
  onPlaying?: (playing: boolean) => void;
  /** Number of ingots that already reached the tray. */
  onTray?: (landed: number) => void;
};

type Pt = [number, number];
type RGB = [number, number, number];
type Glitter = { u: number; vx: number; vy: number; life: number };
type Runtime = {
  id: string;
  kind: ForgeElementKind;
  readFailed: boolean;
  ph: number;
  launchAt: number;
  landAt: number;
  evidenceAt: number;
  verdictAt: number;
  strikeAt: number;
  geoKey: string;
  sx: number; sy: number; cx: number; cy: number; nx: number; ny: number;
  glitter: Glitter[];
  pts: Pt[]; cum: number[]; len: number;
  segs: { u0: number; u1: number; d: number; rot: number; vx: number }[];
  flakes: { u: number; t0: number; vy: number; sw: number; sz: number }[];
  stage: CardStage | undefined;
};
type Fx = { act: number; strike: number; shakeX: number; shakeY: number; gold: boolean };

const THREAD_DRAW = 0.85;
const WAVE = 0.7;
const COOL = 1.25;
const STRIKE_GAP = 0.95;

const EMBER: RGB = [255, 138, 61];
const GOLD: RGB = [245, 196, 81];
const ASH: RGB = [106, 100, 96];
const WHITE_HOT: RGB = [255, 244, 214];

export class ForgeRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private spec: SceneSpec | undefined;
  private runtimes = new Map<string, Runtime>();
  private strikes: number[] = [];
  private bursts: { at: number; parts: { vx: number; vy: number; life: number }[] }[] = [];
  private raf = 0;
  private running = false;
  private visible = true;
  private onScreen = true;
  private lastFrame = 0;
  private readonly epoch = performance.now() / 1000;
  private lastReplay = Number.NaN;
  private dpr = 1;
  private playing = false;
  private trayLanded = -1;
  private cursor = { launch: -Infinity, evidence: -Infinity, ash: -Infinity, strike: -Infinity };
  private readonly ambient = makeAmbient(90);
  private readonly bokeh = makeBokeh();
  private readonly smoke: HTMLCanvasElement | undefined;
  private readonly bloomA: HTMLCanvasElement | undefined;
  private readonly bloomB: HTMLCanvasElement | undefined;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly cb: RendererCallbacks) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    this.smoke = makeNoise(96, 31337);
    // Bloom needs canvas filters (not in every Safari); without them the scene simply skips it.
    if (typeof (ctx as { filter?: unknown }).filter === 'string') {
      this.bloomA = document.createElement('canvas');
      this.bloomB = document.createElement('canvas');
    }
  }

  private now(): number { return performance.now() / 1000 - this.epoch; }

  update(spec: SceneSpec) {
    const t = this.now();
    const narrow = spec.layout === 'narrow';
    const rawDpr = Math.min(window.devicePixelRatio || 1, 2);
    // Keep the backing store bounded on tall phone stages.
    this.dpr = Math.max(1, Math.min(rawDpr, Math.sqrt(5_000_000 / Math.max(1, spec.width * spec.height))));
    const w = Math.max(1, Math.round(spec.width * this.dpr));
    const h = Math.max(1, Math.round(spec.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    if (this.bloomA && this.bloomB) {
      const bw = Math.max(1, Math.round(w * 0.3)); const bh = Math.max(1, Math.round(h * 0.3));
      if (this.bloomA.width !== bw || this.bloomA.height !== bh) { this.bloomA.width = this.bloomB.width = bw; this.bloomA.height = this.bloomB.height = bh; }
    }
    const replay = spec.replay !== this.lastReplay;
    this.lastReplay = spec.replay;
    if (replay) {
      this.runtimes.clear();
      this.strikes = [];
      this.bursts = [];
      this.cursor = { launch: -Infinity, evidence: -Infinity, ash: -Infinity, strike: -Infinity };
    }
    const start = t + (replay ? 0.35 : 0.1);
    const next = new Map<string, Runtime>();
    for (const thread of spec.threads) {
      const previous = this.runtimes.get(thread.id);
      const rt = this.geometry(spec, thread, previous);
      if (!previous) {
        rt.launchAt = Math.max(start, this.cursor.launch + (narrow ? 0.34 : 0.26));
        this.cursor.launch = rt.launchAt;
        rt.landAt = rt.launchAt + flightTime(rt);
      }
      const hadEvidence = previous ? Number.isFinite(previous.evidenceAt) : false;
      const hasEvidence = thread.kind === 'thread' || thread.kind === 'gold' || (thread.kind === 'ash' && !thread.readFailed);
      if (hasEvidence && !hadEvidence) {
        rt.evidenceAt = Math.max(rt.landAt + 0.45, this.cursor.evidence + 0.3, t + 0.1);
        this.cursor.evidence = rt.evidenceAt;
      }
      if (!hasEvidence) rt.evidenceAt = Infinity;
      if (!previous || previous.kind !== thread.kind) {
        rt.verdictAt = Infinity; rt.strikeAt = Infinity;
        if (thread.kind === 'gold') {
          rt.strikeAt = Math.max(rt.evidenceAt + THREAD_DRAW + 1.0, this.cursor.strike + STRIKE_GAP, t + WAVE + 0.1);
          this.cursor.strike = rt.strikeAt;
          rt.verdictAt = rt.strikeAt - WAVE;
          this.bursts.push({ at: rt.strikeAt, parts: makeBurst(narrow ? 110 : 240, this.bursts.length + 1) });
        } else if (thread.kind === 'ash') {
          const after = thread.readFailed ? rt.landAt + 0.7 : rt.evidenceAt + THREAD_DRAW + 1.1;
          rt.verdictAt = Math.max(after, this.cursor.ash + 0.16, t + 0.1);
          this.cursor.ash = rt.verdictAt;
        }
      }
      rt.kind = thread.kind;
      rt.readFailed = Boolean(thread.readFailed);
      next.set(thread.id, rt);
    }
    this.runtimes = next;
    // One strike (and one ingot) per real SUPPORT verdict currently on screen.
    this.strikes = [...next.values()].filter((item) => item.kind === 'gold').map((item) => item.strikeAt).sort((a, b) => a - b);
    this.bursts = this.bursts.filter((burst) => this.strikes.includes(burst.at)).slice(-8);
    this.spec = spec;
    if (this.cb.reducedMotion()) { this.stop(); this.drawFrame(Infinity); return; }
    this.drawFrame(this.now());
    this.ensureLoop();
  }

  setVisibility(visible: boolean) { this.visible = visible; this.ensureLoop(); }
  setOnScreen(onScreen: boolean) { this.onScreen = onScreen; this.ensureLoop(); }
  destroy() { this.stop(); this.runtimes.clear(); }
  stop() { this.running = false; if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  /** Static final frame (reduced motion, tests, screenshots). */
  drawFinal() { this.drawFrame(Infinity); }

  private ensureLoop() {
    const reduced = this.cb.reducedMotion();
    const shouldRun = Boolean(this.spec) && this.visible && this.onScreen && !reduced && this.spec?.motion !== 'still';
    if (shouldRun && !this.running) {
      this.running = true;
      const tick = (ms: number) => {
        if (!this.running) return;
        const busy = this.spec?.motion === 'live' || this.isPlaying(this.now());
        const narrow = this.spec?.layout === 'narrow';
        // Display rate while something happens (~30 fps on phones); ~24 fps for idle breathing.
        const minGap = busy ? (narrow ? 31 : 0) : 40;
        if (ms - this.lastFrame >= minGap) { this.lastFrame = ms; this.drawFrame(this.now()); }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    } else if (!shouldRun) {
      if (this.running) this.stop();
      if (this.spec) this.drawFrame(reduced || this.spec.motion === 'still' ? Infinity : this.now());
    }
  }

  private lastEventAt(): number {
    let last = -Infinity;
    for (const rt of this.runtimes.values()) {
      for (const value of [rt.landAt, rt.evidenceAt + THREAD_DRAW, rt.verdictAt + COOL + 1.4, rt.strikeAt + 2.2]) if (Number.isFinite(value)) last = Math.max(last, value);
    }
    return last;
  }

  private isPlaying(t: number): boolean { return t < this.lastEventAt(); }

  // ---------------------------------------------------------------- geometry
  private geometry(spec: SceneSpec, thread: SceneThread, previous?: Runtime): Runtime {
    const { x: AX, y: AY, scale } = spec.anvil;
    const geoKey = `${spec.layout}:${Math.round(AX)}:${Math.round(AY)}:${Math.round(scale * 100)}:${Math.round(thread.ax)}:${Math.round(thread.ay)}:${thread.lane}`;
    if (previous && previous.geoKey === geoKey) return { ...previous };
    const ph = previous?.ph ?? hash01(thread.id);
    const rand = mulberry32(Math.floor(ph * 1e6) + 7);
    const nx = thread.ax; const ny = thread.ay;
    // Spark flight: from the hot bar, up and over, down onto the card node.
    const sx = AX + (rand() - 0.5) * 60 * scale; const sy = AY - 6 * scale;
    const dist = Math.hypot(nx - sx, ny - sy);
    // Phones: fan the arcs both ways above the anvil before they fall onto the stacked cards.
    const cx = spec.layout === 'narrow' ? AX + (rand() - 0.35) * spec.width * 0.8 : sx + (nx - sx) * 0.45;
    const cy = Math.max(8, Math.min(sy, ny) - (0.35 + rand() * 0.3) * Math.min(dist, 520) - 30);
    const glitter = Array.from({ length: spec.layout === 'narrow' ? 18 : 24 }, () => ({ u: 0.08 + rand() * 0.8, vx: (rand() - 0.5) * 90, vy: -20 - rand() * 70, life: 0.35 + rand() * 0.5 }));
    // Thread polyline: node (u = 0) → anvil (u = 1).
    const pts: Pt[] = [];
    if (spec.layout === 'wide') {
      const dir = thread.side === 'left' ? -1 : 1;
      const ex = AX + dir * (13 + (thread.lane % 6) * 7) * scale; const ey = AY + 1;
      const mx = (nx + ex) / 2; const my = (ny + ey) / 2;
      const sag = Math.max(-80, Math.min(70, 0.37 * (AY - ny) - 50));
      sampleQuad(pts, [nx, ny], [mx - dir * 8, my + sag], [ex, ey], 48);
    } else {
      const laneX = 9 + Math.min(thread.lane, 7) * 3.2;
      const ex = AX - 12 * scale + (thread.lane % 4) * 6 * scale; const ey = AY + 4 * scale;
      const turnY = AY + 64 * scale;
      const hookY = Math.max(turnY + 1, ny - 18);
      sampleQuad(pts, [nx, ny], [laneX, ny], [laneX, hookY], 10);
      const steps = Math.max(2, Math.ceil((hookY - turnY) / 18));
      for (let k = 1; k <= steps; k += 1) pts.push([laneX, hookY - ((hookY - turnY) * k) / steps]);
      sampleCubic(pts, [laneX, turnY], [laneX, turnY - 40 * scale], [ex, ey + 40 * scale], [ex, ey], 22);
    }
    const cum = [0];
    for (let k = 1; k < pts.length; k += 1) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const cuts = [0]; for (let k = 0; k < 7; k += 1) cuts.push(0.08 + rand() * 0.86); cuts.push(1); cuts.sort((a, b) => a - b);
    const segs = [];
    for (let k = 0; k < cuts.length - 1; k += 1) if (cuts[k + 1] - cuts[k] > 0.02) segs.push({ u0: cuts[k], u1: cuts[k + 1], d: rand() * 0.28, rot: (rand() - 0.5) * 1.6, vx: (rand() - 0.5) * 40 });
    const flakes = Array.from({ length: spec.layout === 'narrow' ? 18 : 30 }, () => ({ u: rand(), t0: 0.7 + rand() * 0.5, vy: 30 + rand() * 60, sw: rand() * 6.28, sz: 0.9 + rand() * 1.4 }));
    const geo = { geoKey, sx, sy, cx, cy, nx, ny, glitter, pts, cum, len: cum.at(-1) ?? 0, segs, flakes };
    if (previous) return { ...previous, ...geo };
    return { id: thread.id, kind: thread.kind, readFailed: Boolean(thread.readFailed), ph, launchAt: Infinity, landAt: Infinity, evidenceAt: Infinity, verdictAt: Infinity, strikeAt: Infinity, stage: undefined, ...geo };
  }

  private tp(rt: Runtime, u: number): Pt {
    const target = clamp(u) * rt.len;
    let lo = 0; let hi = rt.cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (rt.cum[mid] < target) lo = mid + 1; else hi = mid; }
    const k = Math.max(1, lo);
    const seg = rt.cum[k] - rt.cum[k - 1] || 1;
    const f = (target - rt.cum[k - 1]) / seg;
    const a = rt.pts[k - 1]; const b = rt.pts[k] ?? a;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }

  private slice(rt: Runtime, u0: number, u1: number): Pt[] {
    const out: Pt[] = [this.tp(rt, u0)];
    const a = clamp(u0) * rt.len; const b = clamp(u1) * rt.len;
    for (let k = 0; k < rt.pts.length; k += 1) if (rt.cum[k] > a && rt.cum[k] < b) out.push(rt.pts[k]);
    out.push(this.tp(rt, u1));
    return out;
  }

  private flight(rt: Runtime, u: number): Pt { return bez(rt.sx, rt.sy, rt.cx, rt.cy, rt.nx, rt.ny, u); }

  // ---------------------------------------------------------------- frame
  private drawFrame(tIn: number) {
    const spec = this.spec;
    if (!spec) return;
    const ctx = this.ctx;
    const settled = !Number.isFinite(tIn);
    const t = settled ? 1e4 : tIn;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, spec.width, spec.height);
    const fx = this.fx(spec, t, settled);
    this.drawBackdrop(spec, t, fx);
    if (spec.mood !== 'off') this.drawAmbient(spec, t, fx, false);
    for (const rt of this.runtimes.values()) this.drawThread(spec, rt, t, settled);
    this.drawAnvil(spec, fx);
    this.drawBar(spec, t, fx);
    if (spec.searchPulse && !settled) this.drawSearchPulse(spec, t);
    if (!settled) {
      for (const rt of this.runtimes.values()) this.drawSparks(spec, rt, t);
      this.drawHammer(spec, t, fx);
      this.drawShock(spec, t);
      this.drawBursts(spec, t);
    }
    if (spec.tray) this.drawTray(spec, t, settled);
    if (spec.mood !== 'off') this.drawAmbient(spec, t, fx, true);
    if (!settled && spec.layout === 'wide' && fx.act > 0.2) this.bloom();
    this.emitStages(t, settled);
  }

  private fx(spec: SceneSpec, t: number, settled: boolean): Fx {
    let strike = 0; let shakeX = 0; let shakeY = 0;
    if (!settled) {
      this.strikes.forEach((s, k) => {
        const u = t - s;
        if (u >= 0 && u < 0.6) {
          const a = 3.2 * Math.exp(-u / 0.09);
          shakeX += a * Math.sin(u * 95 + k); shakeY += a * Math.cos(u * 83 + k * 2);
          strike = Math.max(strike, Math.exp(-u / 0.18));
        }
      });
    }
    let arrive = 0;
    if (!settled) for (const rt of this.runtimes.values()) { const u = t - rt.landAt; if (u >= 0 && u < 0.5) arrive = Math.max(arrive, 1 - u / 0.5); }
    const breathe = 0.5 + 0.5 * Math.sin(t * 1.15);
    const base: Record<ForgeSceneMood, number> = {
      off: 0, connecting: 0.12 + 0.08 * breathe, idle: 0.16 + 0.06 * breathe, waiting: 0.22 + 0.14 * breathe,
      searching: 0.52 + 0.12 * Math.sin(t * 2.4), verifying: 0.62 + 0.1 * Math.sin(t * 3.1), gold: 0.42 + 0.05 * breathe, ash: 0.24 + 0.04 * breathe, alert: 0.12,
    };
    const playing = !settled && this.isPlaying(t) ? 0.25 : 0;
    const act = clamp(base[spec.mood] + playing + arrive * 0.3 + strike * 0.8, 0, 1.4);
    return { act, strike, shakeX, shakeY, gold: spec.mood === 'gold' };
  }

  private emitStages(t: number, settled: boolean) {
    for (const rt of this.runtimes.values()) {
      let stage: CardStage;
      if (settled) stage = rt.kind === 'spark' ? 'landed' : rt.kind === 'thread' ? 'evidence' : rt.kind;
      else if (t < rt.landAt) stage = 'pending';
      else if (rt.kind === 'gold' && t >= rt.strikeAt) stage = 'gold';
      else if (rt.kind === 'ash' && t >= rt.verdictAt + 0.35) stage = 'ash';
      else if (Number.isFinite(rt.evidenceAt) && t >= rt.evidenceAt + THREAD_DRAW * 0.55) stage = 'evidence';
      else stage = 'landed';
      if (stage !== rt.stage) { rt.stage = stage; this.cb.onStage?.(rt.id, stage); }
    }
    const playing = !settled && this.isPlaying(t);
    if (playing !== this.playing) { this.playing = playing; this.cb.onPlaying?.(playing); }
    const landed = settled ? this.strikes.length : this.strikes.filter((s) => t - s > 1.2).length;
    if (landed !== this.trayLanded) { this.trayLanded = landed; this.cb.onTray?.(landed); }
  }

  // ---------------------------------------------------------------- atmosphere (no data)
  private drawBackdrop(spec: SceneSpec, t: number, fx: Fx) {
    const ctx = this.ctx;
    const { x: AX, y: AY, scale } = spec.anvil;
    const wide = spec.layout === 'wide';
    const k = Math.max(scale, 0.6);
    const r = (wide ? 780 : 420) * k;
    if (spec.mood === 'off') {
      const g = ctx.createRadialGradient(AX, AY, 0, AX, AY, r * 0.5);
      g.addColorStop(0, 'rgba(120,120,130,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(AX - r, AY - r, r * 2, r * 2);
      return;
    }
    const tint: RGB = fx.gold ? [255, 170, 70] : [255, 118, 46];
    ctx.save();
    let g = ctx.createRadialGradient(AX, AY - 10, 0, AX, AY - 10, r);
    g.addColorStop(0, rgba(...tint, 0.13 + 0.12 * fx.act)); g.addColorStop(0.22, rgba(170, 62, 22, 0.08 + 0.05 * fx.act));
    g.addColorStop(0.55, 'rgba(60,24,12,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(AX - r, AY - r, r * 2, r * 2);
    const cr = (wide ? 360 : 220) * k;
    g = ctx.createRadialGradient(AX, AY - cr * 0.55, 0, AX, AY - cr * 0.55, cr);
    g.addColorStop(0, rgba(255, 140, 60, 0.04 + 0.05 * fx.act)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(AX - cr, AY - cr * 1.6, cr * 2, cr * 2);
    const fy = AY + 150 * scale;
    if (wide) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, fy, spec.width, Math.max(0, Math.min(spec.height - fy, 240))); ctx.clip();
      g = ctx.createRadialGradient(AX, fy + 20, 10, AX, fy + 20, 560);
      g.addColorStop(0, rgba(255, 150, 80, 0.1 + 0.06 * fx.act)); g.addColorStop(0.5, 'rgba(255,130,60,0.03)'); g.addColorStop(1, 'rgba(255,120,50,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.beginPath();
      const vy = fy - 260; const bottom = fy + 240;
      for (let i = -14; i <= 14; i += 1) { const bx = AX + i * 120; ctx.moveTo(AX + (bx - AX) * ((fy - vy) / (bottom - vy)), fy); ctx.lineTo(bx, bottom); }
      for (let i = 0; i < 6; i += 1) { const y = fy + Math.pow(i / 6, 1.7) * 220; ctx.moveTo(0, y); ctx.lineTo(spec.width, y); }
      ctx.stroke();
      ctx.restore();
      g = ctx.createLinearGradient(AX - 520, 0, AX + 520, 0);
      g.addColorStop(0, 'rgba(255,150,80,0)'); g.addColorStop(0.5, rgba(255, 160, 90, 0.14 + 0.08 * fx.act)); g.addColorStop(1, 'rgba(255,150,80,0)');
      ctx.fillStyle = g; ctx.fillRect(AX - 520, fy, 1040, 1);
    }
    ctx.save(); ctx.translate(AX, AY + 132 * scale); ctx.scale(1, 0.13);
    const pr = (wide ? 470 : 260) * k;
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, pr);
    g.addColorStop(0, rgba(...(fx.gold ? GOLD : [255, 150, 70] as RGB), 0.26 + 0.16 * fx.act)); g.addColorStop(0.35, 'rgba(255,110,40,0.08)'); g.addColorStop(1, 'rgba(255,100,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, pr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (this.smoke) {
      const sw = (wide ? 900 : 460) * Math.max(scale, 0.7); const sh = sw * 0.62;
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.07 + 0.06 * clamp(fx.act);
      const drift = (t * 9) % sh;
      ctx.beginPath(); ctx.ellipse(AX, AY - sh * 0.32, sw / 2, sh / 2, 0, 0, Math.PI * 2); ctx.clip();
      const ox = AX - sw / 2 + Math.sin(t * 0.2) * 10;
      ctx.drawImage(this.smoke, ox, AY - sh * 0.82 - drift, sw, sh);
      ctx.drawImage(this.smoke, ox, AY - sh * 0.82 - drift + sh, sw, sh);
      ctx.restore();
    }
    if (wide) {
      ctx.globalCompositeOperation = 'lighter';
      for (const b of this.bokeh) {
        const x = AX + b.x * spec.width * 0.5 + Math.sin(t * 0.25 + b.ph) * 14;
        const y = AY - 60 + b.y * 320 - ((t * b.sp) % 60) + Math.cos(t * 0.3 + b.ph) * 6;
        const a = b.a * (0.7 + 0.3 * Math.sin(t * 0.8 + b.ph)) * (0.5 + fx.act * 0.6);
        const bg = ctx.createRadialGradient(x, y, b.r * 0.55, x, y, b.r);
        bg.addColorStop(0, rgba(255, 150, 80, a)); bg.addColorStop(0.85, rgba(255, 140, 70, a * 0.8)); bg.addColorStop(1, 'rgba(255,130,60,0)');
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawAmbient(spec: SceneSpec, t: number, fx: Fx, near: boolean) {
    const ctx = this.ctx;
    const { x: AX, y: AY, scale } = spec.anvil;
    const wide = spec.layout === 'wide';
    const spread = (wide ? 1100 : 380) * Math.max(scale, 0.7);
    const rise = (wide ? 420 : 250) * Math.max(scale, 0.7);
    const density = clamp(0.25 + fx.act * 0.75);
    const count = Math.round(this.ambient.length * (wide ? 1 : 0.6) * density);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i += 1) {
      const p = this.ambient[i];
      if ((p.z > 0.6) !== near) continue;
      const speed = 0.55 + fx.act * 0.6;
      const age = ((t * speed + p.ph * p.life) % p.life); const u = age / p.life;
      const x = AX + p.x * spread + Math.sin(t * 0.9 + p.f) * p.sway * u;
      const y = AY + 10 * scale - u * rise - u * u * 40;
      const fl = 0.55 + 0.45 * Math.sin(t * 7 + p.f * 3);
      const a = (u < 0.1 ? u / 0.1 : 1 - (u - 0.1) / 0.9) * fl * (near ? 0.75 : 0.4) * (0.5 + 0.5 * clamp(fx.act));
      const c = mix([255, 200, 120], [255, 100, 40], u);
      const s = p.sz * (near ? 1.3 : 0.8);
      ctx.fillStyle = rgba(...c, a); ctx.fillRect(x - s / 2, y - s / 2, s, s);
      ctx.fillStyle = rgba(...c, a * 0.35); ctx.fillRect(x - s * 0.25, y, s * 0.5, s * 3.5);
    }
    ctx.restore();
  }

  /** Hermes is searching and no candidate URL exists yet: heat radiates from the anvil, no sparks. */
  private drawSearchPulse(spec: SceneSpec, t: number) {
    const ctx = this.ctx;
    const { x: AX, y: AY, scale } = spec.anvil;
    const maxR = (spec.layout === 'wide' ? 380 : 190) * Math.max(scale, 0.6);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k += 1) {
      const u = ((t / 2.1) + k / 3) % 1;
      const r = 20 + maxR * easeOut(u); const a = Math.pow(1 - u, 1.8) * 0.5;
      ctx.save(); ctx.translate(AX, AY - 2); ctx.scale(1, 0.34);
      ctx.strokeStyle = rgba(255, 190, 120, a); ctx.lineWidth = 1.2 + 2 * (1 - u);
      ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- sparks (one per real candidate)
  private drawSparks(spec: SceneSpec, rt: Runtime, t: number) {
    this.drawFlight(rt, t, rt.launchAt, true);
    // A candidate the Kernel has not read yet re-fires from the anvil while the mission is live.
    if (spec.motion === 'live' && rt.kind === 'spark' && t > rt.landAt) {
      const period = 2.4 + rt.ph * 1.6;
      const k = Math.floor((t - rt.landAt) / period);
      this.drawFlight(rt, t, rt.landAt + k * period + 0.4, false);
    }
  }

  private drawFlight(rt: Runtime, t: number, at: number, first: boolean) {
    const ctx = this.ctx;
    const d = flightTime(rt);
    const u = (t - at) / d;
    if (u > 0 && u < 1) {
      // Long tapered comet trail: white-hot head, gold body, ember tail.
      const N = 12;
      const pts = Array.from({ length: N }, (_, k) => this.flight(rt, easeOut2(Math.max(0, u - (k / (N - 1)) * 0.26))));
      const fade = Math.min(1, (1 - u) / 0.12);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let k = N - 2; k >= 0; k -= 1) {
        const f = k / (N - 2);
        const col: RGB = f < 0.2 ? [255, 246, 220] : f < 0.55 ? [255, 196, 110] : [255, 128, 52];
        ctx.strokeStyle = rgba(...col, (1 - f) * 0.95 * fade * (first ? 1 : 0.7));
        ctx.lineWidth = (3.4 * (1 - f) + 0.5) * (first ? 1 : 0.75);
        ctx.beginPath(); ctx.moveTo(pts[k][0], pts[k][1]); ctx.lineTo(pts[k + 1][0], pts[k + 1][1]); ctx.stroke();
      }
      ctx.restore();
      glow(ctx, pts[0][0], pts[0][1], first ? 15 : 9, [255, 252, 240], [255, 170, 80], 0.95 * fade);
    }
    // launch pop at the hot bar (the same spark leaving the anvil)
    const pu = t - at;
    if (pu >= 0 && pu < 0.22) glow(this.ctx, rt.sx, rt.sy, first ? 26 : 16, [255, 250, 230], [255, 150, 60], 1 - pu / 0.22);
    // glitter shed by this spark (part of the same spark, never a separate record)
    const tau0 = t - at;
    if (tau0 > 0 && tau0 < d + 1) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const g of rt.glitter) {
        const tau = tau0 - g.u * d;
        if (tau < 0 || tau > g.life) continue;
        const [px, py] = this.flight(rt, easeOut2(g.u));
        const x = px + g.vx * tau; const y = py + g.vy * tau + 0.5 * 520 * tau * tau;
        const a = (1 - tau / g.life) * (first ? 0.9 : 0.6);
        ctx.fillStyle = tau < g.life * 0.4 ? rgba(255, 236, 190, a) : rgba(255, 150, 70, a * 0.8);
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
      ctx.restore();
    }
    const lu = t - (at + d);
    if (lu >= 0 && lu < 0.9) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(255, 190, 110, 0.7 * (1 - lu / 0.9)); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(rt.nx, rt.ny, 3 + easeOut(lu / 0.9) * (first ? 26 : 14), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      if (lu < 0.18) glow(ctx, rt.nx, rt.ny, 22, [255, 255, 240], [255, 170, 80], 1 - lu / 0.18);
    }
  }

  // ---------------------------------------------------------------- threads (Evidence) + verdicts
  private drawThread(spec: SceneSpec, rt: Runtime, t: number, settled: boolean) {
    const ctx = this.ctx;
    if (!settled && t < rt.landAt) return;
    const live = spec.motion === 'live';
    const vu = t - rt.verdictAt;
    const goldOn = rt.kind === 'gold' && (settled || t >= rt.strikeAt - 0.05);
    const coolC = rt.kind === 'ash' ? (settled ? 1 : clamp(vu / 0.55)) : 0;
    const col = goldOn ? mix(EMBER, GOLD, settled ? 1 : clamp((t - rt.strikeAt) / 0.3)) : mix(EMBER, ASH, coolC);
    const pul = 0.85 + 0.15 * Math.sin(t * 4 + rt.ph * 6);
    const nodeR = (goldOn ? 24 : rt.kind === 'spark' ? 12 : 17) * (1 - coolC * 0.65);
    glow(ctx, rt.nx, rt.ny, nodeR, mix(WHITE_HOT, col, 0.35), col, (rt.kind === 'spark' ? (live ? 0.6 * pul : 0.45) : 0.85 * pul) * (1 - coolC * 0.85));
    if (goldOn) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,220,140,0.75)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(rt.nx, rt.ny, 7 + Math.sin(t * 3 + rt.ph) * 0.8, 0, Math.PI * 2); ctx.stroke();
      const su = t - rt.strikeAt;
      if (!settled && su >= 0 && su < 0.7) { ctx.strokeStyle = rgba(255, 236, 180, 0.8 * (1 - su / 0.7)); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(rt.nx, rt.ny, 7 + easeOut(su / 0.7) * 40, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
    ctx.fillStyle = coolC > 0.5 ? 'rgba(150,143,137,0.9)' : goldOn ? '#fff6dc' : '#ffe8c8';
    ctx.beginPath(); ctx.arc(rt.nx, rt.ny, 2.4, 0, Math.PI * 2); ctx.fill();

    if (rt.kind === 'spark') {
      // Candidate waiting for the Kernel read: faint dotted trace, no molten thread (no Evidence yet).
      this.dotted(this.slice(rt, 0, 1), rgba(...EMBER, 0.22), 1, [1.5, 7]);
      return;
    }
    if (rt.kind === 'ash' && rt.readFailed) {
      this.dotted(this.slice(rt, 0, 1), rgba(...mix(EMBER, ASH, coolC), 0.32), 1, [1.5, 6]);
      if (!settled && vu >= 0 && vu < 2.4) this.flakesAt(rt, vu, 0.6);
      return;
    }
    const f = settled ? 1 : clamp((t - rt.evidenceAt) / THREAD_DRAW);
    if (f <= 0) { this.dotted(this.slice(rt, 0, 1), rgba(...EMBER, 0.3), 1.1, [1.5, 6]); return; }
    const fe = easeInOut(f);
    if (rt.kind === 'gold') {
      const w = settled ? 1 : clamp((vu - 0.05) / WAVE);
      const strikeK = !settled && t >= rt.strikeAt ? clamp(1 - (t - rt.strikeAt) / 0.5) : 0;
      if (w > 0) this.steel(rt, this.slice(rt, 0, Math.min(w, fe)), t, strikeK, settled);
      if (w < fe) this.molten(rt, this.slice(rt, w, fe), t, 1);
      if (w > 0 && w < 1) { const [wx, wy] = this.tp(rt, w); glow(ctx, wx, wy, 28, [255, 255, 245], [255, 214, 120], 1); }
      if (!settled && f >= 1 && vu < 0) this.drops(rt, t);
    } else if (rt.kind === 'ash') {
      if (settled) this.dotted(this.slice(rt, 0, 1), 'rgba(120,114,108,0.42)', 1, [1.5, 5]);
      else if (vu < 0) { this.molten(rt, this.slice(rt, 0, fe), t, 1); if (f >= 1) this.drops(rt, t); }
      else this.cooling(rt, vu, t);
    } else {
      this.molten(rt, this.slice(rt, 0, fe), t, 1);
      if (!settled && f >= 1) this.drops(rt, t);
    }
    if (!settled && f < 1) {
      const [hx, hy] = this.tp(rt, fe);
      glow(ctx, hx, hy, 18, [255, 250, 230], [255, 140, 50], 1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 1; k <= 6; k += 1) { const [qx, qy] = this.tp(rt, Math.max(0, fe - k * 0.018)); const j = Math.sin(t * 40 + k * 2.1) * 2.5; ctx.fillStyle = rgba(255, 220, 160, 0.8 - k * 0.12); ctx.fillRect(qx + j - 0.8, qy - j * 0.6 - 0.8, 1.6, 1.6); }
      ctx.restore();
    }
  }

  private stroke(pts: Pt[]) {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k += 1) ctx.lineTo(pts[k][0], pts[k][1]);
  }

  private dotted(pts: Pt[], color: string, width: number, dash: number[]) {
    if (pts.length < 2) return;
    const ctx = this.ctx;
    ctx.save(); ctx.lineCap = 'round'; ctx.setLineDash(dash); this.stroke(pts); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.restore();
  }

  private molten(rt: Runtime, pts: Pt[], t: number, k: number) {
    if (pts.length < 2 || k <= 0) return;
    const ctx = this.ctx;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    this.stroke(pts); ctx.strokeStyle = rgba(255, 92, 24, 0.2 * k); ctx.lineWidth = 10; ctx.stroke();
    this.stroke(pts); ctx.strokeStyle = rgba(255, 110, 36, 0.28 * k); ctx.lineWidth = 5; ctx.stroke();
    const a = pts[0]; const b = pts.at(-1) ?? a;
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, rgba(210, 70, 18, 0.9 * k)); g.addColorStop(0.6, rgba(255, 140, 52, 0.95 * k)); g.addColorStop(1, rgba(255, 200, 120, k));
    this.stroke(pts); ctx.strokeStyle = g; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.setLineDash([2, 9]); ctx.lineDashOffset = -(t * 95 + rt.ph * 60); this.stroke(pts); ctx.strokeStyle = rgba(255, 246, 214, 0.8 * k); ctx.lineWidth = 1.7; ctx.stroke();
    ctx.setLineDash([11, 27]); ctx.lineDashOffset = -(t * 58 + rt.ph * 110); this.stroke(pts); ctx.strokeStyle = rgba(255, 196, 110, 0.45 * k); ctx.lineWidth = 3.4; ctx.stroke();
    ctx.setLineDash([]);
    this.stroke(pts); ctx.strokeStyle = rgba(255, 232, 186, 0.5 * k); ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore();
  }

  private steel(rt: Runtime, pts: Pt[], t: number, flashK: number, settled: boolean) {
    if (pts.length < 2) return;
    const ctx = this.ctx;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalCompositeOperation = 'lighter';
    this.stroke(pts); ctx.strokeStyle = rgba(245, 196, 81, 0.17 + flashK * 0.3); ctx.lineWidth = 11 + flashK * 8; ctx.stroke();
    this.stroke(pts); ctx.strokeStyle = 'rgba(255,214,120,0.22)'; ctx.lineWidth = 4.5; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    const a = pts[0]; const b = pts.at(-1) ?? a;
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, 'rgb(196,146,58)'); g.addColorStop(0.5, 'rgb(246,204,110)'); g.addColorStop(1, 'rgb(255,226,150)');
    this.stroke(pts); ctx.strokeStyle = g; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    this.stroke(pts); ctx.strokeStyle = 'rgba(255,250,232,0.85)'; ctx.lineWidth = 0.9; ctx.stroke();
    if (!settled) {
      const L = rt.len;
      ctx.setLineDash([30, L + 400]); ctx.lineDashOffset = -((t * 190 + rt.ph * 300) % (L + 430)) + 30;
      this.stroke(pts); ctx.strokeStyle = 'rgba(255,255,245,0.75)'; ctx.lineWidth = 2.2; ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  private grey(pts: Pt[], a: number) {
    if (pts.length < 2 || a <= 0) return;
    const ctx = this.ctx;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    this.stroke(pts); ctx.strokeStyle = rgba(70, 66, 63, 0.85 * a); ctx.lineWidth = 2.6; ctx.stroke();
    this.stroke(pts); ctx.strokeStyle = rgba(150, 143, 137, 0.75 * a); ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  private drops(rt: Runtime, t: number) {
    for (let k = 0; k < 3; k += 1) { const u = ((t * 0.5 + k / 3 + rt.ph) % 1); const [qx, qy] = this.tp(rt, u); glow(this.ctx, qx, qy, 7, [255, 250, 225], [255, 150, 60], 0.7 * Math.sin(u * Math.PI)); }
  }

  private cooling(rt: Runtime, cu0: number, t: number) {
    const cu = cu0 / COOL;
    const kCool = clamp(cu / 0.55);
    if (cu < 0.75) {
      const gap = clamp((cu - 0.45) / 0.3) * 0.012;
      if (kCool < 1) this.molten(rt, this.slice(rt, 0, 1), t, (1 - kCool) * (1 - kCool));
      for (const s of rt.segs) { const a = s.u0 + (s.u0 > 0 ? gap : 0); const b = s.u1 - (s.u1 < 1 ? gap : 0); if (b > a) this.grey(this.slice(rt, a, b), kCool); }
      if (gap > 0) for (const s of rt.segs) if (s.u0 > 0) { const [qx, qy] = this.tp(rt, s.u0); glow(this.ctx, qx, qy, 6, [255, 210, 150], [255, 110, 40], 0.9 * (1 - clamp((cu - 0.45) / 0.3))); }
    } else {
      for (const s of rt.segs) {
        const tau = cu - 0.75 - s.d;
        const pts = this.slice(rt, s.u0 + (s.u0 > 0 ? 0.012 : 0), s.u1 - (s.u1 < 1 ? 0.012 : 0));
        if (tau <= 0) { this.grey(pts, 1); continue; }
        if (tau > 0.95) continue;
        const [mx, my] = this.tp(rt, (s.u0 + s.u1) / 2); const dy = 0.5 * 820 * tau * tau; const ang = s.rot * tau; const ca = Math.cos(ang); const sa = Math.sin(ang);
        this.grey(pts.map(([x, y]) => [mx + (x - mx) * ca - (y - my) * sa + s.vx * tau, my + (x - mx) * sa + (y - my) * ca + dy] as Pt), 1 - tau / 0.95);
      }
      const gh = clamp((cu - 1.25) / 0.6);
      if (gh > 0) this.dotted(this.slice(rt, 0, 1), rgba(120, 114, 108, 0.42 * gh), 1, [1.5, 5]);
    }
    this.flakesAt(rt, cu, 1);
  }

  private flakesAt(rt: Runtime, cu: number, k: number) {
    const ctx = this.ctx;
    for (const fl of rt.flakes) {
      const tau = cu - fl.t0; if (tau < 0 || tau > 1.9) continue;
      const [x0, y0] = this.tp(rt, fl.u); const x = x0 + Math.sin(tau * 2.4 + fl.sw) * 7; const y = y0 + fl.vy * tau + 30 * tau * tau;
      const a = (1 - tau / 1.9) * 0.85 * k;
      ctx.fillStyle = tau < 0.25 ? rgba(255, 150, 70, a) : rgba(150, 142, 136, a * 0.8);
      ctx.fillRect(x - fl.sz / 2, y - fl.sz / 2, fl.sz, fl.sz);
    }
  }

  // ---------------------------------------------------------------- anvil, bar, hammer
  private drawAnvil(spec: SceneSpec, fx: Fx) {
    const ctx = this.ctx;
    const { x: AX, y: AY, scale } = spec.anvil;
    const heat = clamp(fx.act);
    const cold = spec.mood === 'off';
    ctx.save();
    ctx.translate(AX + fx.shakeX * 0.4, AY + fx.shakeY * 0.4); ctx.scale(scale, scale); ctx.translate(-640, -485);
    ctx.save(); ctx.translate(640, 652); ctx.scale(1, 0.09);
    let g = ctx.createRadialGradient(0, 0, 0, 0, 0, 220); g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 220, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    g = ctx.createLinearGradient(0, 612, 0, 652); g.addColorStop(0, '#24201d'); g.addColorStop(1, '#0d0c0b');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(560, 612); ctx.lineTo(720, 612); ctx.lineTo(728, 652); ctx.lineTo(552, 652); ctx.closePath(); ctx.fill();
    g = ctx.createLinearGradient(552, 0, 728, 0); g.addColorStop(0, 'rgba(255,150,80,0)'); g.addColorStop(0.5, rgba(255, 160, 90, cold ? 0.08 : 0.35 + 0.2 * heat)); g.addColorStop(1, 'rgba(255,150,80,0)');
    ctx.fillStyle = g; ctx.fillRect(560, 612, 160, 1);
    anvilBody(ctx);
    g = ctx.createLinearGradient(0, 497, 0, 612);
    g.addColorStop(0, cold ? '#2a2a2c' : '#332c28'); g.addColorStop(0.18, cold ? '#1b1b1d' : '#1f1b19'); g.addColorStop(0.6, '#141211'); g.addColorStop(1, '#0c0b0b');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); anvilBody(ctx); ctx.clip();
    g = ctx.createLinearGradient(466, 0, 784, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,240,225,0.045)'); g.addColorStop(0.42, 'rgba(255,240,225,0)'); g.addColorStop(0.7, 'rgba(255,240,225,0.025)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(460, 495, 330, 120);
    if (!cold) {
      ctx.globalCompositeOperation = 'lighter';
      g = ctx.createRadialGradient(640, 492, 0, 640, 500, 190);
      g.addColorStop(0, rgba(255, 130, 50, 0.3 * heat + 0.06)); g.addColorStop(0.5, rgba(200, 80, 30, 0.08 * heat)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(460, 495, 330, 120);
      g = ctx.createLinearGradient(560, 0, 740, 0);
      g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(0.5, rgba(255, 150, 70, 0.25 + 0.5 * heat)); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; ctx.fillRect(556, 509, 188, 1.2);
    }
    ctx.restore();
    ctx.save(); anvilBody(ctx);
    g = ctx.createLinearGradient(0, 497, 0, 612);
    g.addColorStop(0, cold ? 'rgba(160,160,170,0.3)' : rgba(255, 160, 90, 0.55 + 0.3 * heat)); g.addColorStop(0.35, rgba(255, 120, 60, cold ? 0.03 : 0.12)); g.addColorStop(1, 'rgba(255,120,60,0.03)');
    ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    anvilTop(ctx);
    g = ctx.createLinearGradient(0, 489, 0, 497); g.addColorStop(0, cold ? '#4a4a4e' : '#5a4e46'); g.addColorStop(1, '#2d2622');
    ctx.fillStyle = g; ctx.fill();
    if (!cold) {
      ctx.save(); anvilTop(ctx); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
      g = ctx.createRadialGradient(640, 492, 0, 640, 492, 170);
      g.addColorStop(0, rgba(255, 190, 110, 0.7 * heat + 0.15)); g.addColorStop(0.4, rgba(255, 120, 50, 0.25 * heat)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(460, 486, 330, 14); ctx.restore();
    }
    g = ctx.createLinearGradient(536, 0, 784, 0);
    g.addColorStop(0, 'rgba(255,200,150,0.1)'); g.addColorStop(0.42, rgba(255, 226, 180, cold ? 0.15 : 0.55 + 0.4 * heat)); g.addColorStop(1, 'rgba(255,200,150,0.12)');
    ctx.fillStyle = g; ctx.fillRect(536, 496.5, 248, 1);
    ctx.restore();
  }

  /** The incandescent KERNEL · GOAL bar on the anvil face. */
  private drawBar(spec: SceneSpec, t: number, fx: Fx) {
    const ctx = this.ctx;
    const { x: AX, y: AY, scale } = spec.anvil;
    ctx.save(); ctx.translate(AX, AY); ctx.scale(scale, scale);
    if (spec.mood === 'off') { ctx.fillStyle = '#3a3a3e'; roundRect(ctx, -56, -5, 112, 10, 4); ctx.fill(); ctx.restore(); return; }
    const act = fx.act; const pulse = 0.9 + 0.1 * Math.sin(t * 3.3);
    ctx.globalCompositeOperation = 'lighter';
    const r = 95 + act * 95;
    const core = mix(WHITE_HOT, [255, 250, 235], fx.strike);
    let g = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
    g.addColorStop(0, rgba(...core, 0.9 * pulse * clamp(0.35 + act))); g.addColorStop(0.1, rgba(255, 180, 90, 0.55 * pulse * clamp(0.3 + act)));
    g.addColorStop(0.38, rgba(235, 100, 35, 0.1 + 0.1 * act)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    g = ctx.createLinearGradient(-260, 0, 260, 0);
    g.addColorStop(0, 'rgba(255,150,70,0)'); g.addColorStop(0.5, rgba(255, 210, 150, 0.18 + 0.25 * clamp(act - 0.3) + 0.4 * fx.strike)); g.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = g; ctx.fillRect(-260, -1, 520, 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = 'rgba(255,140,50,0.95)'; ctx.shadowBlur = (12 + act * 18) * scale;
    g = ctx.createLinearGradient(-56, 0, 56, 0);
    const edge = fx.gold ? '#a8741c' : '#b8400e'; const mid = fx.gold ? '#ffc861' : '#ff7a2a';
    g.addColorStop(0, edge); g.addColorStop(0.22, mid); g.addColorStop(0.5, rgbStr(core)); g.addColorStop(0.78, mid); g.addColorStop(1, edge);
    ctx.globalAlpha = 0.45 + 0.55 * clamp(act + 0.2);
    ctx.fillStyle = g; roundRect(ctx, -56, -5, 112, 10, 4); ctx.fill();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,240,0.75)'; ctx.fillRect(-40, -4, 80, 1);
    ctx.restore();
  }

  private hammerTheta(t: number): number {
    const restTh = (208.6 * Math.PI) / 180; const strikeTh = (160 * Math.PI) / 180;
    let th = restTh + 0.03 * Math.sin(t * 2.6);
    for (const s of this.strikes) {
      if (t >= s - 0.42 && t < s - 0.13) th = restTh + 0.13 * easeInOut((t - (s - 0.42)) / 0.29);
      else if (t >= s - 0.13 && t < s) { const u = (t - (s - 0.13)) / 0.13; th = restTh + 0.13 + (strikeTh - restTh - 0.13) * u * u * u; }
      else if (t >= s && t < s + 0.55) th = strikeTh + (restTh - strikeTh) * easeOut((t - s) / 0.55);
    }
    return th;
  }

  /** The hammer only comes in for real Kernel SUPPORT verdicts: one strike each. */
  private drawHammer(spec: SceneSpec, t: number, fx: Fx) {
    if (!this.strikes.length) return;
    const t0 = this.strikes[0] - 0.9; const t1 = (this.strikes.at(-1) ?? 0) + 0.95;
    if (t < t0 || t > t1) return;
    const alpha = clamp((t - t0) / 0.3) * (1 - clamp((t - (t1 - 0.35)) / 0.35));
    const th = this.hammerTheta(t); const thp = this.hammerTheta(t - 1 / 45);
    let faceHeat = 0; for (const s of this.strikes) if (t >= s) faceHeat = Math.max(faceHeat, Math.exp(-(t - s) / 0.22));
    const ctx = this.ctx;
    const { x: AX, y: AY, scale } = spec.anvil;
    const s = scale * (spec.layout === 'narrow' ? 0.9 : 1);
    ctx.save(); ctx.translate(AX, AY); ctx.scale(s, s);
    const d = th - thp;
    const down = this.strikes.some((st) => t >= st - 0.13 && t < st + 0.02);
    if (down && Math.abs(d) > 0.02) {
      for (let k = 3; k >= 1; k -= 1) this.hammerAt(th - d * k * 0.5, alpha * 0.1, 0, fx.act);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba(255, 230, 190, 0.2 * alpha); ctx.lineWidth = 22;
      ctx.beginPath(); ctx.arc(210.5, -120, 248, Math.min(th, th - d * 2.4), Math.max(th, th - d * 2.4)); ctx.stroke(); ctx.restore();
    }
    this.hammerAt(th, alpha, faceHeat, fx.act);
    ctx.restore();
  }

  /** Hammer in anvil-local units (bar centre at 0,0), swinging around a pivot to the right. */
  private hammerAt(th: number, alpha: number, faceHeat: number, act: number) {
    const ctx = this.ctx;
    const HP = { x: 210.5, y: -120 }; const HR = 240;
    const hx = HP.x + HR * Math.cos(th); const hy = HP.y + HR * Math.sin(th);
    const rx = (HP.x - hx) / HR; const ry = (HP.y - hy) / HR; const tx = Math.sin(th); const ty = -Math.cos(th);
    ctx.save();
    ctx.transform(tx, ty, rx, ry, hx, hy);
    let g = ctx.createLinearGradient(-6, 0, 6, 0);
    g.addColorStop(0, '#24160d'); g.addColorStop(0.35, '#7d5636'); g.addColorStop(0.62, '#4d311d'); g.addColorStop(1, '#1c1109');
    for (let k = 0; k < 12; k += 1) {
      const y0 = 14 + k * 12; const y1 = y0 + 12.5; const a = k < 6 ? 1 : 1 - (k - 5) / 7;
      const w0 = 4 + (y0 / 150) * 1.6; const w1 = 4 + (y1 / 150) * 1.6;
      ctx.globalAlpha = alpha * a; ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-w0, y0); ctx.lineTo(w0, y0); ctx.lineTo(w1, y1); ctx.lineTo(-w1, y1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,170,100,0.45)'; ctx.fillRect(w0 - 1.6, y0, 0.9, 12.5);
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#121112'; ctx.fillRect(-6.5, 12, 13, 6);
    const head = () => { ctx.beginPath(); ctx.moveTo(-32, -14); ctx.lineTo(32, -14); ctx.lineTo(37, -9); ctx.lineTo(37, 9); ctx.lineTo(32, 14); ctx.lineTo(-32, 14); ctx.lineTo(-37, 9); ctx.lineTo(-37, -9); ctx.closePath(); };
    head();
    g = ctx.createLinearGradient(0, -14, 0, 14);
    g.addColorStop(0, '#7e838b'); g.addColorStop(0.12, '#464a51'); g.addColorStop(0.5, '#25272b'); g.addColorStop(0.85, '#141517'); g.addColorStop(1, '#2e2622');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); head(); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    g = ctx.createLinearGradient(-40, 0, 40, 0); g.addColorStop(0, 'rgba(255,120,50,0)'); g.addColorStop(1, rgba(255, 140, 60, 0.5 * clamp(act) + 0.12));
    ctx.fillStyle = g; ctx.fillRect(-40, -16, 80, 32);
    g = ctx.createLinearGradient(31, 0, 37, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(230,226,220,0.35)');
    ctx.fillStyle = g; ctx.fillRect(31, -14, 6, 28);
    if (faceHeat > 0.01) {
      g = ctx.createRadialGradient(37, 0, 0, 37, 0, 44); g.addColorStop(0, rgba(255, 240, 200, faceHeat)); g.addColorStop(0.4, rgba(255, 140, 50, faceHeat * 0.6)); g.addColorStop(1, 'rgba(255,100,30,0)');
      ctx.fillStyle = g; ctx.fillRect(-8, -16, 46, 32);
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-31, -13.2, 62, 0.8);
    ctx.fillStyle = 'rgba(255,160,90,0.55)'; ctx.fillRect(-31, 13, 62, 0.8);
    head(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore();
  }

  private drawShock(spec: SceneSpec, t: number) {
    const ctx = this.ctx;
    const { x: AX, y: AY, scale } = spec.anvil;
    for (const s of this.strikes) {
      const u = (t - s) / 0.8; if (u < 0 || u > 1) continue;
      const r = (14 + 430 * easeOut(u)) * scale; const a = Math.pow(1 - u, 1.6);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(AX, AY + 6 * scale); ctx.scale(1, 0.3);
      ctx.strokeStyle = rgba(255, 232, 180, 0.62 * a); ctx.lineWidth = 1.5 + 3.5 * (1 - u); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = rgba(255, 170, 90, 0.22 * a); ctx.lineWidth = 12 * (1 - u) + 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.94, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      const u2 = clamp((t - s - 0.03) / 0.6);
      if (u2 > 0 && u2 < 1) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(255, 236, 200, 0.32 * Math.pow(1 - u2, 2)); ctx.lineWidth = 1.5 + 3 * (1 - u2);
        ctx.beginPath(); ctx.arc(AX, AY, (10 + 300 * easeOut(u2)) * scale, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      if (u < 0.2) glow(ctx, AX, AY - 2, 70 * scale * (1 - u * 2), [255, 255, 250], [255, 200, 120], 0.8 * (1 - u / 0.2));
    }
  }

  /** Decorative burst of the hammer strike itself (only at a real SUPPORT strike). */
  private drawBursts(spec: SceneSpec, t: number) {
    const ctx = this.ctx;
    const { x: AX, y: AY, scale } = spec.anvil;
    const paths = [new Path2D(), new Path2D(), new Path2D()]; const heads = new Path2D();
    let any = false;
    for (const burst of this.bursts) {
      const tau0 = t - burst.at; if (tau0 < 0 || tau0 > 1.2) continue;
      any = true;
      for (const b of burst.parts) {
        if (tau0 > b.life) continue;
        const pos = (tau: number): Pt => { const e = (1 - Math.exp(-2.3 * tau)) / 2.3; return [AX + b.vx * e * scale, AY - 4 * scale + (b.vy * e + 0.5 * 900 * tau * tau) * scale]; };
        const u = tau0 / b.life; const p0 = pos(tau0); const p1 = pos(Math.max(0, tau0 - 0.022)); const p2 = pos(Math.max(0, tau0 - 0.05));
        const h = u < 0.35 ? 0 : u < 0.7 ? 1 : 2;
        paths[h].moveTo(p0[0], p0[1]); paths[h].lineTo(p1[0], p1[1]); paths[h].lineTo(p2[0], p2[1]);
        if (u < 0.5) heads.rect(p0[0] - 0.9, p0[1] - 0.9, 1.8, 1.8);
      }
    }
    if (!any) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const styles: [number, number, number, number, number][] = [[255, 250, 230, 0.95, 1.5], [255, 214, 120, 0.8, 1.2], [255, 150, 60, 0.55, 0.9]];
    styles.forEach(([r, g, b, a, w], h) => { ctx.strokeStyle = rgba(r, g, b, a); ctx.lineWidth = w; ctx.stroke(paths[h]); });
    ctx.fillStyle = 'rgba(255,255,245,1)'; ctx.fill(heads);
    ctx.restore();
  }

  // ---------------------------------------------------------------- tray + ingots (one per SUPPORT)
  private drawTray(spec: SceneSpec, t: number, settled: boolean) {
    const tray = spec.tray;
    if (!tray) return;
    const ctx = this.ctx;
    const landed = settled ? this.strikes.length : this.strikes.filter((s) => t - s > 1.2).length;
    const lit = landed ? clamp(0.4 + (landed / 3) * 0.6) : 0;
    ctx.save();
    let g = ctx.createLinearGradient(0, tray.y, 0, tray.y + 8); g.addColorStop(0, '#3a332d'); g.addColorStop(1, '#221d1a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(tray.x + 8, tray.y); ctx.lineTo(tray.x + tray.w - 8, tray.y); ctx.lineTo(tray.x + tray.w, tray.y + 8); ctx.lineTo(tray.x, tray.y + 8); ctx.closePath(); ctx.fill();
    g = ctx.createLinearGradient(0, tray.y + 8, 0, tray.y + 20); g.addColorStop(0, '#191614'); g.addColorStop(1, '#0d0c0b');
    ctx.fillStyle = g; ctx.fillRect(tray.x, tray.y + 8, tray.w, 12);
    g = ctx.createLinearGradient(tray.x, 0, tray.x + tray.w, 0); g.addColorStop(0, 'rgba(245,196,81,0)'); g.addColorStop(0.5, rgba(245, 196, 81, 0.25 + 0.6 * lit)); g.addColorStop(1, 'rgba(245,196,81,0)');
    ctx.fillStyle = g; ctx.fillRect(tray.x, tray.y + 8, tray.w, 1);
    if (lit > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.translate(tray.x + tray.w / 2, tray.y + 6); ctx.scale(1, 0.18);
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, 140); g.addColorStop(0, rgba(245, 196, 81, 0.22 * lit)); g.addColorStop(1, 'rgba(245,196,81,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 140, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    const iw = spec.layout === 'narrow' ? 36 : 48;
    const slots = Math.max(1, Math.floor((tray.w - 16) / (iw + 6)));
    const shown = Math.min(this.strikes.length, slots);
    const rowW = shown * iw + (shown - 1) * 6;
    const { x: AX, y: AY, scale } = spec.anvil;
    this.strikes.forEach((strike, index) => {
      if (index >= slots) return;
      const sx = tray.x + (tray.w - rowW) / 2 + iw / 2 + index * (iw + 6);
      const tau = settled ? 99 : t - strike;
      if (tau < 0) return;
      const heat = 1 - clamp((tau - 0.05) / 0.5);
      const sc = tau < 0.25 ? 0.55 + 0.45 * easeOut(tau / 0.25) : 1;
      let x = AX; let y = AY - 4 * scale;
      const m = clamp((tau - 0.6) / 0.6);
      if (m > 0) { const e = easeInOut(m); x += (sx - x) * e; y += (tray.y + 3 - y) * e - Math.sin(Math.PI * e) * 60 * scale; }
      if (tau > 1.2 && tau < 1.45) y -= Math.sin(((tau - 1.2) / 0.25) * Math.PI) * 3;
      ingot(ctx, x, y, iw, heat, sc, clamp(tau / 0.08));
      if (!settled) {
        steam(ctx, AX, AY - 2 * scale, strike + 0.12, t, 14, 34 * scale, 80 * scale, Math.max(scale, 0.6));
        steam(ctx, sx, tray.y - 6, strike + 1.2, t, 8, 16, 40, 0.7);
      }
    });
  }

  // ---------------------------------------------------------------- post
  private bloom() {
    const a = this.bloomA; const b = this.bloomB;
    if (!a || !b) return;
    const ax = a.getContext('2d'); const bx = b.getContext('2d');
    if (!ax || !bx) return;
    const ctx = this.ctx;
    ax.setTransform(1, 0, 0, 1, 0, 0); ax.globalCompositeOperation = 'copy'; ax.filter = 'brightness(1.05) contrast(2.3) saturate(1.25)';
    ax.drawImage(this.canvas, 0, 0, a.width, a.height); ax.filter = 'none';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
    bx.globalCompositeOperation = 'copy'; bx.filter = 'blur(3px)'; bx.drawImage(a, 0, 0);
    ctx.globalAlpha = 0.5; ctx.drawImage(b, 0, 0, this.canvas.width, this.canvas.height);
    bx.filter = 'blur(10px)'; bx.drawImage(a, 0, 0); bx.filter = 'none';
    ctx.globalAlpha = 0.42; ctx.drawImage(b, 0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- helpers
function flightTime(rt: { sx: number; sy: number; nx: number; ny: number }) {
  return 0.75 + Math.min(1.0, Math.hypot(rt.nx - rt.sx, rt.ny - rt.sy) / 1100);
}
function anvilBody(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(466, 505); ctx.bezierCurveTo(492, 499, 512, 497, 536, 497);
  ctx.lineTo(784, 497); ctx.lineTo(784, 521); ctx.lineTo(772, 527);
  ctx.bezierCurveTo(726, 530, 700, 537, 694, 557); ctx.lineTo(692, 580);
  ctx.bezierCurveTo(700, 592, 724, 598, 742, 600); ctx.lineTo(742, 612); ctx.lineTo(538, 612); ctx.lineTo(538, 600);
  ctx.bezierCurveTo(556, 598, 580, 592, 588, 580); ctx.lineTo(586, 557);
  ctx.bezierCurveTo(580, 538, 560, 531, 530, 528); ctx.bezierCurveTo(504, 525, 482, 516, 466, 505);
  ctx.closePath();
}
function anvilTop(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(466, 505); ctx.bezierCurveTo(490, 495, 512, 489, 538, 489);
  ctx.lineTo(778, 489); ctx.lineTo(784, 497); ctx.lineTo(536, 497);
  ctx.bezierCurveTo(512, 497, 492, 499, 466, 505);
  ctx.closePath();
}
function ingot(ctx: CanvasRenderingContext2D, x: number, yb: number, w: number, heat: number, sc: number, alpha: number) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, yb); ctx.scale(sc, sc);
  const h = w * 0.36; const hw = w / 2;
  ctx.shadowColor = rgba(...mix(GOLD, [255, 150, 60], heat), 0.6 + 0.3 * heat); ctx.shadowBlur = 14 + 18 * heat;
  ctx.beginPath(); ctx.moveTo(-hw + 6, -h); ctx.lineTo(hw - 6, -h); ctx.lineTo(hw, 0); ctx.lineTo(-hw, 0); ctx.closePath();
  const g = ctx.createLinearGradient(0, -h, 0, 0);
  g.addColorStop(0, rgbStr(mix([255, 238, 170], [255, 252, 240], heat)));
  g.addColorStop(0.45, rgbStr(mix([236, 182, 72], [255, 214, 140], heat)));
  g.addColorStop(1, rgbStr(mix([150, 100, 34], [255, 130, 50], heat)));
  ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(70,36,6,0.65)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-hw + 9, -h - 4); ctx.lineTo(hw - 4, -h - 4); ctx.lineTo(hw - 6, -h); ctx.lineTo(-hw + 6, -h); ctx.closePath();
  ctx.fillStyle = rgbStr(mix([255, 236, 176], [255, 255, 245], heat)); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-hw + 8, -h, w - 16, 0.8);
  ctx.font = `800 ${Math.max(7, w * 0.17)}px ui-monospace, monospace`; ctx.textAlign = 'center';
  ctx.fillStyle = rgba(...mix([84, 52, 12], [160, 70, 20], heat), 0.85); ctx.fillText('FIND', 1, -h * 0.3);
  ctx.restore();
}
function steam(ctx: CanvasRenderingContext2D, x: number, y: number, t0: number, t: number, n: number, spread: number, rise: number, scale: number) {
  const tau0 = t - t0; if (tau0 < 0 || tau0 > 2.2) return;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i += 1) {
    const tau = tau0 - i * 0.025; if (tau < 0 || tau > 1.6) continue;
    const k = tau / 1.6; const sw = Math.sin(i * 2.17 + tau * 2.2);
    const px = x + (i - n / 2) * (spread / n) * 2 * easeOut2(k) + sw * 10 * k; const py = y - easeOut2(k) * rise - i * 0.6;
    const r = (5 + k * 24) * scale; const a = 0.2 * Math.pow(1 - k, 1.4) * clamp(tau / 0.08);
    const g = ctx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, rgba(236, 232, 228, a)); g.addColorStop(1, 'rgba(236,232,228,0)');
    ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }
  ctx.restore();
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c0: RGB, c1: RGB, a: number) {
  if (a <= 0 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(...c0, a)); g.addColorStop(0.35, rgba(...c1, a * 0.45)); g.addColorStop(1, rgba(...c1, 0));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
function bez(p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number, u: number): Pt {
  const m = 1 - u; return [m * m * p0x + 2 * m * u * p1x + u * u * p2x, m * m * p0y + 2 * m * u * p1y + u * u * p2y];
}
function sampleCubic(out: Pt[], p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number) {
  for (let k = out.length ? 1 : 0; k <= n; k += 1) {
    const u = k / n; const v = 1 - u;
    out.push([v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]]);
  }
}
function sampleQuad(out: Pt[], p0: Pt, p1: Pt, p2: Pt, n: number) {
  for (let k = out.length ? 1 : 0; k <= n; k += 1) out.push(bez(p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], k / n));
}
function makeBurst(n: number, seed: number) {
  const r = mulberry32(777 + seed * 31);
  return Array.from({ length: n }, () => {
    const a = -Math.PI * (0.04 + 0.92 * r()) + (r() < 0.12 ? Math.PI * (r() * 0.25) : 0);
    const sp = 220 + Math.pow(r(), 0.7) * 820;
    return { vx: Math.cos(a) * sp * 1.25, vy: Math.sin(a) * sp, life: 0.35 + r() * 0.75 };
  });
}
function makeAmbient(n: number) {
  const r = mulberry32(99);
  return Array.from({ length: n }, () => ({ x: (r() - 0.5) * (r() < 0.6 ? 0.45 : 1), ph: r(), life: 4 + r() * 5, sway: 6 + r() * 22, f: r() * 9, z: r(), sz: 0.8 + r() * 1.5 }));
}
function makeBokeh() {
  const r = mulberry32(5);
  const spots: [number, number][] = [[-0.86, 0.1], [0.86, 0.05], [-0.76, 0.85], [0.8, 0.75], [-0.5, 1.1], [0.53, 1.05], [-0.95, 0.5], [0.94, 0.45], [-0.34, -0.15], [0.34, -0.18]];
  return spots.map(([x, y]) => ({ x, y, r: 18 + r() * 46, a: 0.03 + r() * 0.06, ph: r() * 6.28, sp: 4 + r() * 8 }));
}
/** Periodic fbm smoke texture (tiny, generated once). */
function makeNoise(size: number, seed: number): HTMLCanvasElement | undefined {
  if (typeof document === 'undefined') return undefined;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  if (!x) return undefined;
  const r = mulberry32(seed);
  const img = x.createImageData(size, size);
  const oct = [[4, 0.5], [8, 0.27], [16, 0.14], [32, 0.09]].map(([p, a]) => { const g = new Float32Array(p * p); for (let i = 0; i < g.length; i += 1) g[i] = r(); return { p, a, g }; });
  const sm = (u: number) => u * u * (3 - 2 * u);
  for (let y = 0; y < size; y += 1) for (let xx = 0; xx < size; xx += 1) {
    let v = 0;
    for (const o of oct) {
      const fx = (xx / size) * o.p; const fy = (y / size) * o.p; const ix = Math.floor(fx); const iy = Math.floor(fy); const tx = sm(fx - ix); const ty = sm(fy - iy);
      const at = (i: number, j: number) => o.g[(((j % o.p) + o.p) % o.p) * o.p + (((i % o.p) + o.p) % o.p)];
      const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx; const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
      v += o.a * (top + (bottom - top) * ty);
    }
    const a = clamp((v - 0.42) * 2.6); const k = (y * size + xx) * 4;
    img.data[k] = 230; img.data[k + 1] = 178; img.data[k + 2] = 140; img.data[k + 3] = a * a * 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash01(value: string) { let h = 2166136261; for (let i = 0; i < value.length; i += 1) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; }
function clamp(v: number, a = 0, b = 1) { return v < a ? a : v > b ? b : v; }
function easeOut(u: number) { return 1 - Math.pow(1 - clamp(u), 3); }
function easeOut2(u: number) { return 1 - Math.pow(1 - clamp(u), 2); }
function easeInOut(u: number) { const x = clamp(u); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
function mix(a: RGB, b: RGB, k: number): RGB { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
function rgbStr(c: RGB) { return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; }
function rgba(r: number, g: number, b: number, a: number) { return `rgba(${r | 0},${g | 0},${b | 0},${a < 0 ? 0 : a > 1 ? 1 : a.toFixed(3)})`; }
