import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Efesto orb UI static contract', () => {
  it('does not make remote assets or tracking mandatory', () => {
    const html = readFileSync(resolve('apps/extension/src/popup.html'), 'utf8');
    const css = readFileSync(resolve('apps/extension/src/central-forge-power.css'), 'utf8');
    expect(`${html}\n${css}`).not.toMatch(/https?:\/\//i);
    expect(`${html}\n${css}`).not.toMatch(/<script[^>]+src=["']https?:/i);
  });

  it('supports 375px, 390px, and desktop-ish popup widths without a remote layout dependency', () => {
    const css = readFileSync(resolve('apps/extension/src/central-forge-power.css'), 'utf8');
    const popupCss = readFileSync(resolve('apps/extension/src/popup.css'), 'utf8');
    expect(popupCss).toContain('width: 390px');
    expect(css).toContain('@media (max-width:380px)');
    expect(css).toContain('grid-template-columns:repeat(2,1fr)');
  });

  it('honors reduced motion for intensive orb and forge animation', () => {
    const css = readFileSync(resolve('apps/extension/src/central-forge-power.css'), 'utf8');
    const popupCss = readFileSync(resolve('apps/extension/src/popup.css'), 'utf8');
    expect(css).toContain('@media (prefers-reduced-motion:reduce)');
    expect(css).toContain('animation:none!important');
    expect(popupCss).toContain('@media (prefers-reduced-motion:reduce)');
  });

  it('keeps MutationObserver scoped so button text changes do not loop', () => {
    const source = readFileSync(resolve('apps/extension/src/one-click-mission-ui.js'), 'utf8');
    expect(source).toContain("attributeFilter: ['data-status']");
    expect(source).toContain('goalObserver.observe(goals, { childList: true })');
    expect(source).not.toContain('subtree: true');
  });

  it('keeps protected Chrome pages guarded before the orb controller loads', () => {
    const html = readFileSync(resolve('apps/extension/src/popup.html'), 'utf8');
    const guard = readFileSync(resolve('apps/extension/src/unsupported-page-guard.js'), 'utf8');
    expect(html.indexOf('central-forge-power.js')).toBeGreaterThan(html.indexOf('popup.js'));
    expect(guard).toContain('Receiving end does not exist');
    expect(guard).toContain("parsed.protocol === 'http:' || parsed.protocol === 'https:'");
  });

  it('renders the mission returned by the Kernel immediately after starting research', () => {
    const source = readFileSync(resolve('apps/extension/src/central-forge-power-controller.js'), 'utf8');
    expect(source).toContain('const startedMission = await transport.startGoalResearch(nextGoal.id, options)');
    expect(source).toContain('mission: startedMission');
  });

  it('uses the shared bootstrap contract and restarts waiting missions once Hermes is ready', () => {
    const source = readFileSync(resolve('apps/extension/src/central-forge-power-controller.js'), 'utf8');
    expect(source).toContain('getEfestoBootstrapStatus');
    expect(source).toContain("latest?.status === 'waiting_for_agent' && services.hermes === 'ready'");
    expect(source).toContain('const restartedMission = await transport.startGoalResearch(latest.goalId, options)');
    expect(source).toContain('mission: restartedMission');
  });

  it('never displays empty summaries or Obsidian receipts outside completed state', () => {
    const source = readFileSync(resolve('apps/extension/src/central-forge-power-controller.js'), 'utf8');
    const css = readFileSync(resolve('apps/extension/src/central-forge-power.css'), 'utf8');
    expect(source).toContain("renderObsidianReceipt(obsidianReceipt, view.state === 'completed' ? view.obsidianReceipt : undefined)");
    expect(css).toContain('.forge-power-shell [hidden]{display:none!important}');
  });

  it('makes the visible orb and Retry safely copy part of the same accessible control', () => {
    const html = readFileSync(resolve('apps/extension/src/popup.html'), 'utf8');
    expect(html).toMatch(/<button id="forge-power"[^>]*class="forge-power-panel"/);
    expect(html.indexOf('class="forge-power"')).toBeGreaterThan(html.indexOf('id="forge-power"'));
    expect(html.indexOf('id="forge-power-label"')).toBeGreaterThan(html.indexOf('id="forge-power"'));
    expect(html.indexOf('</button>')).toBeGreaterThan(html.indexOf('id="forge-power-detail"'));
    expect((html.match(/id="forge-power"/g) ?? [])).toHaveLength(1);
    expect(html).not.toMatch(/onclick=/i);
  });

  it('keeps Enter and Space on native button semantics without custom keyboard interception', () => {
    const html = readFileSync(resolve('apps/extension/src/popup.html'), 'utf8');
    const source = readFileSync(resolve('apps/extension/src/central-forge-power-controller.js'), 'utf8');
    expect(html).toMatch(/<button id="forge-power"[^>]*type="button"/);
    expect(source).not.toMatch(/keydown|keyup|keypress/);
    expect(source).not.toContain('preventDefault');
    expect(source).not.toContain('stopPropagation');
  });

  it('prevents decorative orb pseudo-elements from intercepting pointer events', () => {
    const css = readFileSync(resolve('apps/extension/src/central-forge-power.css'), 'utf8');
    expect(css).toContain('.forge-power,.forge-power::before,.forge-power::after{pointer-events:none}');
    expect(css).not.toMatch(/\.forge-power(?:-panel)?::(?:before|after)\{(?![^}]*pointer-events:none)[^}]*position:absolute/);
  });

  it('keeps the single clickable control wide enough at 375px and 390px popup widths', () => {
    const css = readFileSync(resolve('apps/extension/src/central-forge-power.css'), 'utf8');
    expect(css).toContain('.forge-power-panel{position:relative;display:grid');
    expect(css).toContain('width:100%');
    expect(css).toContain('min-height:122px');
    expect(css).toContain('@media (max-width:380px)');
    expect(css).toContain('.forge-power-panel{padding:15px 10px}');
  });
});
