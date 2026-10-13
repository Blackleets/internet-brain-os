import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../app/efesto-premium-chrome.css', import.meta.url), 'utf8');
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('premium chrome stays out of the forge scene', () => {
  it('never styles the anvil, spider, canvases or anything inside .forge-live', () => {
    const selectors = rules.split('{').slice(0, -1).map((s) => s.split('}').pop() ?? '');
    for (const sel of selectors) {
      const withoutExclusions = sel.replace(/:not\(\.forge-live \*\)/g, '');
      expect(withoutExclusions).not.toMatch(/forge-live|anvil|spider|crawler|canvas/);
    }
  });
  it('replaces the orange focus box on the Goal field with a visible composer ring', () => {
    expect(rules).toMatch(/\.forge-composer:focus-within\s*\{[^}]*border-color:[^}]*box-shadow/);
    expect(rules).toMatch(/\.forge-composer textarea:focus-visible[^{]*\{[^}]*outline: 2px solid transparent/);
    expect(rules).toMatch(/forced-colors: active/);
  });
});
