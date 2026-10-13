// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeWallpaper } from './home-wallpaper';

const noopCtx = new Proxy({}, { get: (_t, k) => (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => undefined), set: () => true });

function mockMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: reduce && query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}

describe('home living wallpaper', () => {
  beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(noopCtx as unknown as CanvasRenderingContext2D); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('is decorative: aria-hidden, not focusable', () => {
    mockMotion(false);
    const { container } = render(<HomeWallpaper />);
    const el = container.querySelector('.home-wallpaper')!;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('tabindex')).toBe('-1');
  });

  it('animates with requestAnimationFrame normally', () => {
    mockMotion(false);
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    render(<HomeWallpaper />);
    expect(raf).toHaveBeenCalled();
  });

  it('never starts an animation loop with prefers-reduced-motion', () => {
    mockMotion(true);
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    render(<HomeWallpaper />);
    expect(raf).not.toHaveBeenCalled();
  });
});
