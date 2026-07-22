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
});
