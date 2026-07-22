import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('one-click Hermes runtime entrypoints', () => {
  it.each([
    'apps/local-kernel/one-click-kernel.mjs',
    'apps/extension/src/one-click-mission-ui.js',
    'apps/extension/src/central-forge-power-controller.js',
    'apps/extension/src/central-forge-power.js',
    'apps/extension/src/unsupported-page-guard.js',
  ])('parses %s without executing it', (path) => {
    const result = spawnSync(process.execPath, ['--check', resolve(path)], { encoding: 'utf8', windowsHide: true });
    expect(result.status, result.stderr).toBe(0);
  });

  it('does not observe or rewrite its own research-button mutations', () => {
    const source = readFileSync(resolve('apps/extension/src/one-click-mission-ui.js'), 'utf8');
    expect(source).toContain("attributeFilter: ['data-status']");
    expect(source).toContain("goalObserver.observe(goals, { childList: true })");
    expect(source).not.toContain('subtree: true');
    expect(source).toContain('if (button.textContent !== nextText)');
  });

  it('keeps the central power cycle bounded and user-controlled', () => {
    const source = readFileSync(resolve('apps/extension/src/central-forge-power-controller.js'), 'utf8');
    expect(source).toContain("'efestoForgeEnabled'");
    expect(source).toContain('ACTIVE_STATUSES');
    expect(source).toContain('Forge cycle complete');
    expect(source).toContain('Active work will finish safely');
  });

  it('turns missing content-script receivers into a normal unsupported-page state', () => {
    const source = readFileSync(resolve('apps/extension/src/unsupported-page-guard.js'), 'utf8');
    expect(source).toContain('Receiving end does not exist');
    expect(source).toContain('Could not establish connection');
    expect(source).toContain("parsed.protocol === 'http:' || parsed.protocol === 'https:'");
    expect(source).toContain('captureButton.disabled = true');
    expect(source).toContain("status.classList.remove('error')");
  });

  it('advertises the bundled one-click Hermes worker without enabling built Kernel ingestion', () => {
    const source = readFileSync(resolve('apps/local-kernel/one-click-kernel.mjs'), 'utf8');
    const serverSource = readFileSync(resolve('apps/local-kernel/server.mjs'), 'utf8');
    expect(source).toContain("HEPHAESTUS_HERMES_READY: '1'");
    expect(source).not.toContain('HEPHAESTUS_HERMES_SECRET:');
    expect(serverSource).toContain("process.env.HEPHAESTUS_HERMES_READY === '1'");
    expect(serverSource).toContain('hermesWorkerReady || Boolean(hermes)');
    expect(source).toContain('configureBundledHermes()');
  });

  it('keeps one-click Hermes execution bounded after observable worker failures', () => {
    const source = readFileSync(resolve('apps/local-kernel/one-click-kernel.mjs'), 'utf8');
    expect(source).toContain('MAX_AUTOMATIC_MISSION_ATTEMPTS');
    expect(source).toContain('while (attempts < MAX_AUTOMATIC_MISSION_ATTEMPTS)');
    expect(source).toContain("if (result.status !== 'failed') break");
  });
});
