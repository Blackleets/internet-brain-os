import { describe, expect, it } from 'vitest';
import { missionJourney, newestMission, onboardingJourney } from './product-journey.js';

describe('Efesto product journey', () => {
  it('selects the newest mission regardless of transport ordering', () => {
    expect(newestMission([{ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' }, { id: 'new', createdAt: '2026-02-01T00:00:00.000Z' }])?.id).toBe('new');
  });

  it('maps persisted mission state to honest named stages', () => {
    expect(missionJourney({ status: 'running' }).stages.map((stage) => stage.state)).toEqual(['complete', 'active', 'pending', 'pending']);
    expect(missionJourney({ status: 'running', executionPhase: 'verifying' }).stages.map((stage) => stage.state)).toEqual(['complete', 'complete', 'active', 'pending']);
    expect(missionJourney({ status: 'completed' }).stages.every((stage) => stage.state === 'complete')).toBe(true);
    expect(missionJourney({ status: 'failed', attempt: 2 }).stages[2].state).toBe('error');
  });

  it('guides the user to the first unfinished product action', () => {
    expect(onboardingJourney({ connected: true, goalCount: 1 }).next).toMatchObject({ id: 'radar', view: 'forge' });
    expect(onboardingJourney({ connected: true, goalCount: 1, radarEnabled: true, findCount: 1 }).complete).toBe(true);
  });
});
