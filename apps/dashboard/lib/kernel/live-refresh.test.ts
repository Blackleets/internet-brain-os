import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { KernelEvent } from './events';
import { refreshOnKernelEvents } from './live-refresh';

function fakeSubscribe() {
  let handler: ((event: KernelEvent) => void) | undefined;
  const unsubscribe = vi.fn();
  const subscribe = vi.fn((onEvent: (event: KernelEvent) => void) => { handler = onEvent; return unsubscribe; });
  return { subscribe, unsubscribe, emit: (event: KernelEvent) => handler?.(event) };
}

describe('refreshOnKernelEvents (dashboard live refresh)', () => {
  it('refreshes immediately on mission.created and mission.updated only', () => {
    const stream = fakeSubscribe();
    const refreshNow = vi.fn();
    refreshOnKernelEvents(stream.subscribe, refreshNow);
    stream.emit({ type: 'mission.created', payload: { missionId: 'm1' } });
    stream.emit({ type: 'mission.updated', payload: { missionId: 'm1', status: 'completed' } });
    stream.emit({ type: 'chat.delta', payload: {} });
    expect(refreshNow).toHaveBeenCalledTimes(2);
  });

  it('never treats the event payload as the record: it only asks for a re-read', () => {
    const stream = fakeSubscribe();
    const refreshNow = vi.fn();
    refreshOnKernelEvents(stream.subscribe, refreshNow);
    stream.emit({ type: 'mission.updated', payload: { missionId: 'm1', status: 'completed' } });
    expect(refreshNow).toHaveBeenCalledWith();
  });

  it('returns the stream unsubscribe', () => {
    const stream = fakeSubscribe();
    const stop = refreshOnKernelEvents(stream.subscribe, vi.fn());
    stop();
    expect(stream.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('is mounted in the product shell next to the polling fallback', () => {
    const shell = readFileSync(new URL('../../components/efesto-product-shell.tsx', import.meta.url), 'utf8');
    expect(shell).toContain('startVisiblePoller(poll, 3_000, document)');
    expect(shell).toMatch(/refreshOnKernelEvents\(\s*\(onEvent\) => subscribeToKernelEvents\(connection, onEvent\),\s*poller\.now,?\s*\)/);
    expect(shell).toMatch(/stopEvents\(\);\s*poller\(\);/);
  });
});
