import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createAutoRadarUiSync } from './auto-radar-ui-sync.js';

// popup.js compared the incoming radar event with itself (a shadowed `lastRadarEvent`), so
// while the Auto Radar state stayed the same every new capture/failed event was skipped and
// the open popup kept showing a stale "Último resultado"; on a state change it then assigned
// to that const and touched an undeclared timer, throwing before the UI updated.
describe('popup Auto Radar storage sync', () => {
  it('re-renders when a new radar event arrives while the state is unchanged', () => {
    const next = createAutoRadarUiSync('active');
    const captured = { status: 'captured', title: 'Page A', url: 'https://a.example/', at: 1 };
    expect(next({ lastRadarEvent: { newValue: captured } }, 'active')).toEqual({ autoRadarState: 'active', lastRadarEvent: captured });
    const failed = { status: 'failed', title: 'Page B', url: 'https://b.example/', at: 2 };
    expect(next({ lastRadarEvent: { newValue: failed } }, 'active')).toEqual({ autoRadarState: 'active', lastRadarEvent: failed });
  });

  it('skips a change that repeats the same state and event', () => {
    const next = createAutoRadarUiSync('active');
    const event = { status: 'captured', title: 'Page A', at: 1 };
    expect(next({ lastRadarEvent: { newValue: event } }, 'active')).not.toBeNull();
    expect(next({ lastRadarEvent: { newValue: { ...event } } }, 'active')).toBeNull();
  });

  it('re-renders on a state change and ignores unrelated storage keys', () => {
    const next = createAutoRadarUiSync('paused');
    expect(next({ kernelApiToken: { newValue: 'x' } }, 'paused')).toBeNull();
    expect(next({ autoRadarState: { newValue: 'active' } }, 'paused')).toEqual({ autoRadarState: 'active', lastRadarEvent: null });
  });

  it('keeps showing the last event when only the state changes', () => {
    const next = createAutoRadarUiSync('active');
    const event = { status: 'captured', title: 'Page A', at: 1 };
    next({ lastRadarEvent: { newValue: event } }, 'active');
    expect(next({ autoRadarState: { newValue: 'paused' } }, 'active')).toEqual({ autoRadarState: 'paused', lastRadarEvent: event });
  });

  it('is what popup.js uses for the storage listener', () => {
    const popup = readFileSync(new URL('./popup.js', import.meta.url), 'utf8');
    expect(popup).toContain("import { createAutoRadarUiSync } from './auto-radar-ui-sync.js';");
    expect(popup).not.toContain('lastRadarEvent.status === lastRadarEvent.status');
    // popup.js is a strict ES module: the debounce timer must be declared or clearTimeout throws.
    expect(popup).toMatch(/let autoRadarUIUpdateTimeout;/);
  });

  // pair() and saveToken() re-run initialize(); a listener registered inside it piled up one
  // more chrome.storage.onChanged handler per re-pair, rendering every change several times.
  it('registers the popup storage listener once, outside initialize()', () => {
    const popup = readFileSync(new URL('./popup.js', import.meta.url), 'utf8');
    const registrations = popup.match(/chrome\.storage\.onChanged\.addListener\(/g) ?? [];
    expect(registrations).toHaveLength(1);
    const start = popup.indexOf('async function initialize()');
    let depth = 0; let end = popup.indexOf('{', start);
    for (let i = end; i < popup.length; i += 1) {
      if (popup[i] === '{') depth += 1;
      if (popup[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
    }
    expect(popup.slice(start, end)).not.toContain('chrome.storage.onChanged.addListener(');
    expect(popup).toMatch(/\bpair\(\)[\s\S]*await initialize\(\)/);
  });
});
