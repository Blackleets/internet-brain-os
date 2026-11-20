// @vitest-environment jsdom
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = [process.cwd(), join(process.cwd(), 'apps/dashboard')].find((d) => existsSync(join(d, 'app/efesto-design-v1.css')))!;
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const v1 = read('app/efesto-design-v1.css');

describe('design v1 — "La forja como escenario"', () => {
  it('loads the v1 sheet after every earlier product layer', () => {
    const layout = read('app/layout.tsx');
    expect(layout).toContain("import './efesto-design-v1.css';");
    expect(layout.indexOf("import './efesto-design-v1.css';")).toBeGreaterThan(layout.indexOf("import './efesto-home-v2.css';"));
    expect(layout.indexOf("import './efesto-design-v1.css';")).toBeGreaterThan(layout.indexOf("import './efesto-forge-visual.css';"));
  });

  it('keeps ONE warm identity: no blue or violet tokens survive in the product layers', () => {
    const visual = read('app/efesto-forge-visual.css');
    expect(visual).not.toMatch(/--ef-blue|--ef-cyan|79 195 247|104 229 255|#4fc3f7|#68e5ff/i);
    expect(read('app/efesto-product.css')).not.toContain('--ef-violet');
    expect(v1).toContain('#ff7a2a');
    expect(v1).toContain('#f5c451');
  });

  it('renders the notice in flow as a stage-grid row, never floating over the scene', () => {
    expect(v1).toMatch(/\.efesto-stage:has\(> \.efesto-toast\) \{\s*\n\s*grid-template-rows: 56px auto minmax\(0, 1fr\);/);
    expect(v1).toMatch(/\.efesto-toast,\s*\n\.efesto-product\.has-tabbar \.efesto-toast \{\s*\n\s*position: static;/);
    expect(v1).toContain('grid-row: 2;');
  });

  it('frames the living scene as the Home protagonist and seats the wordmark inside it', () => {
    expect(v1).toMatch(/\.forge-surface\.is-idle > \.forge-scroll \{[^}]*border-radius: 24px;/);
    expect(v1).toMatch(/\.forge-surface\.is-idle > \.forge-scroll \{[^}]*flex: 1\.55 1 0;/);
    expect(v1).toMatch(/\.forge-surface\.is-idle > \.forge-composer-zone \{\s*\n\s*flex: 1 1 0;/);
    expect(v1).toMatch(/\.forge-surface\.is-idle \.forge-goal-empty \{\s*\n\s*justify-items: start;/);
    const views = read('components/efesto-product-views.tsx');
    expect(views).toContain('className="forge-wordmark-tag"');
    expect(views).toContain('The Intelligence Forge');
  });

  it('stepper semantics: gold means done, ember means current, joined by a line', () => {
    expect(v1).toMatch(/li\[data-state='done'\] em,[\s\S]*?background: linear-gradient\(180deg, #f7cd6b, #d99a26\);/);
    expect(v1).toMatch(/li\[aria-current='step'\] em,[\s\S]*?0 0 0 4px rgba\(255, 122, 42, \.14\);/);
    expect(v1).toContain(".forge-live-steps > li:not(:last-child)::after");
    expect(v1).toMatch(/\[data-layout='narrow'\] \.forge-live-steps > li\[data-state='done'\],[\s\S]*?background: linear-gradient\(90deg, #d99a26, #f5c451\);/);
  });

  it('enforces the 11px typography floor on product labels', () => {
    for (const selector of ['.forge-slabel', '.forge-chip-tag', '.forge-bench-meta', '.forge-live-stepnow', '.state-pill', '.nav-label', '.forge-source-prior-tag', '.goal-edit-eyebrow']) {
      expect(v1).toContain(selector);
    }
    expect(v1).toMatch(/\.forge-ticker-ttl \{ font-size: 11px; \}/);
    expect(v1).not.toMatch(/font-size: (?:[0-9]|10(?:\.\d)?)px/);
    expect(v1).not.toMatch(/font: [^;]*\b(?:[0-9]|10(?:\.\d)?)px\//);
  });

  it('compresses the Goals header stack on phones so the anvil lands in the first screen', () => {
    const mobile = v1.slice(v1.indexOf('Goals on a phone'));
    expect(mobile).toContain('.missions-route .workspace-heading {');
    expect(mobile).toContain('grid-template-columns: 34px minmax(0, 1fr) auto;');
    expect(mobile).toContain('-webkit-line-clamp: 1;');
    expect(mobile).toContain('.missions-route .workspace-heading-action {');
    expect(mobile).toContain('.missions-route .workspace-heading small { display: none; }');
    expect(mobile).toContain("[data-layout='narrow'] .forge-live-head { padding: 8px 16px 6px; }");
    // The anvil framing fix (a0d86c0) must not regress.
    const live = read('app/efesto-forge-live.css');
    expect(live).toContain('max(430px, calc(100svh - 490px))');
  });

  it('gives the sidebar primary action the ember gradient and the active nav its ember tint', () => {
    expect(v1).toMatch(/\.efesto-sidebar \.sidebar-actions \.new-goal \{\s*\n\s*border: 1px solid rgba\(255, 170, 90, \.45\);\s*\n\s*background: linear-gradient\(180deg, #a34d12, #8a3d0c\);/);
    expect(v1).toMatch(/nav\[aria-label\] button\[aria-current='page'\] \{\s*\n\s*border-color: rgba\(255, 170, 90, \.28\);\s*\n\s*background: rgba\(255, 122, 42, \.13\);/);
  });
});
