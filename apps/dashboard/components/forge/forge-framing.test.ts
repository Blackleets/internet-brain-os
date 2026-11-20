// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { forgeFloorY } from './forge-crawler-renderer';

describe('forge framing: the floor the anvil stands on', () => {
  it('stands the anvil above the counters bar when it overlays the stage (wide layout, Home)', () => {
    const stage = { y: 170, h: 799 };
    const funnel = { y: 893 };
    expect(forgeFloorY(stage, funnel)).toBe(883);
  });
  it('stands the anvil above the counters for a narrow stage inside the wide layout (Objetivos)', () => {
    // Regression: the floor used to key on the stage-width heuristic, so this stage took the
    // narrow branch and the anvil fell behind the counters bar overlaying its floor.
    const stage = { y: 435, h: 514 };
    const funnel = { y: 873 };
    expect(forgeFloorY(stage, funnel)).toBe(863);
    expect(forgeFloorY(stage, funnel)).toBeLessThan(stage.y + stage.h);
  });
  it('uses the stage bottom edge when the counters flow below the stage (narrow layout)', () => {
    const stage = { y: 240, h: 372 };
    const funnel = { y: 612 };
    expect(forgeFloorY(stage, funnel)).toBe(stage.y + stage.h - 6);
  });
  it('uses the stage bottom edge when there are no counters', () => {
    expect(forgeFloorY({ y: 100, h: 500 }, null)).toBe(594);
    expect(forgeFloorY({ y: 100, h: 500 }, undefined)).toBe(594);
  });
});

describe('forge framing: the height of the forge embedded in Objetivos', () => {
  const root = [process.cwd(), join(process.cwd(), 'apps/dashboard')].find((d) => existsSync(join(d, 'app/efesto-forge-live.css')))!;
  const css = readFileSync(join(root, 'app/efesto-forge-live.css'), 'utf8');
  it('gives the embedded forge the height that remains under the view headings', () => {
    expect(css).toContain('.goals-forge-live .forge-live-body { height: max(430px, calc(100svh - 490px)); }');
  });
  it('keeps the hero height budget for the standalone forge (Home)', () => {
    expect(css).toContain('height: max(540px, calc(100svh - 205px));');
  });
});
