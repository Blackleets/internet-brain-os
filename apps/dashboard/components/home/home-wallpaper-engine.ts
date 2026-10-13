/**
 * Home living wallpaper: Efesto's crawler spider wandering behind the minimal home.
 * Purely decorative — no Kernel data, no search, no Finds. It reproduces the forge crawler's look
 * (ember legs with glowing feet, warm-white body, gold ring and eye; same palette as
 * components/forge/forge-crawler-renderer.ts, which stays untouched) with its own tiny behaviour:
 * wander → sometimes weave a short strand → sometimes hunt a fly, catch it, cocoon fades, a new fly
 * arrives later.
 * Perf: one 2D canvas, requestAnimationFrame, DPR capped, no per-frame allocation in the hot path
 * beyond a few small objects, paused while the tab is hidden; reduced motion draws one still frame.
 */
type P = { x: number; y: number };
type RGB = [number, number, number];
const HOT: RGB = [255, 214, 160], GOLD: RGB = [245, 196, 81], LEG: RGB = [255, 170, 100], SILK: RGB = [236, 214, 190];
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (k: number) => k * k * (3 - 2 * k);
const MAX_DPR = 1.5;
const MAX_STRANDS = 220;
const STRAND_LIFE = 150; // seconds a strand lives before it fades
const FADE = 8;

type Strand = { a: P; b: P; born: number; sag: number; dieAt?: number };
type Waypoint = { p: P; lay: boolean };
type Web = { c: P; r: number };
type Fly = { p: P; home: P; phase: number; born: number };
type Cocoon = { p: P; born: number };
type Mode = 'wander' | 'weave' | 'hunt';

export type WallpaperState = { mode: Mode; fly: boolean; catches: number; strands: number; webs: number };

export class HomeWallpaperEngine {
  private ctx: CanvasRenderingContext2D | null;
  private W = 0; private H = 0; private dpr = 1; private mob = false;
  private raf = 0; private last = 0; private t = 0; private running = false;
  private rnd: () => number;
  private p: P = { x: 0, y: 0 }; private heading = 0; private speed = 0; private walk = 0;
  private target: P = { x: 0, y: 0 }; private pauseUntil = 0;
  private mode: Mode = 'wander'; private modeUntil = 0; private weaveFrom: P | null = null;
  private feet: { p: P; from: P; to: P; lift: number }[] = [];
  private strands: Strand[] = [];
  private fly: Fly | null = null; private nextFlyAt = 32; private plan: Waypoint[] = []; private from: P | null = null; private webs: Web[] = []; private restSince = 0; private huntAt = 0; private cocoon: Cocoon | null = null;
  private catches = 0;
  private glowSprite: HTMLCanvasElement | null = null;
  private onVisibility = () => { if (document.hidden) this.stop(); else if (this.animate) this.start(); };
  private animate = true;

  constructor(private canvas: HTMLCanvasElement, seed = 7) {
    let s = seed;
    this.rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    let ctx: CanvasRenderingContext2D | null = null;
    try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
    this.ctx = ctx;
  }

  /** Starts the loop (animate) or draws one still frame (reduced motion). */
  mount(animate: boolean) {
    this.animate = animate;
    this.measure(true);
    if (!this.ctx) return;
    if (!animate) { this.stillFrame(); return; }
    document.addEventListener('visibilitychange', this.onVisibility);
    if (!document.hidden) this.start();
  }
  unmount() { this.stop(); document.removeEventListener('visibilitychange', this.onVisibility); }
  setAnimate(animate: boolean) { if (animate === this.animate) return; this.unmount(); this.mount(animate); }
  get state(): WallpaperState { return { mode: this.mode, fly: Boolean(this.fly), catches: this.catches, strands: this.strands.length, webs: this.webs.length }; }
  get isRunning() { return this.running; }

  measure(reset = false) {
    const r = this.canvas.getBoundingClientRect();
    const W = Math.max(1, Math.round(r.width || this.canvas.clientWidth || 390)), H = Math.max(1, Math.round(r.height || this.canvas.clientHeight || 800));
    this.dpr = Math.min(MAX_DPR, globalThis.devicePixelRatio || 1);
    this.canvas.width = Math.round(W * this.dpr); this.canvas.height = Math.round(H * this.dpr);
    this.W = W; this.H = H; this.mob = W < 720;
    if (reset || !this.feet.length) {
      this.p = { x: W * 0.72, y: H * 0.3 }; this.heading = Math.PI * 0.8; const first = this.pickPoint(); this.target = { x: lerp(this.p.x, first.x, 0.25), y: lerp(this.p.y, first.y, 0.25) }; this.mode = 'weave'; this.weaveFrom = null; this.plan = []; this.webs = []; this.strands = [];
      this.feet = [];
      for (let i = 0; i < 8; i += 1) { const f = this.footHome(i); this.feet.push({ p: { ...f }, from: { ...f }, to: { ...f }, lift: 1 }); }
    } else {
      this.p.x = Math.min(this.p.x, W - 20); this.p.y = Math.min(this.p.y, H - 20);
    }
  }

  private start() {
    if (this.running || !this.ctx) return;
    this.running = true; this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000)); this.last = now;
      this.step(dt); this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  private stop() { this.running = false; if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }

  private stillFrame() {
    // a resting spider at the hub of one finished web; nothing moves
    this.t = 0; this.strands = []; this.webs = [];
    const web = this.findHub() ?? { c: { x: this.W * 0.8, y: this.H * 0.2 }, r: this.mob ? 60 : 100 };
    this.webs.push(web);
    let prev: P | null = null;
    for (const wp of this.planWeb(web)) { if (wp.lay && prev) this.addStrand(prev, wp.p); prev = wp.p; }
    this.p = { ...web.c }; this.draw(true);
  }

  // ---------------------------------------------------------------- behaviour
  private avoid: { x: number; y: number; w: number; h: number }[] = [];
  /** Areas (canvas-relative) the spider and fly keep clear of, so they stay visible around the composer. */
  setAvoid(rects: { x: number; y: number; w: number; h: number }[]) { this.avoid = rects; }
  private pickPoint(): P {
    const m = 24, pad = 28;
    let p = { x: 0, y: 0 };
    for (let i = 0; i < 12; i += 1) {
      p = { x: m + this.rnd() * (this.W - m * 2), y: m + this.rnd() * (this.H - m * 2) };
      if (!this.avoid.some((r) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad)) break;
    }
    return p;
  }
  /** Finds an empty disc (clear of the composer/wordmark/pills and of other webs) for a new orb web. */
  private findHub(): Web | null {
    const pad = 18, rMax = this.mob ? 92 : 150, rMin = this.mob ? 46 : 70;
    for (let r = rMax; r >= rMin; r -= this.mob ? 12 : 20) {
      for (let i = 0; i < 40; i += 1) {
        const c = { x: r + 10 + this.rnd() * (this.W - 2 * r - 20), y: r + 50 + this.rnd() * (this.H - 2 * r - 60) };
        if (c.x < r || c.y < r) continue;
        const hitsUi = this.avoid.some((q) => { const nx = Math.max(q.x - pad, Math.min(c.x, q.x + q.w + pad)), ny = Math.max(q.y - pad, Math.min(c.y, q.y + q.h + pad)); return Math.hypot(nx - c.x, ny - c.y) < r; });
        if (hitsUi) continue;
        if (this.webs.some((w) => Math.hypot(w.c.x - c.x, w.c.y - c.y) < w.r + r + 12)) continue;
        return { c, r };
      }
    }
    return null;
  }
  /** Orb-web plan: radial spokes (with frame segments), then an outward spiral across the spokes. */
  private planWeb(web: Web): Waypoint[] {
    const n = this.mob ? 7 : 9, { c, r } = web, rot = this.rnd() * Math.PI * 2;
    const at = (a: number, rr: number) => ({ x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr * 0.92 });
    const ang = (i: number) => rot + (i / n) * Math.PI * 2 + (this.rnd() - 0.5) * 0.12;
    const rims = Array.from({ length: n }, (_, i) => ({ a: ang(i), rr: r * (0.86 + this.rnd() * 0.14) }));
    const out: Waypoint[] = [{ p: c, lay: false }];
    for (let i = 0; i < n; i += 2) {
      const a = rims[i], b = rims[(i + 1) % n];
      out.push({ p: at(a.a, a.rr), lay: true });
      if (i + 1 < n) { out.push({ p: at(b.a, b.rr), lay: true }); out.push({ p: c, lay: true }); }
      else out.push({ p: c, lay: false });
    }
    const turns = this.mob ? 4 : 5, steps = n * turns;
    for (let j = 0; j <= steps; j += 1) {
      const k = j / steps, rim = rims[j % n];
      out.push({ p: at(rim.a, rim.rr * (0.2 + 0.72 * k)), lay: j > 0 });
    }
    return out;
  }
  private nextWaypoint() {
    if (!this.plan.length) {
      const web = this.findHub();
      if (web) { this.webs.push(web); this.plan = this.planWeb(web); if (this.t < 1) { this.p = { ...web.c }; for (const f of this.feet) { const h = this.footHome(this.feet.indexOf(f)); f.p = { ...h }; f.from = { ...h }; f.to = { ...h }; } } }
      else { // no room: rest on a web; after a while the oldest web fades to make room
        if (!this.restSince) this.restSince = this.t;
        if (this.t - this.restSince > 25) { this.fadeOldestWeb(); this.restSince = 0; }
        const w = this.webs[this.webs.length - 1];
        this.plan = [{ p: w ? { x: w.c.x + (this.rnd() - 0.5) * w.r, y: w.c.y + (this.rnd() - 0.5) * w.r } : this.pickPoint(), lay: false }];
        this.pauseUntil = this.t + 2 + this.rnd() * 2;
        return;
      }
      this.restSince = 0;
      this.pauseUntil = this.t + 0.6;
    }
  }
  private fadeOldestWeb() {
    const w = this.webs.shift(); if (!w) return;
    for (const s of this.strands) if (!s.dieAt && Math.hypot(s.a.x - w.c.x, s.a.y - w.c.y) <= w.r + 2) s.dieAt = this.t + FADE;
  }
  private step(dt: number) {
    this.t += dt;
    const t = this.t;
    // fly lifecycle
    if (!this.fly && !this.cocoon && t > this.nextFlyAt) {
      const home = this.pickPoint();
      this.fly = { p: { ...home }, home, phase: this.rnd() * 10, born: t };
    }
    if (this.fly) {
      const f = this.fly, k = t - f.born;
      const drift = this.mode === 'hunt' ? 0.3 : 1;
      f.home.x += Math.sin(k * 0.37 + f.phase) * 18 * drift * dt; f.home.y += Math.cos(k * 0.29 + f.phase) * 14 * drift * dt;
      f.home.x = Math.max(30, Math.min(this.W - 30, f.home.x)); f.home.y = Math.max(30, Math.min(this.H - 30, f.home.y));
      // once stalked the fly settles near a strand (slower, tighter loops) so the catch reads clearly
      const r = this.mode === 'hunt' ? Math.max(3, 30 - (t - this.huntAt) * 7) : 40;
      f.p.x = f.home.x + Math.sin(k * 3.1 + f.phase) * r + Math.sin(k * 11.7) * 4;
      f.p.y = f.home.y + Math.cos(k * 2.3 + f.phase * 1.3) * r * 0.6 + Math.cos(k * 13.1) * 3;
      if (this.mode !== 'hunt' && k > 3.5) { this.mode = 'hunt'; this.weaveFrom = null; this.huntAt = t; }
    }
    if (this.cocoon && t - this.cocoon.born > 4.5) { this.cocoon = null; this.nextFlyAt = t + 30 + this.rnd() * 20; }

    // movement
    let tgt = this.target, maxV = this.mob ? 38 : 56;
    if (this.mode === 'hunt' && this.fly) {
      tgt = this.fly.p; const d = Math.hypot(tgt.x - this.p.x, tgt.y - this.p.y);
      maxV = d > 90 ? (this.mob ? 60 : 80) : (this.mob ? 28 : 34); // stalk, then a slow approach
      if (d < 70 && Math.sin(t * 2.2) > 0.4) maxV *= 0.15;           // freeze-and-creep
      if (d < (this.mob ? 9 : 12)) {
        this.cocoon = { p: { ...this.fly.p }, born: t }; this.fly = null; this.catches += 1;
        this.mode = 'weave'; this.pauseUntil = t + 2.2;
      }
    } else {
      this.mode = 'weave';
      if (!this.plan.length) this.nextWaypoint();
      const wp = this.plan[0];
      tgt = wp.p; maxV = this.mob ? 78 : 112;
      if (Math.hypot(tgt.x - this.p.x, tgt.y - this.p.y) < 4) {
        if (wp.lay && this.from) this.addStrand(this.from, wp.p);
        this.from = wp.p; this.plan.shift();
        this.weaveFrom = this.plan[0]?.lay ? this.from : null;
        if (!this.plan.length) this.nextWaypoint();
      } else {
        this.weaveFrom = wp.lay ? this.from : null;
      }
    }
    const paused = t < this.pauseUntil;
    const want = Math.atan2(tgt.y - this.p.y, tgt.x - this.p.x);
    let da = want - this.heading; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    const dist = Math.hypot(tgt.x - this.p.x, tgt.y - this.p.y);
    if (dist < 14) this.heading = want; else this.heading += da * Math.min(1, dt * (dist < 60 ? 6 : 3.2));
    const v = paused ? 0 : maxV * Math.max(0.15, Math.cos(da)) * Math.min(1, 0.5 + dist / 40);
    this.speed = lerp(this.speed, v, Math.min(1, dt * 4));
    this.p.x += Math.cos(this.heading) * this.speed * dt; this.p.y += Math.sin(this.heading) * this.speed * dt;
    this.walk += this.speed * dt;

    // feet: plant, then step when the ideal spot drifts away (alternating tetrapod gait)
    const L = this.mob ? 22 : 32;
    for (let i = 0; i < 8; i += 1) {
      const f = this.feet[i], home = this.footHome(i);
      if (f.lift < 1) {
        f.lift = Math.min(1, f.lift + dt / 0.14);
        const k = smooth(f.lift); f.p.x = lerp(f.from.x, f.to.x, k); f.p.y = lerp(f.from.y, f.to.y, k);
      } else if (Math.hypot(home.x - f.p.x, home.y - f.p.y) > L * 0.55) {
        const group = i % 2 === Math.floor(this.walk / (L * 0.5)) % 2;
        const partnerLifting = this.feet.some((o, j) => j !== i && j % 2 !== i % 2 && o.lift < 1);
        if (group || !partnerLifting) {
          f.from.x = f.p.x; f.from.y = f.p.y;
          f.to.x = home.x + Math.cos(this.heading) * L * 0.35; f.to.y = home.y + Math.sin(this.heading) * L * 0.35;
          f.lift = 0;
        }
      }
    }
    // keep the in-progress weave thread attached
    for (const s of this.strands) if (!s.dieAt && t - s.born > STRAND_LIFE) s.dieAt = t + FADE;
    if (this.strands.some((s) => s.dieAt !== undefined && t > s.dieAt)) this.strands = this.strands.filter((s) => s.dieAt === undefined || t <= s.dieAt);
  }
  private addStrand(a: P, b: P) {
    const len = Math.hypot(a.x - b.x, a.y - b.y);
    if (len < 3) return;
    this.strands.push({ a, b, born: this.t, sag: Math.min(4, len * 0.04) });
    if (this.strands.filter((s) => !s.dieAt).length > MAX_STRANDS) this.fadeOldestWeb();
  }
  private footHome(i: number): P {
    const L = this.mob ? 22 : 32, side = i < 4 ? 1 : -1, k = i % 4, la = this.heading + side * (0.55 + k * 0.55);
    return { x: this.p.x + Math.cos(la) * L * 1.15, y: this.p.y + Math.sin(la) * L * 1.15 };
  }

  // ---------------------------------------------------------------- drawing (crawler look)
  private glow(x: number, y: number, r: number, c: RGB, a: number) {
    const ctx = this.ctx!;
    if (!this.glowSprite) {
      const s = document.createElement('canvas'); s.width = s.height = 64;
      const g = s.getContext('2d');
      if (g) { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
      this.glowSprite = s;
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
    ctx.fillStyle = rgba(c, 1); // tint via a coloured disc under the white sprite
    ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, 7); ctx.fill();
    ctx.globalAlpha = a * 0.6; ctx.drawImage(this.glowSprite, x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  private draw(still = false) {
    const ctx = this.ctx; if (!ctx) return;
    const { W, H, t } = this, mob = this.mob;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    // strands (silk, fading)
    for (const s of this.strands) {
      const age = still ? 5 : t - s.born, a = Math.min(1, age / 0.6) * (s.dieAt === undefined || still ? 1 : Math.max(0, Math.min(1, (s.dieAt - t) / FADE)));
      const mx = (s.a.x + s.b.x) / 2, my = (s.a.y + s.b.y) / 2 + s.sag;
      ctx.strokeStyle = rgba(SILK, 0.5 * a); ctx.lineWidth = 0.75;
      ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.quadraticCurveTo(mx, my, s.b.x, s.b.y); ctx.stroke();
      
    }
    // thread being woven
    if (this.mode === 'weave' && this.weaveFrom) {
      ctx.strokeStyle = rgba(SILK, 0.55); ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(this.weaveFrom.x, this.weaveFrom.y); ctx.lineTo(this.p.x, this.p.y); ctx.stroke();
    }
    // cocoon: silk wraps, then fades
    if (this.cocoon) {
      const k = t - this.cocoon.born, a = Math.min(1, k / 0.4) * (1 - Math.max(0, (k - 3) / 1.5)), { x, y } = this.cocoon.p;
      ctx.save(); ctx.translate(x, y); ctx.rotate(0.5);
      ctx.fillStyle = rgba(SILK, 0.35 * a); ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 7, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = rgba(SILK, 0.7 * a); ctx.lineWidth = 0.7;
      const turns = Math.min(6, 1 + k * 3);
      for (let i = 0; i < turns; i += 1) { ctx.beginPath(); ctx.ellipse(0, -5 + i * 2, 5, 1.6, 0.3 * Math.sin(i), 0, 7); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = rgba(SILK, 0.35 * a); ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x, y - 40); ctx.stroke();
    }
    // fly: dark body, blurred wings
    if (this.fly) {
      const { x, y } = this.fly.p, a = Math.min(1, (t - this.fly.born) / 0.8), wing = Math.sin(t * 90) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(220,226,232,${0.22 * a})`;
      ctx.beginPath(); ctx.ellipse(x - 2.5, y - 2, 3.2, 1.6 + wing, -0.6, 0, 7); ctx.ellipse(x + 2.5, y - 2, 3.2, 1.6 + wing, 0.6, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(200,196,190,${0.85 * a})`; ctx.beginPath(); ctx.ellipse(x, y, 1.8, 2.6, 0, 0, 7); ctx.fill();
    }
    // spider
    const p = this.p, L = mob ? 22 : 32, dx = Math.cos(this.heading), dy = Math.sin(this.heading);
    for (let i = 0; i < 8; i += 1) {
      const side = i < 4 ? 1 : -1, f = still ? this.footHome(i) : this.feet[i]?.p ?? this.footHome(i);
      const lift = still ? 1 : this.feet[i].lift, fy = f.y - (lift < 1 ? Math.sin(lift * Math.PI) * 4 : 0);
      const mx = (p.x + f.x) / 2, my = (p.y + fy) / 2, nx = -(fy - p.y), ny = f.x - p.x, nl = Math.hypot(nx, ny) || 1;
      const kx = mx + (nx / nl) * L * 0.32 * -side, ky = my + (ny / nl) * L * 0.32 * -side - L * 0.12;
      ctx.strokeStyle = rgba(LEG, 0.75); ctx.lineWidth = mob ? 1 : 1.2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(kx, ky, f.x, fy); ctx.stroke();
      this.glow(f.x, fy, 5, HOT, 0.5);
      ctx.fillStyle = 'rgba(255,248,232,.9)'; ctx.fillRect(f.x - 1, fy - 1, 2, 2);
      ctx.fillStyle = 'rgba(255,190,130,.8)'; ctx.beginPath(); ctx.arc(kx, ky, 1.3, 0, 7); ctx.fill();
    }
    this.glow(p.x, p.y, mob ? 22 : 30, GOLD, 0.55);
    ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.arc(p.x, p.y, mob ? 3.6 : 4.6, 0, 7); ctx.fill();
    ctx.strokeStyle = rgba(GOLD, 0.9); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, (mob ? 7 : 9) + Math.sin(t * 9) * 0.8, 0, 7); ctx.stroke();
    ctx.fillStyle = rgba(GOLD, 1); ctx.beginPath(); ctx.arc(p.x + dx * (mob ? 6 : 8), p.y + dy * (mob ? 6 : 8), 1.8, 0, 7); ctx.fill();
  }
}
