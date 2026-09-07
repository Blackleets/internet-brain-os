import { describe, it, expect, vi } from 'vitest';
import { listGoals, sendPageContext } from './local-transport.js';
import {
  AutoRadar,
  AUTO_RADAR_STATES,
  FIND_OR_ADMIT_COPY,
  autoRadarActionTitle,
  autoRadarLastResultLabel,
  autoRadarStatusCopy,
  pageContextCaptureIsFind,
  radarEventAfterEvidenceCapture,
} from './auto-radar.js';

vi.mock('./local-transport.js', () => ({
  listGoals: vi.fn(async () => []),
  sendPageContext: vi.fn(async () => ({ ok: true, receiptId: 'r1', caseId: 'c1', evidenceId: 'e1' })),
}));

// Helper: crea una instancia sin disparar el constructor (que toca chrome.storage).
function makeRadar() {
  const radar = Object.create(AutoRadar.prototype);
  radar.kernelBaseUrl = 'http://127.0.0.1:4000';
  radar.kernelApiToken = 'test-token';
  radar.analysisHistory = new Map();
  radar.fuzzyHistory = new Map();
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

describe('AutoRadar fuzzy deduplication', () => {
  const page = (overrides) => ({
    url: 'https://news.example.com/article-1',
    title: 'Remote AI jobs surge across Europe',
    visibleText: 'Companies are hiring remote AI engineers. Salaries rise as demand grows for machine learning talent in Madrid and Berlin.',
    ...overrides
  });

  it('is not a duplicate on the first capture', () => {
    const radar = makeRadar();
    const r = radar.isDuplicate(page());
    expect(r.duplicate).toBe(false);
  });

  it('flags a near-identical page (fuzzy) as duplicate on second capture', () => {
    const radar = makeRadar();
    expect(radar.isDuplicate(page()).duplicate).toBe(false);
    const similar = page({
      url: 'https://mirror.other-site.net/p/123',
      title: 'AI hiring update',
      visibleText: 'Companies are hiring remote AI engineers. Salaries rise as demand grows for machine learning talent in Madrid and Berlin.'
    });
    const r = radar.isDuplicate(similar);
    expect(r.duplicate).toBe(true);
    expect(r.reason).toBe('fuzzy');
  });

  it('does not flag an unrelated page as duplicate', () => {
    const radar = makeRadar();
    expect(radar.isDuplicate(page()).duplicate).toBe(false);
    const unrelated = page({
      url: 'https://recipes.example.com/soup',
      title: 'Best potato soup recipe',
      visibleText: 'Peel the potatoes and boil them with onion and carrot for a warm winter soup.'
    });
    expect(radar.isDuplicate(unrelated).duplicate).toBe(false);
  });

  it('stores a fuzzy fingerprint after a non-duplicate capture', () => {
    const radar = makeRadar();
    radar.isDuplicate(page());
    expect(radar.fuzzyHistory.size).toBe(1);
  });
});

describe('AutoRadar.updateUI', () => {
  it('uses the Manifest V3 action badge-text API', async () => {
    const originalChrome = globalThis.chrome;
    const setBadgeText = vi.fn().mockResolvedValue(undefined);
    const setBadgeBackgroundColor = vi.fn().mockResolvedValue(undefined);
    const setTitle = vi.fn().mockResolvedValue(undefined);
    globalThis.chrome = {
      action: { setBadgeText, setBadgeBackgroundColor, setTitle },
    };

    try {
      const radar = makeRadar();
      radar.state = AUTO_RADAR_STATES.OBSERVING;
      await radar.updateUI();

      expect(setBadgeText).toHaveBeenCalledWith({ text: '👁' });
      expect(setBadgeBackgroundColor).toHaveBeenCalledOnce();
      expect(setTitle).toHaveBeenCalledWith({ title: 'Efesto Opportunity Radar - Observando' });
    } finally {
      if (originalChrome === undefined) delete globalThis.chrome;
      else globalThis.chrome = originalChrome;
    }
  });
});

describe('AutoRadar Evidence-only capture is not a Find', () => {
  const lie = FIND_OR_ADMIT_COPY;

  it('does not mint a Find from sendPageContext', () => {
    expect(pageContextCaptureIsFind()).toBe(false);
  });

  it('records jwt.io capture as Evidence, never admitted or Find', () => {
    const event = radarEventAfterEvidenceCapture({
      url: 'https://jwt.io/',
      title: 'JSON Web Tokens - jwt.io',
    });
    expect(event.status).toBe(AUTO_RADAR_STATES.CAPTURED);
    expect(event.status).not.toBe(AUTO_RADAR_STATES.ADMITTED);
    expect(event.url).toBe('https://jwt.io/');
    expect(event.title).toBe('JSON Web Tokens - jwt.io');
    expect(lie.test(autoRadarLastResultLabel(event.status))).toBe(false);
    expect(autoRadarLastResultLabel(event.status)).toBe('Evidence capturada');
    expect(lie.test(autoRadarActionTitle(AUTO_RADAR_STATES.CAPTURED))).toBe(false);
    expect(lie.test(autoRadarStatusCopy(AUTO_RADAR_STATES.CAPTURED).text)).toBe(false);
  });

  it('maps leftover admitted storage to Evidence, not Admitido or Find', () => {
    const copy = autoRadarStatusCopy(AUTO_RADAR_STATES.ADMITTED);
    expect(copy.text).toBe('Evidence capturada');
    expect(lie.test(copy.text)).toBe(false);
    expect(lie.test(autoRadarLastResultLabel('admitted'))).toBe(false);
    expect(lie.test(autoRadarActionTitle(AUTO_RADAR_STATES.ADMITTED))).toBe(false);
  });

  it('badges Evidence capturada after capture, not Admitido', async () => {
    const originalChrome = globalThis.chrome;
    const setBadgeText = vi.fn().mockResolvedValue(undefined);
    const setBadgeBackgroundColor = vi.fn().mockResolvedValue(undefined);
    const setTitle = vi.fn().mockResolvedValue(undefined);
    globalThis.chrome = { action: { setBadgeText, setBadgeBackgroundColor, setTitle } };
    try {
      const radar = makeRadar();
      radar.state = AUTO_RADAR_STATES.CAPTURED;
      await radar.updateUI();
      expect(setTitle).toHaveBeenCalledWith({ title: 'Efesto Opportunity Radar - Evidence capturada' });
      expect(setTitle.mock.calls[0][0].title).not.toMatch(lie);
      expect(setBadgeText).toHaveBeenCalledWith({ text: '📡' });
    } finally {
      if (originalChrome === undefined) delete globalThis.chrome;
      else globalThis.chrome = originalChrome;
    }
  });

  it('evaluatePage on jwt.io persists captured Evidence, not an admitted Find', async () => {
    vi.useFakeTimers();
    const originalChrome = globalThis.chrome;
    const storageSet = vi.fn().mockResolvedValue(undefined);
    listGoals.mockResolvedValue([{ id: 'g-jwt', title: 'Inspect tokens', keywords: 'jwt, debugger' }]);
    sendPageContext.mockResolvedValue({ ok: true, receiptId: 'r-jwt', caseId: 'c-jwt', evidenceId: 'e-jwt' });
    globalThis.chrome = {
      action: {
        setBadgeText: vi.fn().mockResolvedValue(undefined),
        setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
        setTitle: vi.fn().mockResolvedValue(undefined),
      },
      storage: { local: { set: storageSet, get: vi.fn().mockResolvedValue({}) } },
      tabs: {
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          context: {
            url: 'https://jwt.io/',
            title: 'JSON Web Tokens - jwt.io',
            visibleText: 'Debugger for JSON Web Tokens jwt decoder',
          },
        }),
      },
    };
    try {
      const radar = makeRadar();
      radar.enabled = true;
      radar.allowedOrigins = [];
      radar.queue = [];
      await radar.evaluatePage({ id: 7, url: 'https://jwt.io/', title: 'JSON Web Tokens - jwt.io' });
      expect(sendPageContext).toHaveBeenCalledOnce();
      expect(radar.state).toBe(AUTO_RADAR_STATES.CAPTURED);
      const eventWrites = storageSet.mock.calls
        .map((call) => call[0]?.lastRadarEvent)
        .filter(Boolean);
      expect(eventWrites.length).toBeGreaterThan(0);
      expect(eventWrites.at(-1).status).toBe('captured');
      expect(eventWrites.at(-1).url).toBe('https://jwt.io/');
      expect(eventWrites.some((event) => event.status === 'admitted')).toBe(false);
    } finally {
      vi.useRealTimers();
      if (originalChrome === undefined) delete globalThis.chrome;
      else globalThis.chrome = originalChrome;
    }
  });
});
