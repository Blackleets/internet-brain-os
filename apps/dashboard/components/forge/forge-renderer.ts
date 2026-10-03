/**
 * Canvas renderer for the Forge live view (anvil, sparks, molten threads, steel, ash, hammer,
 * ingots). It only draws what the scene spec says: one thread per real Kernel source, gold steel
 * only for Kernel SUPPORT, ash only for a real "no SUPPORT" verdict, one ingot per SUPPORT Find.
 *
 * Motion rules: transitions play when a source state changes (or once on first paint, in pipeline
 * order and all sources together per stage — never as fake per-page progress). Ambient motion runs
 * only while the mission is active. Reduced motion draws the final state once. The loop pauses
 * when the tab is hidden or the canvas is off screen, and particles are capped (lower on mobile).
 */
export type SceneThreadState = 'candidate' | 'read_failed' | 'evidence' | 'supported' | 'unsupported';
export type SceneMode = 'offline' | 'empty' | 'active' | 'settled';

export type SceneThread = {
  id: string;
  state: SceneThreadState;
  /** Card anchor in CSS px relative to the canvas. */
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
  mode: SceneMode;
};

type Pt = [number, number];
type ThreadRuntime = {
  id: string;
  state: SceneThreadState;
  bornAt: number;
  evidenceAt: number;
  verdictAt: number;
  phase: number;
  pts: Pt[];
  cum: number[];
  len: number;
  geoKey: string;
};
type Strike = { at: number; slot: number };
type Burst = { at: number; parts: { vx: number; vy: number; life: number }[] };

const SPARK_FLIGHT = 0.9;
const THREAD_DRAW = 0.8;
const TEMPER = 0.6;
const COOL = 1.1;
const STRIKE_GAP = 0.55;

const EMBER: [number, number, number] = [238, 135, 72];
const GOLD: [number, number, number] = [245, 196, 81];
const ASH: [number, number, number] = [112, 106, 101];
const WHITE_HOT: [number, number, number] = [255, 244, 214];

export class ForgeRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private spec: SceneSpec | undefined;
  private threads = new Map<string, ThreadRuntime>();
  private strikes: Strike[] = [];
  private bursts: Burst[] = [];
  private raf = 0;
  private running = false;
  private visible = true;
  private onScreen = true;
  private lastFrame = 0;
  private epoch = performance.now() / 1000;
  private firstSpec = true;
  private dpr = 1;
  private readonly reducedMotion: () => boolean;

  constructor(private readonly canvas: HTMLCanvasElement, options: { reducedMotion: () => boolean }) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    this.reducedMotion = options.reducedMotion;
  }

  private now(): number { return performance.now() / 1000 - this.epoch; }

  update(spec: SceneSpec) {
    const t = this.now();
    const narrow = spec.layout === 'narrow';
    this.dpr = Math.min(window.devicePixelRatio || 1, narrow ? 2 : 2);
    const w = Math.max(1, Math.round(spec.width * this.dpr));
    const h = Math.max(1, Math.round(spec.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const first = this.firstSpec;
    this.firstSpec = false;
    const next = new Map<string, ThreadRuntime>();
    let supportedIndex = 0;
    const strikeBase = Math.max(t + (first ? 2.0 : 0.2), (this.strikes.at(-1)?.at ?? -Infinity) + STRIKE_GAP);
    spec.threads.forEach((thread, index) => {
      const previous = this.threads.get(thread.id);
      const geoKey = `${spec.layout}:${Math.round(spec.anvil.x)}:${Math.round(spec.anvil.y)}:${Math.round(thread.ax)}:${Math.round(thread.ay)}:${thread.lane}`;
      const path = previous && previous.geoKey === geoKey ? previous : { ...this.path(spec, thread), geoKey };
      const born = previous?.bornAt ?? t + (first ? Math.min(index * 0.035, 0.35) : 0);
      const hasEvidence = thread.state === 'evidence' || thread.state === 'supported' || thread.state === 'unsupported';
      const prevEvidence = previous && (previous.state === 'evidence' || previous.state === 'supported' || previous.state === 'unsupported');
      const evidenceAt = hasEvidence
        ? (prevEvidence ? previous.evidenceAt : Math.max(born + SPARK_FLIGHT, t + (first ? 1.0 : 0)))
        : Infinity;
      let verdictAt = Infinity;
      if (thread.state === 'supported' || thread.state === 'unsupported' || thread.state === 'read_failed') {
        if (previous && previous.state === thread.state) verdictAt = previous.verdictAt;
        else if (thread.state === 'supported') {
          verdictAt = Math.max(evidenceAt + THREAD_DRAW + 0.15, strikeBase + supportedIndex * STRIKE_GAP);
          this.strikes.push({ at: verdictAt, slot: this.strikes.length });
          this.bursts.push({ at: verdictAt, parts: makeBurst(narrow ? 16 : 34, this.strikes.length) });
          supportedIndex += 1;
        } else if (thread.state === 'unsupported') verdictAt = Math.max(evidenceAt + THREAD_DRAW + 0.15, t + (first ? 2.0 : 0.2));
        else verdictAt = Math.max(born + SPARK_FLIGHT, t + (first ? 1.0 : 0));
      }
      next.set(thread.id, { id: thread.id, state: thread.state, bornAt: born, evidenceAt, verdictAt, phase: hash01(thread.id), ...path });
    });
    this.threads = next;
    const supportedCount = spec.threads.filter((item) => item.state === 'supported').length;
    // Ingots track the real SUPPORT count (a dropped Find removes its ingot).
    this.strikes = this.strikes.slice(0, Math.max(supportedCount, 0)).map((strike, slot) => ({ ...strike, slot }));
    this.bursts = this.bursts.slice(-6);
    this.spec = spec;
    if (this.reducedMotion()) { this.stop(); this.drawFrame(Infinity); return; }
    this.drawFrame(this.now());
    this.ensureLoop();
  }

  setVisibility(visible: boolean) { this.visible = visible; this.ensureLoop(); }
  setOnScreen(onScreen: boolean) { this.onScreen = onScreen; this.ensureLoop(); }

  destroy() { this.stop(); this.threads.clear(); }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Static final frame (reduced motion, tests, screenshots). */
  drawFinal() { this.drawFrame(Infinity); }

  private ensureLoop() {
    const shouldRun = Boolean(this.spec) && this.visible && this.onScreen && !this.reducedMotion() && this.needsMotion();
    if (shouldRun && !this.running) {
      this.running = true;
      const tick = (ms: number) => {
        if (!this.running) return;
        const narrow = this.spec?.layout === 'narrow';
        // ~30 fps on narrow screens, display rate elsewhere.
        if (!narrow || ms - this.lastFrame > 31) {
          this.lastFrame = ms;
          this.drawFrame(this.now());
        }
        if (!this.needsMotion()) { this.running = false; this.raf = 0; this.drawFrame(this.now()); return; }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    } else if (!shouldRun && this.running) {
      this.stop();
    }
  }

  private needsMotion(): boolean {
    if (!this.spec) return false;
    if (this.spec.mode === 'active') return true;
    if (this.spec.mode === 'offline' || this.spec.mode === 'empty') return false;
    const t = this.now();
    let last = 0;
    for (const thread of this.threads.values()) {
      for (const value of [thread.bornAt + SPARK_FLIGHT, thread.evidenceAt + THREAD_DRAW, thread.verdictAt + COOL + 0.4]) {
        if (Number.isFinite(value)) last = Math.max(last, value);
      }
    }
    for (const strike of this.strikes) last = Math.max(last, strike.at + 2.2);
    return t < last;
  }

  // ---------------------------------------------------------------- geometry
  private path(spec: SceneSpec, thread: SceneThread): { pts: Pt[]; cum: number[]; len: number } {
    const { x: AX, y: AY, scale } = spec.anvil;
    const pts: Pt[] = [];
    if (spec.layout === 'wide') {
      const dir = thread.side === 'left' ? -1 : 1;
      const sx = AX + dir * (14 + (thread.lane % 4) * 7) * scale;
      const sy = AY - 4 * scale;
      const c1: Pt = [sx + dir * 30 * scale, sy - 70 * scale - (thread.lane % 3) * 10];
      const c2: Pt = [thread.ax - dir * Math.min(120, Math.abs(thread.ax - sx) * 0.45), thread.ay];
      sampleCubic(pts, [sx, sy], c1, c2, [thread.ax, thread.ay], 56);
    } else {
      const laneX = 9 + Math.min(thread.lane, 7) * 3.2;
      const sx = AX - 10 * scale + (thread.lane % 4) * 5;
      const sy = AY + 6 * scale;
      const turnY = AY + 70 * scale;
      sampleCubic(pts, [sx, sy], [sx, sy + 40 * scale], [laneX, turnY - 40 * scale], [laneX, turnY], 22);
      const hookY = Math.max(turnY + 1, thread.ay - 18);
      const steps = Math.max(2, Math.ceil((hookY - turnY) / 18));
      for (let k = 1; k <= steps; k += 1) pts.push([laneX, turnY + ((hookY - turnY) * k) / steps]);
      sampleQuad(pts, [laneX, hookY], [laneX, thread.ay], [thread.ax, thread.ay], 10);
    }
    const cum = [0];
    for (let k = 1; k < pts.length; k += 1) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    return { pts, cum, len: cum.at(-1) ?? 0 };
  }

  private at(thread: ThreadRuntime, u: number): Pt {
    const target = clamp(u) * thread.len;
    let lo = 0;
    let hi = thread.cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (thread.cum[mid] < target) lo = mid + 1; else hi = mid; }
    const k = Math.max(1, lo);
    const seg = thread.cum[k] - thread.cum[k - 1] || 1;
    const f = (target - thread.cum[k - 1]) / seg;
    const a = thread.pts[k - 1];
    const b = thread.pts[k] ?? a;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }

  private slice(thread: ThreadRuntime, u0: number, u1: number): Pt[] {
    const out: Pt[] = [this.at(thread, u0)];
    const a = clamp(u0) * thread.len;
    const b = clamp(u1) * thread.len;
    for (let k = 0; k < thread.pts.length; k += 1) if (thread.cum[k] > a && thread.cum[k] < b) out.push(thread.pts[k]);
    out.push(this.at(thread, u1));
    return out;
  }

  // ---------------------------------------------------------------- frame
  private drawFrame(t: number) {
    const spec = this.spec;
    if (!spec) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, spec.width, spec.height);
    const settled = !Number.isFinite(t);
    const time = settled ? 1000 : t;
    const supported = [...this.threads.values()].filter((item) => item.state === 'supported').length;
    const heat = spec.mode === 'active' ? 0.75 + 0.25 * Math.sin(time * 2.2) : spec.mode === 'settled' ? (supported ? 0.55 : 0.28) : spec.mode === 'empty' ? 0.16 : 0.02;
    const strikeFlash = this.strikeFlash(time, settled);
    this.drawFire(spec, heat + strikeFlash * 0.6, supported > 0 && spec.mode === 'settled');
    for (const thread of this.threads.values()) this.drawThread(spec, thread, time, settled);
    this.drawAnvil(spec, heat, strikeFlash);
    if (!settled) this.drawHammer(spec, time);
    if (!settled) this.drawBursts(spec, time);
    if (spec.tray) this.drawTrayAndIngots(spec, time, settled);
  }

  private strikeFlash(t: number, settled: boolean): number {
    if (settled) return 0;
    let flash = 0;
    for (const strike of this.strikes) if (t >= strike.at) flash = Math.max(flash, Math.exp(-(t - strike.at) / 0.18));
    return flash;
  }

  private drawFire(spec: SceneSpec, heat: number, gold: boolean) {
    const ctx = this.ctx;
    const { x, y, scale } = spec.anvil;
    const r = (spec.layout === 'wide' ? 330 : 210) * scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    let g = ctx.createRadialGradient(x, y, 4, x, y, r);
    const tint = gold ? [255, 196, 96] : [255, 120, 46];
    g.addColorStop(0, rgba(255, 230, 190, 0.22 * heat));
    g.addColorStop(0.18, rgba(tint[0], tint[1], tint[2], 0.18 * heat));
    g.addColorStop(0.55, rgba(150, 56, 20, 0.08 * heat));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    // floor reflection
    ctx.translate(x, y + 120 * scale);
    ctx.scale(1, 0.16);
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, rgba(255, 140, 60, 0.16 * heat));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawThread(spec: SceneSpec, th: ThreadRuntime, t: number, settled: boolean) {
    const ctx = this.ctx;
    const active = spec.mode === 'active';
    const flight = settled ? 1 : clamp((t - th.bornAt) / SPARK_FLIGHT);
    if (flight <= 0) return;
    const end = th.pts.at(-1) ?? [0, 0];
    if (flight < 1) {
      this.drawSpark(th, easeOut(flight));
      return;
    }
    if (th.state === 'candidate') {
      this.dotted(this.slice(th, 0, 1), rgba(...EMBER, 0.34), 1.1, [1.5, 6]);
      if (active) {
        // Mission-level "verificando": every pending candidate shimmers in the same phase.
        const u = (t * 0.32) % 1;
        const [qx, qy] = this.at(th, u);
        glow(ctx, qx, qy, 7, [255, 236, 200], [255, 140, 60], 0.55 * Math.sin(u * Math.PI));
      }
      this.node(end, EMBER, 0.5 + (active ? 0.2 * Math.sin(t * 3) : 0), 7);
      return;
    }
    if (th.state === 'read_failed') {
      const k = settled ? 1 : clamp((t - th.verdictAt) / 0.6);
      this.dotted(this.slice(th, 0, 1), rgba(...mix(EMBER, ASH, k), 0.3), 1, [1.5, 6]);
      this.node(end, mix(EMBER, ASH, k), 0.45, 5);
      return;
    }
    const drawn = settled ? 1 : clamp((t - th.evidenceAt) / THREAD_DRAW);
    if (drawn <= 0) {
      this.dotted(this.slice(th, 0, 1), rgba(...EMBER, 0.34), 1.1, [1.5, 6]);
      this.node(end, EMBER, 0.6, 7);
      return;
    }
    const fe = easeInOut(drawn);
    if (th.state === 'supported') {
      const w = settled ? 1 : clamp((t - th.verdictAt) / TEMPER);
      const flash = settled ? 0 : clamp(1 - (t - th.verdictAt) / 0.5) * (t >= th.verdictAt ? 1 : 0);
      if (w > 0) this.steel(th, this.slice(th, 0, Math.min(w, fe)), t, flash, settled);
      if (w < fe) this.molten(th, this.slice(th, w, fe), t, 1);
      if (w > 0 && w < 1) { const [wx, wy] = this.at(th, w); glow(ctx, wx, wy, 24, [255, 255, 245], [255, 214, 120], 1); }
      this.node(end, w >= 1 ? GOLD : EMBER, 0.95, w >= 1 ? 12 : 9);
      if (w >= 1) { ctx.save(); ctx.strokeStyle = rgba(255, 220, 140, 0.75); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(end[0], end[1], 5.5, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    } else if (th.state === 'unsupported') {
      const c = settled ? 1 : clamp((t - th.verdictAt) / COOL);
      if (c < 1) this.molten(th, this.slice(th, 0, fe), t, (1 - c) * (1 - c));
      if (c > 0) this.ash(this.slice(th, 0, fe), c);
      this.node(end, mix(EMBER, ASH, c), 0.8 - 0.4 * c, 7);
    } else {
      this.molten(th, this.slice(th, 0, fe), t, 1);
      this.node(end, EMBER, 0.85, 9);
    }
    if (drawn < 1) { const [hx, hy] = this.at(th, fe); glow(ctx, hx, hy, 16, [255, 250, 230], [255, 140, 50], 1); }
  }

  private drawSpark(th: ThreadRuntime, u: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const lag = [0, 0.05, 0.11, 0.19];
    const cols: [number, number, number][] = [[255, 248, 226], [255, 200, 124], [255, 134, 58]];
    for (let s = 0; s < 3; s += 1) {
      const a = this.at(th, Math.max(0, u - lag[s]));
      const b = this.at(th, Math.max(0, u - lag[s + 1]));
      ctx.strokeStyle = rgba(...cols[s], [0.95, 0.55, 0.25][s]);
      ctx.lineWidth = [1.8, 1.3, 0.9][s];
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    const [hx, hy] = this.at(th, u);
    glow(ctx, hx, hy, 6, [255, 252, 240], [255, 160, 70], 0.9);
    ctx.restore();
  }

  private stroke(pts: Pt[]) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k += 1) ctx.lineTo(pts[k][0], pts[k][1]);
  }

  private dotted(pts: Pt[], color: string, width: number, dash: number[]) {
    const ctx = this.ctx;
    ctx.save(); ctx.lineCap = 'round'; ctx.setLineDash(dash); this.stroke(pts); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.restore();
  }

  private molten(th: ThreadRuntime, pts: Pt[], t: number, k: number) {
    if (pts.length < 2 || k <= 0) return;
    const ctx = this.ctx;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    this.stroke(pts); ctx.strokeStyle = rgba(255, 92, 24, 0.18 * k); ctx.lineWidth = 9; ctx.stroke();
    this.stroke(pts); ctx.strokeStyle = rgba(255, 110, 36, 0.28 * k); ctx.lineWidth = 4.5; ctx.stroke();
    this.stroke(pts); ctx.strokeStyle = rgba(255, 150, 60, 0.92 * k); ctx.lineWidth = 2.2; ctx.stroke();
    ctx.setLineDash([2, 9]); ctx.lineDashOffset = -(t * 90 + th.phase * 60); this.stroke(pts); ctx.strokeStyle = rgba(255, 246, 214, 0.75 * k); ctx.lineWidth = 1.6; ctx.stroke();
    ctx.setLineDash([11, 27]); ctx.lineDashOffset = -(t * 55 + th.phase * 110); this.stroke(pts); ctx.strokeStyle = rgba(255, 196, 110, 0.42 * k); ctx.lineWidth = 3.2; ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private steel(th: ThreadRuntime, pts: Pt[], t: number, flash: number, settled: boolean) {
    if (pts.length < 2) return;
    const ctx = this.ctx;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalCompositeOperation = 'lighter';
    this.stroke(pts); ctx.strokeStyle = rgba(245, 196, 81, 0.17 + flash * 0.3); ctx.lineWidth = 10 + flash * 8; ctx.stroke();
    this.stroke(pts); ctx.strokeStyle = rgba(255, 214, 120, 0.24); ctx.lineWidth = 4.5; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    const a = pts[0];
    const b = pts.at(-1) ?? a;
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, 'rgb(196,146,58)'); g.addColorStop(0.5, 'rgb(246,204,110)'); g.addColorStop(1, 'rgb(255,226,150)');
    this.stroke(pts); ctx.strokeStyle = g; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    this.stroke(pts); ctx.strokeStyle = 'rgba(255,250,232,0.85)'; ctx.lineWidth = 0.9; ctx.stroke();
    if (!settled) {
      const L = th.len;
      ctx.setLineDash([28, L + 400]); ctx.lineDashOffset = -((t * 170 + th.phase * 300) % (L + 430)) + 28;
      this.stroke(pts); ctx.strokeStyle = 'rgba(255,255,245,0.7)'; ctx.lineWidth = 2.1; ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  private ash(pts: Pt[], k: number) {
    if (pts.length < 2) return;
    const ctx = this.ctx;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash([5, 4]);
    this.stroke(pts); ctx.strokeStyle = rgba(70, 66, 63, 0.85 * k); ctx.lineWidth = 2.4; ctx.stroke();
    this.stroke(pts); ctx.strokeStyle = rgba(150, 143, 137, 0.6 * k); ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  private node(p: Pt, color: [number, number, number], a: number, r: number) {
    const ctx = this.ctx;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, p[0], p[1], r * 2.2, mix(WHITE_HOT, color, 0.35), color, a);
    ctx.restore();
    ctx.fillStyle = rgba(...mix(WHITE_HOT, color, 0.5), Math.min(1, a + 0.2));
    ctx.beginPath(); ctx.arc(p[0], p[1], 2.3, 0, Math.PI * 2); ctx.fill();
  }

  // ---------------------------------------------------------------- anvil
  private drawAnvil(spec: SceneSpec, heatIn: number, flash: number) {
    const ctx = this.ctx;
    const { x: AX, y: AY, scale } = spec.anvil;
    const heat = clamp(heatIn);
    const cold = spec.mode === 'offline';
    ctx.save();
    ctx.translate(AX, AY);
    ctx.scale(scale, scale);
    ctx.translate(-640, -485);
    // ground shadow
    ctx.save(); ctx.translate(640, 652); ctx.scale(1, 0.09);
    let g = ctx.createRadialGradient(0, 0, 0, 0, 0, 220); g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 220, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // pedestal
    g = ctx.createLinearGradient(0, 612, 0, 652); g.addColorStop(0, '#24201d'); g.addColorStop(1, '#0d0c0b');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(560, 612); ctx.lineTo(720, 612); ctx.lineTo(728, 652); ctx.lineTo(552, 652); ctx.closePath(); ctx.fill();
    // body
    anvilBody(ctx);
    g = ctx.createLinearGradient(0, 497, 0, 612);
    g.addColorStop(0, cold ? '#2a2a2c' : '#332c28'); g.addColorStop(0.18, cold ? '#1b1b1d' : '#1f1b19'); g.addColorStop(0.6, '#141313'); g.addColorStop(1, '#0c0b0b');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); anvilBody(ctx); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    g = ctx.createRadialGradient(640, 492, 0, 640, 500, 190);
    g.addColorStop(0, rgba(255, 130, 50, 0.3 * heat + (cold ? 0 : 0.05))); g.addColorStop(0.5, rgba(200, 80, 30, 0.08 * heat)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(460, 495, 330, 120);
    ctx.restore();
    ctx.save(); anvilBody(ctx);
    g = ctx.createLinearGradient(0, 497, 0, 612);
    g.addColorStop(0, cold ? 'rgba(160,160,170,0.35)' : rgba(255, 160, 90, 0.5 + 0.3 * heat)); g.addColorStop(0.35, rgba(255, 120, 60, cold ? 0.03 : 0.12)); g.addColorStop(1, 'rgba(255,120,60,0.03)');
    ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    // face
    anvilTop(ctx);
    g = ctx.createLinearGradient(0, 489, 0, 497); g.addColorStop(0, cold ? '#4a4a4e' : '#5a4e46'); g.addColorStop(1, '#2d2622');
    ctx.fillStyle = g; ctx.fill();
    g = ctx.createLinearGradient(536, 0, 784, 0);
    g.addColorStop(0, 'rgba(255,200,150,0.1)'); g.addColorStop(0.42, rgba(255, 226, 180, cold ? 0.15 : 0.45 + 0.4 * heat)); g.addColorStop(1, 'rgba(255,200,150,0.12)');
    ctx.fillStyle = g; ctx.fillRect(536, 496.5, 248, 1);
    // hot bar "KERNEL · GOAL"
    if (!cold) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const core = mix(WHITE_HOT, [255, 250, 235], flash);
      const r = 80 + heat * 90 + flash * 60;
      g = ctx.createRadialGradient(640, 485, 2, 640, 485, r);
      g.addColorStop(0, rgba(...core, 0.85 * heat + 0.1)); g.addColorStop(0.12, rgba(255, 180, 90, 0.5 * heat)); g.addColorStop(0.4, rgba(235, 100, 35, 0.14)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(640, 485, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.shadowColor = 'rgba(255,140,50,0.95)'; ctx.shadowBlur = 14 + heat * 16;
      g = ctx.createLinearGradient(584, 0, 696, 0);
      g.addColorStop(0, '#9c3a10'); g.addColorStop(0.22, '#ff7a2a'); g.addColorStop(0.5, `rgb(${core.map((v) => v | 0).join(',')})`); g.addColorStop(0.78, '#ff7a2a'); g.addColorStop(1, '#9c3a10');
      ctx.globalAlpha = 0.35 + 0.65 * heat;
      ctx.fillStyle = g; roundRect(ctx, 584, 480, 112, 10, 4); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,240,0.7)'; ctx.fillRect(600, 481, 80, 1);
      ctx.restore();
    } else {
      ctx.fillStyle = '#3a3a3e'; roundRect(ctx, 584, 480, 112, 10, 4); ctx.fill();
    }
    ctx.restore();
  }

  private drawHammer(spec: SceneSpec, t: number) {
    if (!this.strikes.length) return;
    const first = this.strikes[0].at;
    const last = this.strikes.at(-1)!.at;
    const t0 = first - 0.8;
    const t1 = last + 0.95;
    if (t < t0 || t > t1) return;
    const alpha = clamp((t - t0) / 0.3) * (1 - clamp((t - (t1 - 0.35)) / 0.35));
    const restTh = (208.6 * Math.PI) / 180;
    const strikeTh = (160 * Math.PI) / 180;
    let th = restTh;
    for (const { at: s } of this.strikes) {
      if (t >= s - 0.42 && t < s - 0.13) th = restTh + 0.13 * easeInOut((t - (s - 0.42)) / 0.29);
      else if (t >= s - 0.13 && t < s) { const u = (t - (s - 0.13)) / 0.13; th = restTh + 0.13 + (strikeTh - restTh - 0.13) * u * u * u; }
      else if (t >= s && t < s + 0.55) th = strikeTh + (restTh - strikeTh) * easeOut((t - s) / 0.55);
    }
    let faceHeat = 0;
    for (const { at: s } of this.strikes) if (t >= s) faceHeat = Math.max(faceHeat, Math.exp(-(t - s) / 0.22));
    const ctx = this.ctx;
    const { x: AX, y: AY } = spec.anvil;
    const s = spec.anvil.scale * (spec.layout === 'narrow' ? 0.82 : 1);
    ctx.save();
    ctx.translate(AX, AY);
    ctx.scale(s, s);
    const HP = { x: 210.5, y: -120 };
    const HR = 240;
    const hx = HP.x + HR * Math.cos(th);
    const hy = HP.y + HR * Math.sin(th);
    const rx = (HP.x - hx) / HR; const ry = (HP.y - hy) / HR; const tx = Math.sin(th); const ty = -Math.cos(th);
    ctx.transform(tx, ty, rx, ry, hx, hy);
    ctx.globalAlpha = alpha;
    let g = ctx.createLinearGradient(-6, 0, 6, 0);
    g.addColorStop(0, '#24160d'); g.addColorStop(0.35, '#7d5636'); g.addColorStop(0.62, '#4d311d'); g.addColorStop(1, '#1c1109');
    ctx.fillStyle = g;
    for (let k = 0; k < 12; k += 1) {
      const y0 = 14 + k * 12; const y1 = y0 + 12.5; const a = k < 6 ? 1 : 1 - (k - 5) / 7;
      const w0 = 4 + (y0 / 150) * 1.6; const w1 = 4 + (y1 / 150) * 1.6;
      ctx.globalAlpha = alpha * a; ctx.beginPath(); ctx.moveTo(-w0, y0); ctx.lineTo(w0, y0); ctx.lineTo(w1, y1); ctx.lineTo(-w1, y1); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#121112'; ctx.fillRect(-6.5, 12, 13, 6);
    const head = () => { ctx.beginPath(); ctx.moveTo(-32, -14); ctx.lineTo(32, -14); ctx.lineTo(37, -9); ctx.lineTo(37, 9); ctx.lineTo(32, 14); ctx.lineTo(-32, 14); ctx.lineTo(-37, 9); ctx.lineTo(-37, -9); ctx.closePath(); };
    head();
    g = ctx.createLinearGradient(0, -14, 0, 14);
    g.addColorStop(0, '#7e838b'); g.addColorStop(0.12, '#464a51'); g.addColorStop(0.5, '#25272b'); g.addColorStop(0.85, '#141517'); g.addColorStop(1, '#2e2622');
    ctx.fillStyle = g; ctx.fill();
    if (faceHeat > 0.01) {
      ctx.save(); head(); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
      g = ctx.createRadialGradient(37, 0, 0, 37, 0, 44); g.addColorStop(0, rgba(255, 240, 200, faceHeat)); g.addColorStop(0.4, rgba(255, 140, 50, faceHeat * 0.6)); g.addColorStop(1, 'rgba(255,100,30,0)');
      ctx.fillStyle = g; ctx.fillRect(-8, -16, 46, 32); ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-31, -13.2, 62, 0.8);
    ctx.fillStyle = rgba(255, 160, 90, 0.5); ctx.fillRect(-31, 13, 62, 0.8);
    ctx.restore();
    // shock ring on contact
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const { at: st } of this.strikes) {
      const u = (t - st) / 0.8; if (u < 0 || u > 1) continue;
      const r = (14 + 300 * easeOut(u)) * spec.anvil.scale; const a = Math.pow(1 - u, 1.6);
      ctx.save(); ctx.translate(AX, AY + 6); ctx.scale(1, 0.3);
      ctx.strokeStyle = rgba(255, 232, 180, 0.6 * a); ctx.lineWidth = 1.5 + 3.5 * (1 - u); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      if (u < 0.2) glow(ctx, AX, AY - 2, 60 * (1 - u * 2), [255, 255, 250], [255, 200, 120], 0.8 * (1 - u / 0.2));
    }
    ctx.restore();
  }

  private drawBursts(spec: SceneSpec, t: number) {
    const ctx = this.ctx;
    const { x: AX, y: AY, scale } = spec.anvil;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const burst of this.bursts) {
      const tau0 = t - burst.at; if (tau0 < 0 || tau0 > 1.2) continue;
      for (const p of burst.parts) {
        if (tau0 > p.life) continue;
        const pos = (tau: number): Pt => { const e = (1 - Math.exp(-2.3 * tau)) / 2.3; return [AX + p.vx * e * scale, AY - 4 + (p.vy * e + 0.5 * 900 * tau * tau) * scale]; };
        const u = tau0 / p.life; const p0 = pos(tau0); const p1 = pos(Math.max(0, tau0 - 0.03));
        ctx.strokeStyle = u < 0.4 ? 'rgba(255,250,230,0.95)' : u < 0.7 ? 'rgba(255,214,120,0.8)' : 'rgba(255,150,60,0.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawTrayAndIngots(spec: SceneSpec, t: number, settled: boolean) {
    const tray = spec.tray;
    if (!tray) return;
    const ctx = this.ctx;
    const landed = this.strikes.filter((strike) => settled || t - strike.at > 1.2).length;
    const lit = landed ? clamp(0.4 + (landed / 3) * 0.6) : 0;
    ctx.save();
    let g = ctx.createLinearGradient(0, tray.y, 0, tray.y + 8); g.addColorStop(0, '#3a332d'); g.addColorStop(1, '#221d1a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(tray.x + 8, tray.y); ctx.lineTo(tray.x + tray.w - 8, tray.y); ctx.lineTo(tray.x + tray.w, tray.y + 8); ctx.lineTo(tray.x, tray.y + 8); ctx.closePath(); ctx.fill();
    g = ctx.createLinearGradient(0, tray.y + 8, 0, tray.y + 18); g.addColorStop(0, '#191614'); g.addColorStop(1, '#0d0c0b');
    ctx.fillStyle = g; ctx.fillRect(tray.x, tray.y + 8, tray.w, 10);
    g = ctx.createLinearGradient(tray.x, 0, tray.x + tray.w, 0); g.addColorStop(0, 'rgba(245,196,81,0)'); g.addColorStop(0.5, rgba(245, 196, 81, 0.2 + 0.6 * lit)); g.addColorStop(1, 'rgba(245,196,81,0)');
    ctx.fillStyle = g; ctx.fillRect(tray.x, tray.y + 8, tray.w, 1);
    ctx.restore();
    const slots = Math.max(1, Math.floor((tray.w - 20) / 46));
    const narrow = spec.layout === 'narrow';
    const iw = narrow ? 34 : 44;
    this.strikes.forEach((strike, index) => {
      if (index >= slots) return;
      const sx = tray.x + 14 + iw / 2 + index * (iw + 6);
      const tau = settled ? 99 : t - strike.at;
      if (tau < 0) return;
      const heat = 1 - clamp((tau - 0.05) / 0.5);
      const sc = tau < 0.25 ? 0.55 + 0.45 * easeOut(tau / 0.25) : 1;
      let x = spec.anvil.x; let y = spec.anvil.y - 4;
      const m = clamp((tau - 0.6) / 0.6);
      if (m > 0) { const e = easeInOut(m); x = x + (sx - x) * e; y = y + (tray.y + 3 - y) * e - Math.sin(Math.PI * e) * 60; }
      ingot(ctx, x, y, iw, heat, sc, clamp(tau / 0.08));
    });
  }
}

// ---------------------------------------------------------------- helpers
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
  ctx.shadowColor = rgba(...mix([245, 196, 81], [255, 150, 60], heat), 0.6 + 0.3 * heat); ctx.shadowBlur = 12 + 16 * heat;
  ctx.beginPath(); ctx.moveTo(-hw + 6, -h); ctx.lineTo(hw - 6, -h); ctx.lineTo(hw, 0); ctx.lineTo(-hw, 0); ctx.closePath();
  const g = ctx.createLinearGradient(0, -h, 0, 0);
  g.addColorStop(0, `rgb(${mix([255, 238, 170], [255, 252, 240], heat).map((v) => v | 0).join(',')})`);
  g.addColorStop(0.45, `rgb(${mix([236, 182, 72], [255, 214, 140], heat).map((v) => v | 0).join(',')})`);
  g.addColorStop(1, `rgb(${mix([150, 100, 34], [255, 130, 50], heat).map((v) => v | 0).join(',')})`);
  ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(70,36,6,0.65)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-hw + 9, -h - 4); ctx.lineTo(hw - 4, -h - 4); ctx.lineTo(hw - 6, -h); ctx.lineTo(-hw + 6, -h); ctx.closePath();
  ctx.fillStyle = `rgb(${mix([255, 236, 176], [255, 255, 245], heat).map((v) => v | 0).join(',')})`; ctx.fill();
  ctx.font = `800 ${Math.max(7, w * 0.17)}px ui-monospace, monospace`; ctx.textAlign = 'center';
  ctx.fillStyle = rgba(...mix([84, 52, 12], [160, 70, 20], heat), 0.85); ctx.fillText('FIND', 1, -h * 0.3);
  ctx.restore();
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c0: [number, number, number], c1: [number, number, number], a: number) {
  if (a <= 0 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(...c0, a)); g.addColorStop(0.35, rgba(...c1, a * 0.45)); g.addColorStop(1, rgba(...c1, 0));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
function sampleCubic(out: Pt[], p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number) {
  for (let k = out.length ? 1 : 0; k <= n; k += 1) {
    const u = k / n; const v = 1 - u;
    out.push([
      v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
    ]);
  }
}
function sampleQuad(out: Pt[], p0: Pt, p1: Pt, p2: Pt, n: number) {
  for (let k = 1; k <= n; k += 1) {
    const u = k / n; const v = 1 - u;
    out.push([v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1]]);
  }
}
function makeBurst(n: number, seed: number) {
  const rand = mulberry32(seed * 7919 + 17);
  return Array.from({ length: n }, () => {
    const ang = -Math.PI / 2 + (rand() - 0.5) * 2.6;
    const speed = 160 + rand() * 260;
    return { vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 0.45 + rand() * 0.6 };
  });
}
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash01(value: string) { let h = 2166136261; for (let i = 0; i < value.length; i += 1) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; }
function clamp(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function easeOut(u: number) { return 1 - Math.pow(1 - clamp(u), 3); }
function easeInOut(u: number) { const x = clamp(u); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
function mix(a: [number, number, number], b: [number, number, number], k: number): [number, number, number] { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
function rgba(r: number, g: number, b: number, a: number) { return `rgba(${r | 0},${g | 0},${b | 0},${a < 0 ? 0 : a > 1 ? 1 : a.toFixed(3)})`; }
