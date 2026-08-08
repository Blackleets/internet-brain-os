import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);

async function text(path: string): Promise<string> {
  return readFile(new URL(path, root), 'utf8');
}

describe('conversation-first dashboard shell', () => {
  it('loads the responsive overrides after the canonical dashboard styles', async () => {
    const layout = await text('app/layout.tsx');
    expect(layout.indexOf("import './globals.css';")).toBeGreaterThan(-1);
    expect(layout.indexOf("import './conversation-shell.css';")).toBeGreaterThan(layout.indexOf("import './globals.css';"));
  });

  it('keeps desktop conversation width restrained and readable', async () => {
    const css = await text('app/conversation-shell.css');
    expect(css).toContain('grid-template-columns: 260px minmax(0, 1fr)');
    expect(css).toContain('width: min(780px, calc(100% - 28px))');
    expect(css).toContain('font-size: 15px');
    expect(css).toContain('border-radius: 26px');
  });

  it('provides a real mobile viewport contract instead of scaling desktop down', async () => {
    const css = await text('app/conversation-shell.css');
    expect(css).toContain('@media (max-width: 680px)');
    expect(css).toContain('height: 100dvh');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('font-size: 16px');
    expect(css).toContain('grid-template-columns: 1fr 1fr');
  });

  it('preserves reduced-motion accessibility', async () => {
    const css = await text('app/conversation-shell.css');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
