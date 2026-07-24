import { describe, it, expect } from 'vitest';
import { AutoRadar, AUTO_RADAR_STATES } from './auto-radar.js';

// Helper: crea una instancia sin disparar el constructor (que toca chrome.storage).
function makeRadar() {
  const radar = Object.create(AutoRadar.prototype);
  radar.kernelBaseUrl = 'http://127.0.0.1:4000';
  radar.kernelApiToken = 'test-token';
  return radar;
}

const page = (overrides) => ({
  url: 'https://example.com/jobs/remote-ai',
  title: 'Remote AI Engineer openings this week',
  visibleText: 'We are hiring a remote AI engineer. Salary and benefits included.',
  ...overrides
});

describe('AutoRadar.scoreRelevance', () => {
  it('is irrelevant when there are no active goals', () => {
    const radar = makeRadar();
    const r = radar.scoreRelevance(page(), []);
    expect(r.relevant).toBe(false);
    expect(r.score).toBe(0);
    expect(r.reason).toBe('no_goals');
  });

  it('matches a goal by keyword in the page title', () => {
    const radar = makeRadar();
    const goals = [{ id: 'g1', title: 'Find remote AI work', keywords: 'remote, ai, engineer', categories: ['job'] }];
    const r = radar.scoreRelevance(page(), goals);
    expect(r.relevant).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(25);
    expect(r.matchedGoalId).toBe('g1');
  });

  it('matches a goal when keyword appears both in title and body', () => {
    const radar = makeRadar();
    const goals = [{ id: 'g2', title: 'Scholarships', keywords: 'scholarship' }];
    const r = radar.scoreRelevance(page({ title: 'Scholarship list', visibleText: 'Apply for the scholarship before Friday.' }), goals);
    // titleKeyword (35) + bodyKeyword (20) = 55 >= threshold (25)
    expect(r.relevant).toBe(true);
    expect(r.matchedGoalId).toBe('g2');
  });

  it('is below threshold with a single body-only keyword mention', () => {
    const radar = makeRadar();
    const goals = [{ id: 'g2b', title: 'Scholarships', keywords: 'scholarship' }];
    const r = radar.scoreRelevance(page({ title: 'Random blog', visibleText: 'Apply for the scholarship before Friday.' }), goals);
    // bodyKeyword alone (20) < threshold (25) -> not relevant, avoiding noise
    expect(r.relevant).toBe(false);
  });

  it('is irrelevant when no goal signal is present', () => {
    const radar = makeRadar();
    const goals = [{ id: 'g3', title: 'Cooking recipes', keywords: 'recipe, kitchen' }];
    const r = radar.scoreRelevance(page(), goals);
    expect(r.relevant).toBe(false);
  });

  it('matches a goal by location (origin host contains location)', () => {
    const radar = makeRadar();
    const goals = [{ id: 'g4', title: 'Madrid housing', keywords: 'piso', location: 'madrid' }];
    const r = radar.scoreRelevance(page({ url: 'https://madrid.craigslist.org/housing', title: 'Flats in madrid' }), goals);
    expect(r.relevant).toBe(true);
  });

  it('score is clamped to 100', () => {
    const radar = makeRadar();
    const goals = [{ id: 'g5', title: 'remote ai engineer', keywords: 'remote, ai, engineer, remote ai, engineer remote' }];
    const r = radar.scoreRelevance(page(), goals);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('AUTO_RADAR_STATES has IRRELEVANT', () => {
  it('defines the irrelevant terminal state used by goal matching', () => {
    expect(AUTO_RADAR_STATES.IRRELEVANT).toBe('irrelevant');
  });
});
