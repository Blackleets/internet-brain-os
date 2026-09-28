import { afterEach, describe, expect, it, vi } from 'vitest';
import { agentHubRefreshDelay, createAgentHubRefresher, missionRevision } from './agent-hub-refresh.js';

afterEach(() => vi.useRealTimers());

describe('Agent Hub live refresh', () => {
  it('uses bounded state-aware refresh intervals', () => {
    expect(agentHubRefreshDelay([])).toBe(10000);
    expect(agentHubRefreshDelay([{ status: 'queued', createdAt: '2026-07-22T10:00:00Z' }])).toBe(3000);
    expect(agentHubRefreshDelay([{ status: 'running', executionPhase: 'investigating', createdAt: '2026-07-22T10:00:00Z' }])).toBe(1000);
    expect(agentHubRefreshDelay([{ status: 'running', executionPhase: 'verifying', createdAt: '2026-07-22T10:00:00Z' }])).toBe(1000);
    expect(agentHubRefreshDelay([{ status: 'completed', createdAt: '2026-07-22T10:00:00Z' }])).toBe(10000);
  });

  it('tracks only observable mission revisions', () => {
    const base = { id: 'mission:1', status: 'running', executionPhase: 'investigating', attempt: 1, createdAt: '2026-07-22T10:00:00Z' };
    expect(missionRevision([base])).not.toBe(missionRevision([{ ...base, executionPhase: 'verifying', verifyingAt: '2026-07-22T10:01:00Z' }]));
    expect(missionRevision([])).toBe('none');
  });

  it('pauses while hidden, refreshes immediately on return, and never overlaps requests', async () => {
    vi.useFakeTimers();
    let visible = true;
    let release;
    const refresh = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const controller = createAgentHubRefresher({ refresh, isVisible: () => visible });
    controller.start([{ status: 'running', createdAt: '2026-07-22T10:00:00Z' }]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(refresh).toHaveBeenCalledTimes(1);
    release([{ status: 'completed', createdAt: '2026-07-22T10:00:00Z' }]);
    await Promise.resolve();

    visible = false;
    controller.visibilityChanged();
    await vi.advanceTimersByTimeAsync(20000);
    expect(refresh).toHaveBeenCalledTimes(1);

    visible = true;
    controller.visibilityChanged();
    expect(refresh).toHaveBeenCalledTimes(2);
    controller.stop();
  });

  it('keeps refreshing after a temporary Kernel failure', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn()
      .mockRejectedValueOnce(new Error('Kernel restarting'))
      .mockResolvedValue([{ status: 'running', createdAt: '2026-07-22T10:00:00Z' }]);
    const controller = createAgentHubRefresher({ refresh });
    controller.start([{ status: 'running', createdAt: '2026-07-22T10:00:00Z' }]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(refresh).toHaveBeenCalledTimes(2);
    controller.stop();
  });

  // The popup kept a green "Kernel ready" and a running mission forever when the Kernel went
  // away mid-session, polling a dead Kernel every second.
  it('reports the Kernel unreachable after 2 consecutive failures and reachable again on recovery', async () => {
    vi.useFakeTimers();
    const reachability = [];
    const refresh = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([{ status: 'running', createdAt: '2026-07-22T10:00:00Z' }])
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue([{ status: 'running', createdAt: '2026-07-22T10:00:00Z' }]);
    const controller = createAgentHubRefresher({ refresh, onKernelReachability: (online) => reachability.push(online) });
    controller.start([{ status: 'running', createdAt: '2026-07-22T10:00:00Z' }]);
    await vi.advanceTimersByTimeAsync(1000); // fail 1
    await vi.advanceTimersByTimeAsync(1000); // success resets the streak
    expect(reachability).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000); // fail 1
    await vi.advanceTimersByTimeAsync(1000); // fail 2 -> unreachable
    expect(reachability).toEqual([false]);
    expect(refresh).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(10000); // fail 3: still unreachable, not re-announced
    expect(reachability).toEqual([false]);
    await vi.advanceTimersByTimeAsync(10000); // recovery
    expect(reachability).toEqual([false, true]);
    controller.stop();
  });

  it('backs off to the idle cadence while the Kernel is unreachable', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockRejectedValue(new Error('offline'));
    const controller = createAgentHubRefresher({ refresh });
    controller.start([{ status: 'running', createdAt: '2026-07-22T10:00:00Z' }]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(refresh).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(9000);
    expect(refresh).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).toHaveBeenCalledTimes(3);
    controller.stop();
  });

  it('popup marks #kernel-state offline and ready from the refresher', async () => {
    const { readFileSync } = await import('node:fs');
    const popup = readFileSync(new URL('./popup.js', import.meta.url), 'utf8');
    expect(popup).toMatch(/onKernelReachability: \(online\) => setKernelState\(online\)/);
    expect(popup).toContain("'Kernel offline'");
  });
});
