import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);

async function text(path: string): Promise<string> {
  return readFile(new URL(path, root), 'utf8');
}

describe('Efesto living forge visual system', () => {
  it('loads the forge identity after the functional product styles', async () => {
    const layout = await text('app/layout.tsx');
    const product = layout.indexOf("import './efesto-product.css';");
    const compat = layout.indexOf("import './efesto-product-compat.css';");
    const forge = layout.indexOf("import './efesto-forge-visual.css';");
    expect(product).toBeGreaterThan(-1);
    expect(forge).toBeGreaterThan(compat);
    expect(forge).toBeGreaterThan(product);
  });

  it('uses the pixel smith and orange-blue intelligence palette without adding fake product state', async () => {
    const css = await text('app/efesto-forge-visual.css');
    const smith = await text('public/efesto-smith.svg');
    expect(css).toContain("url('/efesto-smith.svg')");
    expect(css).toContain('--ef-blue: #4fc3f7');
    expect(css).toContain('--ef-ember: #e87732');
    expect(smith).toContain('Efesto pixel smith');
    expect(smith).toContain('#68e5ff');
    expect(smith).toContain('#e87732');
  });

  it('animates work only for observable active phases and fails closed visually when offline or failed', async () => {
    const css = await text('app/efesto-forge-visual.css');
    for (const phase of ['queued', 'investigating', 'verifying', 'thinking']) {
      expect(css).toContain(`.phase-${phase}::before`);
    }
    expect(css).toContain('.phase-offline::after { opacity: .05; }');
    expect(css).toContain('.phase-failed::after { opacity: 0; }');
    expect(css).not.toContain('.phase-offline::after {\n  animation:');
  });

  it('keeps mobile containment and reduced-motion accessibility explicit', async () => {
    const css = await text('app/efesto-forge-visual.css');
    expect(css).toContain('@media (max-width: 720px)');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation-duration: .001ms !important');
  });
});
