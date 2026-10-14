// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { ForgedWordmark } from './efesto-product-views';

afterEach(cleanup);
const root = [process.cwd(), join(process.cwd(), 'apps/dashboard')].find((d) => existsSync(join(d, 'app/efesto-home-v2.css')))!;
const css = readFileSync(join(root, 'app/efesto-home-v2.css'), 'utf8');

describe('home v2 (approved design)', () => {
  it('renders EFESTO as six decorative letters with the F as the ember and its sparks', () => {
    const { container } = render(<ForgedWordmark />);
    const b = container.querySelector('b.forge-forged')!;
    expect(b.getAttribute('aria-hidden')).toBe('true');
    const letters = [...b.querySelectorAll('.fx-l')];
    expect(letters.map((l) => l.firstChild?.textContent).join('')).toBe('EFESTO');
    expect(letters[1].classList.contains('fx-ember')).toBe(true);
    expect(letters[1].querySelectorAll('.fx-sparks i')).toHaveLength(4);
  });
  it('is reduced-motion safe and only animates cheap properties', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.fx-l[^{]*\{ animation: none; \}/);
    expect(reduced).toContain('.fx-sparks { display: none; }');
    const keyframes = css.match(/@keyframes[\s\S]*?\n\}/g)!.join('\n');
    expect(keyframes).not.toMatch(/\b(width|height|top|left|margin|padding)\s*:/);
  });
  it('keeps the spider behaviour: only the canvas glow (filter) is styled', () => {
    const canvasRules = css.split('\n').filter((line) => line.includes('canvas.home-wallpaper'));
    expect(canvasRules.join('\n')).not.toMatch(/transform|animation|width|height|position|left|top/);
    expect(canvasRules.join('\n')).toContain('filter:');
  });
  it('sidebar groups are labelled and the strip under the box has no border', () => {
    expect(css).toContain('.forge-composer-tray { background: transparent; border: 0; box-shadow: none; }');
    const shell = readFileSync(join(root, 'components/efesto-product-shell.tsx'), 'utf8');
    for (const key of ['sidebar.create', 'sidebar.workspace', 'sidebar.system']) expect(shell).toContain(`<span className="nav-label">{t('${key}')}</span>`);
    expect(readFileSync(join(root, 'app/layout.tsx'), 'utf8')).toContain("import './efesto-home-v2.css';");
  });
});
