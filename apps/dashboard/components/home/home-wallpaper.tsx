'use client';

import { useEffect, useRef } from 'react';
import { HomeWallpaperEngine } from './home-wallpaper-engine';

const REDUCED = '(prefers-reduced-motion: reduce)';

/** Decorative living wallpaper behind the minimal home. No data; hidden from assistive tech; never interactive. */
export function HomeWallpaper() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED) : undefined;
    const engine = new HomeWallpaperEngine(canvas);
    engine.mount(!mq?.matches);
    (canvas as HTMLCanvasElement & { __wallpaper?: HomeWallpaperEngine }).__wallpaper = engine;
    const onMotion = () => engine.setAnimate(!mq?.matches);
    mq?.addEventListener?.('change', onMotion);
    const updateAvoid = () => {
      const base = canvas.getBoundingClientRect();
      const host = canvas.parentElement;
      const els = host ? Array.from(host.querySelectorAll<HTMLElement>('.forge-composer, .forge-composer-tray, .forge-page-chips, .forge-wordmark, .forge-explore-ideas, .forge-surface-bar')) : [];
      engine.setAvoid(els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }; }));
    };
    updateAvoid();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { engine.measure(); updateAvoid(); }) : undefined;
    ro?.observe(canvas);
    return () => { engine.unmount(); mq?.removeEventListener?.('change', onMotion); ro?.disconnect(); };
  }, []);
  return <canvas ref={ref} className="home-wallpaper" aria-hidden="true" tabIndex={-1} data-decorative="true" />;
}
