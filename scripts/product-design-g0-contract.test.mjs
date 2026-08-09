import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
async function text(path) { return readFile(new URL(path, root), 'utf8'); }

describe('Goal-first cross-surface G0 contract', () => {
  it('anchors the experience to one Kernel-owned Goal truth and preserves compatibility explicitly', async () => {
    const contract = await text('docs/product-design/goal-first-cross-surface-g0.md');
    expect(contract).toContain('`UniversalGoal` v2 is the long-term canonical Goal domain contract.');
    expect(contract).toContain('compatibility representation');
    expect(contract).toContain('GoalSurfaceSnapshot v1');
    expect(contract).toContain('sourceOfTruth = kernel');
    expect(contract).toContain('Kernel is the only source of persisted Goal truth.');
  });

  it('keeps Goal lifecycle, Mission execution and client-only draft states separate', async () => {
    const contract = await text('docs/product-design/goal-first-cross-surface-g0.md');
    expect(contract).toContain('Goal lifecycle');
    expect(contract).toContain('Mission execution');
    expect(contract).toContain('`draft`');
    expect(contract).toContain('`prepared`');
    expect(contract).toContain('A running Mission does not silently rewrite Goal lifecycle');
  });

  it('defines automatic work as policy-bounded and keeps side effects gated', async () => {
    const contract = await text('docs/product-design/goal-first-cross-surface-g0.md');
    expect(contract).toContain('automatic inside previously authorized boundaries');
    expect(contract).toContain('purchase, login, form submission, outreach, download, destructive actions');
    expect(contract).toContain('memory admission remains Kernel-owned');
  });

  it('defines real product surfaces without turning the public landing into a runtime client', async () => {
    const contract = await text('docs/product-design/goal-first-cross-surface-g0.md');
    expect(contract).toContain('Full Control Center — desktop');
    expect(contract).toContain('Full Control Center — mobile-width');
    expect(contract).toContain('Browser extension');
    expect(contract).toContain('Public landing');
    expect(contract).toContain('must not receive Kernel tokens');
  });

  it('requires mobile-width, accessibility, truthful motion and no fake remote-PC claim', async () => {
    const contract = await text('docs/product-design/goal-first-cross-surface-g0.md');
    expect(contract).toContain('390×844');
    expect(contract).toContain('prefers-reduced-motion');
    expect(contract).toContain('no horizontal overflow');
    expect(contract).toContain('does **not** claim that an arbitrary phone can remotely control the private Kernel running on a PC');
    expect(contract).toContain('Never animate “thinking” merely because a timer is running.');
  });

  it('records exactly three visual directions and selects Forge Focus', async () => {
    const contract = await text('docs/product-design/goal-first-cross-surface-g0.md');
    const directions = contract.match(/^### Direction [ABC] —/gm) ?? [];
    expect(directions).toHaveLength(3);
    expect(contract).toContain('### Direction A — Forge Focus — selected');
    expect(contract).toContain('### Direction B — Mission Thread');
    expect(contract).toContain('### Direction C — Opportunity Radar');
    expect(contract).toContain('**Direction A — Forge Focus** is the G0 baseline for implementation.');
  });

  it('orders implementation into bounded G1–G4 slices instead of a multi-surface rewrite', async () => {
    const contract = await text('docs/product-design/goal-first-cross-surface-g0.md');
    expect(contract).toContain('**G1 — Shared Goal Truth v1**');
    expect(contract).toContain('G2 consumes it in the responsive Control Center');
    expect(contract).toContain('G3 consumes the same projection in the extension');
    expect(contract).toContain('G4 evaluates automatic execution/refresh parity');
  });
});
