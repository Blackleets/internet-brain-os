import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startVisiblePoller } from './visible-poller';

function fakeDocument(initial: DocumentVisibilityState = 'visible') {
  const listeners = new Set<() => void>();
  return {
    visibilityState: initial,
    addEventListener: (_type: string, listener: () => void) => { listeners.add(listener); },
    removeEventListener: (_type: string, listener: () => void) => { listeners.delete(listener); },
    set(state: DocumentVisibilityState) { this.visibilityState = state; for (const listener of listeners) listener(); },
    listenerCount: () => listeners.size,
  };
}

describe('startVisiblePoller (dashboard Kernel poll)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('now() runs a wave immediately without waiting for the interval', async () => {
    const doc = fakeDocument();
    const run = vi.fn(async () => {});
    const poller = startVisiblePoller(run, 3_000, doc);
    poller.now();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    poller();
  });

  it('now() during an in-flight wave queues exactly one follow-up wave (events are not lost)', async () => {
    const doc = fakeDocument();
    const releases: Array<() => void> = [];
    const run = vi.fn(() => new Promise<void>((resolve) => { releases.push(resolve); }));
    const poller = startVisiblePoller(run, 60_000, doc);
    poller.now();
    await vi.advanceTimersByTimeAsync(0);
    poller.now(); poller.now(); poller.now();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    releases[0]();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    releases[1]();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    poller();
  });

  it('now() does nothing while hidden or after stop', async () => {
    const doc = fakeDocument('hidden');
    const run = vi.fn(async () => {});
    const poller = startVisiblePoller(run, 60_000, doc);
    poller.now();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).not.toHaveBeenCalled();
    poller();
    doc.visibilityState = 'visible';
    poller.now();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).not.toHaveBeenCalled();
  });

  it('polls on the interval while visible', async () => {
    const doc = fakeDocument();
    const run = vi.fn(async () => {});
    const stop = startVisiblePoller(run, 3_000, doc);
    await vi.advanceTimersByTimeAsync(9_000);
    expect(run).toHaveBeenCalledTimes(3);
    stop();
  });

  it('does not poll while the tab is hidden, and refreshes once on return', async () => {
    const doc = fakeDocument('hidden');
    const run = vi.fn(async () => {});
    const stop = startVisiblePoller(run, 3_000, doc);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(run).not.toHaveBeenCalled();
    doc.set('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    stop();
  });

  it('never overlaps: a slow Kernel poll suppresses ticks until it settles', async () => {
    const doc = fakeDocument();
    let release: () => void = () => {};
    const run = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const stop = startVisiblePoller(run, 3_000, doc);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(run).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
  });

  it('survives a failing poll and stops cleanly', async () => {
    const doc = fakeDocument();
    const run = vi.fn(async () => { throw new Error('offline'); });
    const stop = startVisiblePoller(run, 3_000, doc);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
    expect(doc.listenerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('is what the mounted shell uses instead of a bare setInterval', () => {
    const shell = readFileSync(new URL('../../components/efesto-product-shell.tsx', import.meta.url), 'utf8');
    expect(shell).toContain("import { startVisiblePoller } from '../lib/ui/visible-poller';");
    expect(shell).toContain('startVisiblePoller(poll, 3_000, document)');
    expect(shell).not.toContain('window.setInterval(() => { void poll(); }, 3_000)');
  });
});
