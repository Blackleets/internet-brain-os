import { describe, expect, it } from 'vitest';
import { presentMissionLiveProgress } from './mission-live-progress.js';

describe('mission live progress #mission-state honesty', () => {
  const now = Date.parse('2026-09-07T10:00:30.000Z');

  it('keeps queued and live Hermes research elapsed copy', () => {
    expect(presentMissionLiveProgress({
      status: 'queued',
      createdAt: '2026-09-07T10:00:00.000Z',
    }, now)).toEqual({
      text: 'Queued for Hermes · 30s elapsed · waiting',
      status: 'queued',
      title: 'The mission is authorized and queued; no research lease is active yet.',
    });
    expect(presentMissionLiveProgress({
      status: 'running',
      claimedAt: '2026-09-07T10:00:00.000Z',
      createdAt: '2026-09-07T09:59:00.000Z',
    }, now)).toMatchObject({
      text: 'Hermes is researching · 30s elapsed · live',
      status: 'running',
    });
  });

  it('does not brand Kernel verifying as live Hermes research on #mission-state', () => {
    // status stays running while executionPhase/workState is verifying (honest-blocked path).
    const byPhase = presentMissionLiveProgress({
      status: 'running',
      executionPhase: 'verifying',
      claimedAt: '2026-09-07T09:55:00.000Z',
      createdAt: '2026-09-07T09:50:00.000Z',
    }, now);
    expect(byPhase).toEqual({
      text: 'Efesto is verifying findings',
      status: 'verifying',
      title: 'The local Kernel is validating Evidence. Hermes research is no longer the live phase.',
    });
    expect(byPhase.text).not.toMatch(/Hermes is researching|· live/i);

    const byWorkState = presentMissionLiveProgress({
      status: 'running',
      workState: 'verifying',
      claimedAt: '2026-09-07T09:55:00.000Z',
    }, now);
    expect(byWorkState).toMatchObject({ text: 'Efesto is verifying findings', status: 'verifying' });
    expect(byWorkState.text).not.toMatch(/Hermes is researching|elapsed|· live/i);
  });

  it('stays silent for terminal and idle missions', () => {
    expect(presentMissionLiveProgress({ status: 'completed', executionPhase: 'forged' }, now)).toBeNull();
    expect(presentMissionLiveProgress({ status: 'failed' }, now)).toBeNull();
    expect(presentMissionLiveProgress(undefined, now)).toBeNull();
  });
});
