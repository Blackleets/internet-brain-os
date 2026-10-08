import { expect, test, type Page, type Route } from '@playwright/test';

// TEST FIXTURE: Kernel-shaped responses for the forge live view, served through page.route on top of
// e2e/kernel-fixture.mjs. They are labelled fixtures, never product data.
const token = 'test-token-that-is-long-enough-for-kernel-validation';
const MISSION = 'mission-forge-fixture';
const cors = {
  'access-control-allow-origin': 'http://127.0.0.1:3000',
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};
const candidates = [
  { id: 'cand-a', url: 'https://docs.fixture.example/ownership', title: 'Fixture: Ownership', snippet: 'HERMES SNIPPET FIXTURE A', status: 'verified' },
  { id: 'cand-b', url: 'https://blog.fixture.example/borrowing-notes', title: 'Fixture: Borrowing notes', snippet: 'HERMES SNIPPET FIXTURE B', status: 'verified' },
  { id: 'cand-c', url: 'https://down.fixture.example/', title: 'Fixture: Down site', snippet: 'HERMES SNIPPET FIXTURE C', status: 'verification_failed' },
];
const verificationResults = [
  { candidateId: 'cand-a', status: 'verified', evidenceId: 'evidence-forge-a', sourceUrl: candidates[0].url, supported: true, supportReason: 'supported' },
  { candidateId: 'cand-b', status: 'verified', evidenceId: 'evidence-forge-b', sourceUrl: candidates[1].url, supported: false, supportReason: 'insufficient_term_coverage' },
  { candidateId: 'cand-c', status: 'verification_failed', reason: 'web.read returned HTTP 503' },
];
const missions = { ok: true, missions: [{ id: MISSION, goalId: 'goal-forge', goalTitle: 'Fixture ownership guide', status: 'completed', executionPhase: 'forged', attempt: 1, createdAt: '2026-07-26T10:00:00.000Z', searchCandidates: candidates, verificationResults }] };
const surfaces = { ok: true, surfaces: [{
  schemaVersion: 'efesto.goal-surface.v1', sourceOfTruth: 'kernel', observedAt: '2026-07-26T10:03:00.000Z',
  goal: { id: 'goal-forge', title: 'Fixture ownership guide', status: 'active', revision: 1, createdAt: '2026-07-26T10:00:00.000Z', updatedAt: '2026-07-26T10:00:00.000Z', compatibility: 'legacy_radar', policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' } },
  mission: { id: MISSION, status: 'completed', executionPhase: 'forged', workState: 'forged', createdAt: '2026-07-26T10:00:00.000Z', updatedAt: '2026-07-26T10:03:00.000Z', attempt: 1 },
}] };
const evidence = { ok: true, schemaVersion: 'efesto.mission-evidence.v1', sourceOfTruth: 'kernel', missionId: MISSION, limits: { maxRecords: 20, maxExcerptChars: 280 }, evidence: [
  { id: 'evidence-forge-a', candidateId: 'cand-a', caseId: 'case-forge-a', sourceUrl: candidates[0].url, title: 'Ownership (fixture page)', capturedAt: '2026-07-26T10:02:00.000Z', contentHash: 'fixture', extractionMethod: 'kernel-web-read-v1', supported: true, supportReason: 'supported', excerpt: { text: 'Fixture excerpt: ownership is a set of rules that govern memory.', anchor: 'goal_term', truncatedStart: true, truncatedEnd: false } },
  { id: 'evidence-forge-b', candidateId: 'cand-b', caseId: 'case-forge-b', sourceUrl: candidates[1].url, title: 'Borrowing notes (fixture page)', capturedAt: '2026-07-26T10:02:01.000Z', contentHash: 'fixture', extractionMethod: 'kernel-web-read-v1', supported: false, supportReason: 'insufficient_term_coverage', excerpt: null },
] };

const opportunities = { ok: true, opportunities: [{ id: 'opportunity-forge-a', category: 'goal', categoryLabel: 'Goal match', benefitType: 'information', title: 'Ownership (fixture Find)', sourceHost: 'docs.fixture.example', relevance: 80, nextAction: 'Read the fixture page', status: 'new', detectedAt: '2026-07-26T10:02:00.000Z', evidenceId: 'evidence-forge-a', caseId: 'case-forge-a', sourceUrl: candidates[0].url, supported: true }] };

const fulfill = (body: unknown) => (route: Route) => (route.request().method() === 'GET'
  ? route.fulfill({ status: 200, headers: cors, body: JSON.stringify(body) })
  : route.fallback());

async function useForgeFixture(page: Page): Promise<void> {
  await page.route('http://127.0.0.1:4100/api/agent-missions', fulfill(missions));
  await page.route('http://127.0.0.1:4100/api/goal-surfaces', fulfill(surfaces));
  await page.route(`http://127.0.0.1:4100/api/agent-missions/${MISSION}/evidence`, fulfill(evidence));
  await page.route('http://127.0.0.1:4100/api/opportunities', fulfill(opportunities));
}

for (const width of [390, 1280]) {
  test(`source marks stay local and preserve SUPPORT at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const remoteRequests: string[] = [];
    page.on('request', (request) => {
      const host = new URL(request.url()).hostname;
      if (host !== '127.0.0.1' && host !== 'localhost') remoteRequests.push(host);
    });
    const branded = (value: unknown) => JSON.parse(JSON.stringify(value).replaceAll('docs.fixture.example/ownership', 'github.com/git-guides').replaceAll('docs.fixture.example', 'github.com'));
    await useForgeFixture(page);
    await page.route('http://127.0.0.1:4100/api/agent-missions', fulfill(branded(missions)));
    await page.route(`http://127.0.0.1:4100/api/agent-missions/${MISSION}/evidence`, fulfill(branded(evidence)));
    await page.route('http://127.0.0.1:4100/api/opportunities', fulfill(branded(opportunities)));
    await page.goto('/');
    await connect(page);
    await openHome(page, width < 760);
    const supported = page.locator('.forge-source[data-state="supported"]');
    await expect(supported.locator('.efesto-source-mark img')).toHaveAttribute('src', '/brand/sources/github.png');
    await expect.poll(() => supported.locator('img').evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('.forge-source[data-state="unsupported"] .efesto-source-mark')).toHaveText('BL');
    await expectNoHorizontalOverflow(page, width);
    expect(remoteRequests).toEqual([]);
  });
}

async function connect(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Conectar Kernel' }).first().click();
  await page.getByRole('textbox', { name: 'URL del Kernel', exact: true }).fill('http://127.0.0.1:4100');
  await page.getByLabel('Token privado', { exact: true }).fill(token);
  await page.getByRole('button', { name: 'Autorizar dispositivo', exact: true }).click();
}

async function openHome(page: Page, mobile: boolean): Promise<void> {
  if (mobile) await page.getByRole('button', { name: 'Alternar navegación' }).first().click();
  await page.locator('.efesto-sidebar nav').getByRole('button', { name: /^Inicio/ }).click();
}

async function expectNoHorizontalOverflow(page: Page, width: number): Promise<void> {
  const sizes = await page.evaluate(() => {
    const forge = document.querySelector('.forge-live') as HTMLElement | null;
    return { document: document.documentElement.scrollWidth, forgeScroll: forge?.scrollWidth ?? 0, forgeClient: forge?.clientWidth ?? 0 };
  });
  expect(sizes.document).toBe(width);
  expect(sizes.forgeScroll).toBeLessThanOrEqual(sizes.forgeClient);
}

// Phone: the forge scrolls in its own row above the bottom tab bar; its end (cards, legend, the Goal
// composer below the forge) can always be scrolled fully above the tab bar, which never covers it.
async function expectForgeClearOfTabbar(page: Page): Promise<void> {
  await page.locator('.forge-live-legend').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  const layout = await page.evaluate(() => {
    const bottom = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().bottom ?? Number.NaN;
    return { scroll: bottom('.forge-scroll'), legend: bottom('.forge-live-legend'), lastCard: Math.max(...[...document.querySelectorAll('.forge-source')].map((el) => el.getBoundingClientRect().bottom)), tabbarTop: document.querySelector('.efesto-tabbar')?.getBoundingClientRect().top ?? Number.NaN };
  });
  expect(layout.scroll).toBeLessThanOrEqual(layout.tabbarTop + 1);
  expect(layout.legend).toBeLessThanOrEqual(layout.tabbarTop);
  expect(layout.lastCard).toBeLessThanOrEqual(layout.tabbarTop);
  await page.locator('.forge-composer').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  const composer = await page.evaluate(() => ({ bottom: document.querySelector('.forge-composer')?.getBoundingClientRect().bottom ?? Number.NaN, tabbarTop: document.querySelector('.efesto-tabbar')?.getBoundingClientRect().top ?? Number.NaN }));
  expect(composer.bottom).toBeLessThanOrEqual(composer.tabbarTop + 1);
  await page.locator('.forge-live-anvil').evaluate((el) => el.scrollIntoView({ block: 'start' }));
}

async function expectHonestSources(page: Page): Promise<void> {
  const forge = page.locator('.forge-live');
  await expect(forge.getByRole('heading', { name: 'Fixture ownership guide' })).toBeVisible();
  await expect(forge.locator('.forge-source[data-state="supported"]')).toHaveCount(1);
  await expect(forge.locator('.forge-source[data-state="unsupported"]')).toHaveCount(1);
  await expect(forge.locator('.forge-source[data-state="read_failed"]')).toHaveCount(1);
  // The replay reveals each card as the Kernel reached it; the verdicts are on screen once it settles.
  await expect(forge.locator('.forge-source[data-state="supported"]')).toHaveAttribute('data-stage', 'gold', { timeout: 15_000 });
  await expect(forge.getByText(/Fixture excerpt: ownership is a set of rules/)).toBeVisible();
  await expect(forge.getByText(/HERMES SNIPPET FIXTURE/)).toHaveCount(0);
  await expect(forge.getByText(/no cubre suficientes términos del Goal/i)).toBeVisible();
  await expect(forge.getByLabel('Contadores de la misión')).toContainText('SUPPORT');
}

test('forge live view on a 390×844 phone: real Kernel states, readable cards, no overflow', async ({ page }, testInfo) => {
  // Two full play-throughs of the real records (first view + replay) run in this test.
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await useForgeFixture(page);
  await page.goto('/');
  await connect(page);
  await openHome(page, true);
  await expect(page.locator('.forge-live')).toHaveAttribute('data-layout', 'narrow');
  await expectHonestSources(page);
  await expect(page.locator('.forge-live-stepnow')).toHaveText('Paso 5 de 5 · Find forjado');
  await expectNoHorizontalOverflow(page, 390);
  // The play-through ends on the real Kernel verdicts: gold for SUPPORT, ash for the rest.
  await expect(page.locator('.forge-source[data-state="supported"]')).toHaveAttribute('data-stage', 'gold', { timeout: 15_000 });
  await expect(page.locator('.forge-source[data-state="read_failed"]')).toHaveAttribute('data-stage', 'ash');
  // Touch targets stay usable on a phone (measured once the card settled, no transform).
  const link = page.locator('.forge-source[data-state="supported"] .forge-source-link');
  expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(36);
  await expect(page.locator('.forge-source[data-state="supported"] mark.forge-term')).toHaveText(['Fixture', 'ownership']);
  await expect(page.locator('.forge-bench')).toHaveAttribute('data-mode', 'searched');
  await expect(page.locator('.forge-bench-meta')).toHaveText('Búsqueda web terminada · 3 candidatos reales');
  await page.screenshot({ path: testInfo.outputPath('forge-mobile-390x844.png') });
  await expectForgeClearOfTabbar(page);
  // Replay re-runs the same Kernel records from the start, then settles on the same verdicts.
  await page.getByRole('button', { name: /Repetir la forja/ }).click();
  await expect(page.locator('.forge-bench-meta')).toHaveText('Reconstrucción · datos reales del Kernel');
  await expect(page.locator('.forge-source[data-state="supported"]')).not.toHaveAttribute('data-stage', 'gold');
  await expect(page.locator('.forge-source[data-state="supported"]')).toHaveAttribute('data-stage', 'gold', { timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Repetir la forja/ })).toBeEnabled({ timeout: 10_000 });
});

test('forge on a phone while the agent works: focuses the active mission, shows the Goal search honestly, no fake sparks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const queuedSurface = { ...surfaces.surfaces[0], goal: { ...surfaces.surfaces[0].goal, id: 'goal-queued', title: 'Fixture newer queued goal' }, mission: { ...surfaces.surfaces[0].mission, id: 'mission-queued', status: 'queued', executionPhase: 'queued', workState: 'queued' } };
  const searchingSurface = { ...surfaces.surfaces[0], mission: { ...surfaces.surfaces[0].mission, status: 'running', executionPhase: 'investigating', workState: 'investigating' } };
  const searchingMission = { ...missions.missions[0], status: 'running', executionPhase: 'investigating', searchCandidates: [], verificationResults: [], scope: { keywords: ['ownership', 'rust'] }, investigatingAt: '2026-07-26T10:01:00.000Z' };
  await page.route('http://127.0.0.1:4100/api/agent-missions', fulfill({ ok: true, missions: [searchingMission, { ...searchingMission, id: 'mission-queued', goalId: 'goal-queued', goalTitle: 'Fixture newer queued goal', status: 'queued', executionPhase: 'queued' }] }));
  await page.route('http://127.0.0.1:4100/api/goal-surfaces', fulfill({ ok: true, surfaces: [queuedSurface, searchingSurface] }));
  await page.goto('/');
  await connect(page);
  await openHome(page, true);
  const forge = page.locator('.forge-live');
  await expect(forge.getByRole('heading', { name: 'Fixture ownership guide' })).toBeVisible();
  await expect(forge.locator('.forge-bench')).toHaveAttribute('data-mode', 'searching');
  await expect(forge.locator('.forge-bench-q')).toHaveText('«Fixture ownership guide»');
  // The exact query is not published: the chip says it searches from the Goal.
  await expect(forge.locator('.forge-chip-tag')).toHaveText(/desde el Goal/i);
  await expect(forge.locator('.forge-chip-tag')).toBeVisible();
  await expect(forge.locator('.forge-bench-meta')).toContainText('la consulta exacta no la publica el Kernel');
  await expect(forge.locator('.forge-source')).toHaveCount(0);
  await expectNoHorizontalOverflow(page, 390);
});

test('a queued mission breathes honestly: waiting for the agent, clear next step, no search claim', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const queuedSurface = { ...surfaces.surfaces[0], mission: { ...surfaces.surfaces[0].mission, status: 'queued', executionPhase: 'queued', workState: 'queued' } };
  await page.route('http://127.0.0.1:4100/api/agent-missions', fulfill({ ok: true, missions: [{ ...missions.missions[0], status: 'queued', executionPhase: 'queued', searchCandidates: [], verificationResults: [] }] }));
  await page.route('http://127.0.0.1:4100/api/goal-surfaces', fulfill({ ok: true, surfaces: [queuedSurface] }));
  await page.goto('/');
  await connect(page);
  await openHome(page, true);
  const forge = page.locator('.forge-live');
  await expect(forge.locator('.forge-bench')).toHaveAttribute('data-mode', 'waiting');
  await expect(forge.getByText('Esperando turno del agente', { exact: true })).toBeVisible();
  // Said once: the header detail does not repeat the workbench title.
  await expect(forge.getByText(/esperando turno del agente/i)).toHaveCount(1);
  await expect(forge.getByText(/Siguiente: Hermes toma la misión/)).toBeVisible();
  await expect(forge.locator('.forge-bench-query')).toHaveCount(0);
  await expect(forge.locator('.forge-source')).toHaveCount(0);
  await expect(forge.getByRole('button', { name: /Repetir la forja/ })).toHaveCount(0);
});

test('a mission the Kernel left read without SUPPORT and without a lease is offered "Buscar más" (keeps earlier attempts) through the Goal confirm endpoint, not a plain relaunch', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const stalledResults = [{ candidateId: 'cand-b', status: 'verified', evidenceId: 'evidence-forge-b', sourceUrl: candidates[1].url, supported: false, supportReason: 'homepage_insufficient_coverage' }];
  const stalledMission = { ...missions.missions[0], status: 'running', executionPhase: 'verifying', searchCandidates: [candidates[1]], verificationResults: stalledResults };
  const stalledSurface = { ...surfaces.surfaces[0], mission: { ...surfaces.surfaces[0].mission, status: 'running', executionPhase: 'verifying', workState: 'verifying' } };
  await page.route('http://127.0.0.1:4100/api/agent-missions', fulfill({ ok: true, missions: [stalledMission] }));
  await page.route('http://127.0.0.1:4100/api/goal-surfaces', fulfill({ ok: true, surfaces: [stalledSurface] }));
  const posted: unknown[] = [];
  await page.route('http://127.0.0.1:4100/api/goals/goal-forge/missions', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    posted.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, headers: cors, body: JSON.stringify({ ok: true, mission: { ...stalledMission, status: 'queued', executionPhase: 'queued' } }) });
  });
  await page.goto('/');
  await connect(page);
  await openHome(page, true);
  const forge = page.locator('.forge-live');
  await expect(forge.getByText('Leídas sin SUPPORT', { exact: false }).first()).toBeVisible();
  await expect(forge.getByRole('button', { name: 'Relanzar misión' })).toHaveCount(0);
  const relaunch = forge.locator('header').getByRole('button', { name: 'Buscar más' });
  await expect(relaunch).toBeVisible();
  await expect(forge.getByRole('button', { name: 'Buscar más' })).toHaveCount(1);
  expect((await relaunch.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: testInfo.outputPath('forge-relaunch-390x844.png') });
  await relaunch.click();
  await expect.poll(() => posted.length).toBe(1);
  expect(posted[0]).toEqual({ confirmed: true, agent: 'hermes', cadence: 'manual', mode: 'search_more' });
  await expect(page.getByText(/Solicitud de «Buscar más» recibida por el Kernel/)).toBeVisible();
});

test('"Buscar más" on a forged mission posts search_more through the dashboard confirm path and keeps the earlier Find on screen', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const forgedMission = { ...missions.missions[0], completedAt: '2026-07-26T10:03:00.000Z' };
  // TEST FIXTURE: what the Kernel returns after search_more (new attempt queued, the forged one kept).
  const kept = { ...forgedMission, status: 'queued', executionPhase: 'queued', attempt: 0, searchMode: 'search_more', searchCandidates: undefined, verificationResults: undefined,
    knownSourceUrls: [candidates[0].url, candidates[1].url],
    priorAttempts: [{ status: 'completed', executionPhase: 'forged', searchCandidates: candidates.map(({ id, url, title, status }) => ({ id, url, title, status })), verificationResults }] };
  const keptSurface = { ...surfaces.surfaces[0], mission: { ...surfaces.surfaces[0].mission, status: 'queued', executionPhase: 'queued', workState: 'queued' } };
  let searched = false;
  await page.route('http://127.0.0.1:4100/api/agent-missions', (route) => fulfill({ ok: true, missions: [searched ? kept : forgedMission] })(route));
  await page.route('http://127.0.0.1:4100/api/goal-surfaces', (route) => fulfill(searched ? { ok: true, surfaces: [keptSurface] } : surfaces)(route));
  await page.route(`http://127.0.0.1:4100/api/agent-missions/${MISSION}/evidence`, (route) => fulfill(searched
    ? { ...evidence, evidence: evidence.evidence.map((item) => ({ ...item, priorAttempt: true })) }
    : evidence)(route));
  await page.route('http://127.0.0.1:4100/api/opportunities', fulfill(opportunities));
  const posted: unknown[] = [];
  await page.route('http://127.0.0.1:4100/api/goals/goal-forge/missions', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    posted.push(route.request().postDataJSON());
    searched = true;
    await route.fulfill({ status: 201, headers: cors, body: JSON.stringify({ ok: true, mission: kept }) });
  });
  await page.goto('/');
  await connect(page);
  await openHome(page, true);
  const forge = page.locator('.forge-live');
  const searchMore = forge.getByRole('button', { name: 'Buscar más' });
  await expect(searchMore).toBeVisible();
  await expect(forge.getByRole('button', { name: 'Relanzar misión' })).toHaveCount(0);
  expect((await searchMore.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await searchMore.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('forge-search-more-button-390x844.png') });
  await searchMore.click();
  await expect.poll(() => posted.length).toBe(1);
  expect(posted[0]).toEqual({ confirmed: true, agent: 'hermes', cadence: 'manual', mode: 'search_more' });
  await expect(page.getByText(/Solicitud de «Buscar más» recibida por el Kernel/)).toBeVisible();
  await expect(forge.getByRole('button', { name: 'Buscar más' })).toHaveCount(0);
  const prior = forge.locator('.forge-live-prior');
  await expect(prior).toContainText('Intento anterior · 1 SUPPORT · 2 Evidence');
  await expect(prior.locator('.forge-source[data-state="supported"]')).toHaveCount(1);
  await expect(prior.getByText(/Fixture excerpt: ownership is a set of rules/)).toBeVisible();
  // The new attempt's counters start empty: the kept Find is not counted again.
  await expect(forge.getByLabel('Contadores de la misión')).not.toContainText(/[0-9]/);
  await prior.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('forge-search-more-390x844.png') });
  await expectNoHorizontalOverflow(page, 390);
});

for (const size of [{ width: 360, height: 780 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
  test(`forge phone polish at ${size.width}×${size.height}: steps, anvil, funnel and the gold Find in the first viewport, full-text cards, 44px targets`, async ({ page }, testInfo) => {
    await page.setViewportSize(size);
    await useForgeFixture(page);
    await page.goto('/');
    await connect(page);
    await openHome(page, true);
    await expect(page.locator('.forge-source[data-state="supported"]')).toHaveAttribute('data-stage', 'gold', { timeout: 15_000 });
    await expectNoHorizontalOverflow(page, size.width);
    const first = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
      return {
        steps: rect('.forge-live-steps')?.bottom ?? Number.NaN,
        anvil: rect('.forge-live-anvil')?.bottom ?? Number.NaN,
        find: rect('.forge-source[data-state="supported"] .forge-source-findtitle')?.bottom ?? Number.NaN,
        funnel: rect('.forge-live-counters')?.bottom ?? Number.NaN,
        tabbarTop: rect('.efesto-tabbar')?.top ?? Number.NaN,
      };
    });
    // Step bar, the whole anvil zone, the funnel and the gold Find (badge + title) are visible before any scroll.
    expect(first.steps).toBeLessThan(first.tabbarTop);
    expect(first.anvil).toBeLessThanOrEqual(first.tabbarTop);
    expect(first.funnel).toBeLessThanOrEqual(first.tabbarTop);
    expect(first.find).toBeLessThanOrEqual(first.tabbarTop);
    // The phone header is the brand lockup (no truncated crumb) and there is no anvil caption clutter.
    await expect(page.locator('.forge-product-title')).toBeHidden();
    await expect(page.locator('.forge-menu-brand')).toBeVisible();
    await expect(page.locator('.forge-live').getByText('KERNEL · GOAL')).toHaveCount(0);
    // Kernel excerpts and titles are never clamped on a phone.
    const clipped = await page.locator('.forge-source blockquote p, .forge-source-title').evaluateAll((items) => items.filter((item) => item.scrollHeight > item.clientHeight + 1).length);
    expect(clipped).toBe(0);
    const small = await page.locator('.forge-live button:visible, .forge-live a:visible, .forge-live summary:visible').evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height).filter((height) => height > 0 && height < 44));
    expect(small).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`forge-phone-${size.width}x${size.height}.png`) });
    await expectForgeClearOfTabbar(page);
  });
}

test('forge live view on desktop: wide forge stage with the Candidatos → Evidence panel on its right', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await useForgeFixture(page);
  await page.goto('/');
  await connect(page);
  await openHome(page, false);
  await expect(page.locator('.forge-live')).toHaveAttribute('data-layout', 'wide');
  await expectHonestSources(page);
  const anvil = await page.locator('.forge-live-anvil').boundingBox();
  const cards = await page.locator('.forge-source').evaluateAll((items) => items.map((item) => { const box = item.getBoundingClientRect(); return box.left + box.width / 2; }));
  expect(anvil).not.toBeNull();
  const anvilCenter = (anvil?.x ?? 0) + (anvil?.width ?? 0) / 2;
  expect(cards.length).toBe(3);
  expect(cards.every((x) => x > anvilCenter)).toBe(true);
  await expect(page.locator('.forge-live-panel')).toContainText('Candidatos → Evidence');
  await expect(page.locator('.efesto-sidebar .sidebar-goals')).toContainText('Fixture ownership guide');
  await expect(page.locator('.efesto-sidebar .kernel-summary')).toContainText('127.0.0.1:4100');
  await page.locator('.forge-live').getByRole('button', { name: /ver Find$/ }).click();
  await expect(page.getByRole('heading', { name: 'Hallazgos', exact: true })).toBeVisible();
  await expect(page.getByText('Ownership (fixture Find)', { exact: true })).toBeVisible();
  await openHome(page, false);
  await expectNoHorizontalOverflow(page, 1280);
  await page.screenshot({ path: testInfo.outputPath('forge-desktop-1280x800.png') });
});

test('result webs and the idle spider: the pages the searches returned are named (never counted) and the crawler wanders once settled', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await useForgeFixture(page);
  const searchTelemetry = { schemaVersion: 'efesto.mission-search-telemetry.v1', displayOnly: true, recordedAt: '2026-07-26T10:01:00.000Z', searches: [
    { query: 'rust ownership fixture', limit: 10, resultCount: 3, results: [{ url: candidates[0].url, title: 'Fixture: Ownership' }, { url: 'https://returned.fixture.example/a', title: 'Returned page A (fixture)' }, { url: 'https://returned.fixture.example/b' }] },
    { query: 'rust borrowing fixture', limit: 10, resultCount: 1, results: [{ url: 'https://other.fixture.example/', title: 'Returned page C (fixture)' }] },
  ] };
  await page.route('http://127.0.0.1:4100/api/agent-missions', fulfill({ ok: true, missions: [{ ...missions.missions[0], searchTelemetry }] }));
  await page.goto('/');
  await connect(page);
  await openHome(page, false);
  const forge = page.locator('.forge-live');
  const canvas = forge.locator('canvas[data-webs]');
  await expect(canvas).toHaveAttribute('data-webs', '4');
  // display-only: the list names the 4 pages, no links
  await expect(forge.locator('.forge-live-webs summary')).toHaveText(/Webs que devolvió la búsqueda\s*4/);
  await expect(forge.locator('.forge-live-webs a')).toHaveCount(0);
  // the pages get a short dwell per query before the picks, so the play-through is longer
  await expect(forge.locator('.forge-source[data-state="supported"]')).toHaveAttribute('data-stage', 'gold', { timeout: 30_000 });
  await expectHonestSources(page);
  // the counters are still the 3 real candidates (the returned pages are never counted)
  await expect(forge.locator('.forge-live-counters [data-k="candidates"] dd')).toHaveText('3', { timeout: 15_000 });
  // settled: the decorative crawler is out on its own (walks, thinks, hides)
  await expect(canvas).toHaveAttribute('data-idle', /^(walk|pause|hide)$/, { timeout: 25_000 });
  const kinds = new Set<string>();
  for (let i = 0; i < 40 && kinds.size < 2; i += 1) { kinds.add(await canvas.getAttribute('data-idle') ?? ''); await page.waitForTimeout(250); }
  expect(kinds.size).toBeGreaterThanOrEqual(2);
  await expectNoHorizontalOverflow(page, 1440);
});

test('reduced motion: no idle spider and no result-web animation, the panel list still names the pages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await useForgeFixture(page);
  const searchTelemetry = { schemaVersion: 'efesto.mission-search-telemetry.v1', displayOnly: true, recordedAt: '2026-07-26T10:01:00.000Z', searches: [
    { query: 'rust ownership fixture', limit: 10, resultCount: 1, results: [{ url: 'https://returned.fixture.example/a', title: 'Returned page A (fixture)' }] },
  ] };
  await page.route('http://127.0.0.1:4100/api/agent-missions', fulfill({ ok: true, missions: [{ ...missions.missions[0], searchTelemetry }] }));
  await page.goto('/');
  await connect(page);
  await openHome(page, true);
  const forge = page.locator('.forge-live');
  await expect(forge.locator('.forge-live-webs summary')).toHaveText(/Webs que devolvió la búsqueda\s*1/);
  // phones draw no result webs on the canvas (compact list instead)
  await expect(forge.locator('canvas[data-webs]')).toHaveAttribute('data-webs', '0');
  await page.waitForTimeout(1500);
  expect(await forge.locator('canvas[data-webs]').getAttribute('data-idle')).toBeFalsy();
  await expectNoHorizontalOverflow(page, 390);
});

test('forge is honestly off without a Kernel and draws a still frame under reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Alternar navegación' }).first().click();
  await page.locator('.efesto-sidebar nav').getByRole('button', { name: /^Objetivos/ }).click();
  const forge = page.locator('.forge-live');
  await expect(forge.getByRole('heading', { name: 'La forja está apagada' })).toBeVisible();
  await expect(forge).toHaveAttribute('data-reduced-motion', 'true');
  await expect(forge.locator('.forge-source')).toHaveCount(0);
  await expect(forge.getByLabel('Contadores de la misión')).toHaveCount(0);
  await expectNoHorizontalOverflow(page, 390);
});

for (const view of [{ shot: '390', width: 390, height: 844 }, { shot: 'desktop', width: 1440, height: 900 }]) {
  test(`"Editar Goal" waits for pending Kernel verification at ${view.width}px without losing typed text`, async ({ page }) => {
    await page.setViewportSize({ width: view.width, height: view.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let verifying = true;
    const posted: unknown[] = [];
    await useForgeFixture(page);
    const pendingMission = { ...missions.missions[0], status: 'running', executionPhase: 'verifying', verificationResults: [] };
    const pendingSurface = { ...surfaces.surfaces[0], mission: { ...surfaces.surfaces[0].mission, status: 'running', executionPhase: 'verifying', workState: 'verifying' } };
    await page.route('http://127.0.0.1:4100/api/agent-missions', (route) => fulfill(verifying ? { ok: true, missions: [pendingMission] } : missions)(route));
    await page.route('http://127.0.0.1:4100/api/goal-surfaces', (route) => fulfill(verifying ? { ok: true, surfaces: [pendingSurface] } : surfaces)(route));
    await page.route('http://127.0.0.1:4100/api/goals/goal-forge/revisions', async (route) => {
      if (route.request().method() === 'POST') posted.push(route.request().postDataJSON());
      await route.fallback();
    });
    await page.goto('/');
    await connect(page);
    await openHome(page, view.width < 700);
    await page.locator('.forge-live header').getByRole('button', { name: 'Editar Goal' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ajusta lo que buscas' });
    const field = dialog.getByLabel('Texto del Goal');
    await field.fill('Fixture ownership and borrowing guide');
    await expect(dialog.getByRole('status')).toContainText('El Kernel está verificando');
    const save = dialog.getByRole('button', { name: 'Guardar revisión' });
    await expect(save).toBeDisabled();
    await expectNoHorizontalOverflow(page, view.width);
    verifying = false;
    // Existing dashboard polling observes the terminal state; there is no second action or API.
    await expect(save).toBeEnabled({ timeout: 15_000 });
    await expect(field).toHaveValue('Fixture ownership and borrowing guide');
    expect(posted).toEqual([]);
  });

  test(`"Editar Goal" at ${view.width}px revises the confirmed Goal through the Kernel revision endpoint, keeping its Mission and Find`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: view.width, height: view.height });
    let revised = false;
    const revisedTitle = 'Fixture ownership and borrowing guide';
    const revisedSurfaces = () => ({ ok: true, surfaces: [{ ...surfaces.surfaces[0], goal: { ...surfaces.surfaces[0].goal, title: revisedTitle, revision: 2, updatedAt: '2026-07-26T10:05:00.000Z' } }] });
    await useForgeFixture(page);
    await page.route('http://127.0.0.1:4100/api/goal-surfaces', (route) => fulfill(revised ? revisedSurfaces() : surfaces)(route));
    const posted: unknown[] = [];
    await page.route('http://127.0.0.1:4100/api/goals/goal-forge/revisions', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      posted.push(route.request().postDataJSON());
      revised = true;
      await route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ ok: true, changed: true, revision: 2, goal: { id: 'goal-forge', title: revisedTitle, revision: 2 } }) });
    });
    await page.goto('/');
    await connect(page);
    await openHome(page, view.width < 700);
    const forge = page.locator('.forge-live');
    const edit = forge.locator('header').getByRole('button', { name: 'Editar Goal' });
    await expect(edit).toBeVisible();
    expect((await edit.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await edit.click();
    const dialog = page.getByRole('dialog', { name: 'Ajusta lo que buscas' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('EDITAR GOAL · REVISIÓN 1 → 2')).toBeVisible();
    await dialog.getByLabel('Texto del Goal').fill(revisedTitle);
    await expect(dialog.getByLabel('Palabras clave de la próxima búsqueda')).toContainText('borrowing');
    const save = dialog.getByRole('button', { name: 'Guardar revisión' });
    await expect(save).toBeEnabled();
    const close = dialog.getByRole('button', { name: 'Cerrar edición' });
    await save.focus();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(save).toBeFocused();
    await page.waitForTimeout(400); // let the sheet's entry animation finish before measuring
    const box = await dialog.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(view.width);
    if (view.width < 700) {
      // Bottom sheet on a phone: anchored to the bottom edge, full width, 44px+ actions.
      expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(view.height);
      expect((await save.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: testInfo.outputPath(`goal-edit-${view.shot}.png`) });
    if (process.env.GOAL_EDIT_SHOTS_DIR) await page.screenshot({ path: `${process.env.GOAL_EDIT_SHOTS_DIR}/goal-edit-${view.shot}.png` });
    await save.click();
    await expect.poll(() => posted.length).toBe(1);
    expect(posted[0]).toEqual({ confirmed: true, title: revisedTitle, keywords: expect.arrayContaining(['ownership', 'borrowing']), expectedRevision: 1 });
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(/Goal revisado \(revisión 2\)\. Se conservan su misión, la Evidence y los Finds/)).toBeVisible();
    await expect(forge.getByRole('heading', { name: revisedTitle })).toBeVisible();
    // The same Mission and its gold Find stay on screen: nothing was re-run.
    await expect(forge.locator('.forge-source[data-state="supported"]')).toHaveCount(1);
    expect(posted).toHaveLength(1);
    await expectNoHorizontalOverflow(page, view.width);
  });
}

for (const size of [{ width: 390, height: 844, mobile: true }, { width: 360, height: 780, mobile: true }, { width: 1280, height: 720, mobile: false }, { width: 1440, height: 900, mobile: false }]) {
  test(`forge.log never covers the anvil at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await useForgeFixture(page);
    await page.goto('/');
    await connect(page);
    await openHome(page, size.mobile);
    await expect(page.locator('.forge-live-fx')).toHaveAttribute('data-anvil', /^-?\d+,-?\d+,\d+,\d+$/);
    const boxes = await page.evaluate(() => {
      const fx = document.querySelector('.forge-live-fx') as HTMLCanvasElement;
      const origin = fx.getBoundingClientRect();
      const [x, y, w, h] = (fx.dataset.anvil ?? '').split(',').map(Number);
      const anvil = { left: origin.left + x, top: origin.top + y, right: origin.left + x + w, bottom: origin.top + y + h };
      const t = (document.querySelector('.forge-ticker') as HTMLElement).getBoundingClientRect();
      const stage = (document.querySelector('.forge-live-stage') as HTMLElement).getBoundingClientRect();
      return { anvil, ticker: { left: t.left, top: t.top, right: t.right, bottom: t.bottom }, stage: { left: stage.left, top: stage.top, right: stage.right, bottom: stage.bottom } };
    });
    const intersects = (a: typeof boxes.anvil, b: typeof boxes.anvil) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    expect(intersects(boxes.anvil, boxes.ticker)).toBe(false);
    // the log is outside the stage entirely (side panel on desktop, below the stage on phones)
    expect(intersects(boxes.stage, boxes.ticker)).toBe(false);
    // the anvil itself is inside the visible stage
    expect(boxes.anvil.left >= boxes.stage.left - 1 && boxes.anvil.right <= boxes.stage.right + 1 && boxes.anvil.bottom <= boxes.stage.bottom + 1).toBe(true);
  });
}

for (const width of [390, 1440]) {
  test(`historical Goal revision block needs an explicit recovery at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await useForgeFixture(page);
    let confirmed = false;
    const posted: unknown[] = [];
    const blocked = { ...missions.missions[0], status: 'running', executionPhase: 'verifying', verifyingAt: '2026-07-26T10:03:00.000Z', verificationResults: [], verificationBlock: { reason: 'authorization_revision_mismatch' } };
    const queued = { ...blocked, status: 'queued', executionPhase: 'queued', verifyingAt: undefined, searchCandidates: undefined, verificationBlock: undefined, priorAttempts: [blocked], authorization: { goalRevision: 2 } };
    await page.route('http://127.0.0.1:4100/api/agent-missions', (route) => fulfill({ ok: true, missions: [confirmed ? queued : blocked] })(route));
    await page.route('http://127.0.0.1:4100/api/goal-surfaces', (route) => fulfill({ ok: true, surfaces: [{ ...surfaces.surfaces[0], goal: { ...surfaces.surfaces[0].goal, revision: 2 }, mission: { ...surfaces.surfaces[0].mission, status: confirmed ? 'queued' : 'running', executionPhase: confirmed ? 'queued' : 'verifying', workState: confirmed ? 'queued' : 'verifying', ...(confirmed ? {} : { blockedReason: 'authorization_revision_mismatch' }) } }] })(route));
    await page.route('http://127.0.0.1:4100/api/goals/goal-forge/missions', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      posted.push(route.request().postDataJSON());
      confirmed = true;
      await route.fulfill({ status: 201, headers: cors, body: JSON.stringify({ ok: true, mission: queued }) });
    });
    await page.goto('/');
    await connect(page);
    await openHome(page, width < 760);
    await expect(page.getByText('Bloqueada · Goal actualizado', { exact: true })).toBeVisible();
    await expect(page.getByText(/el bloqueo anterior queda en el historial/)).toBeVisible();
    expect(posted).toEqual([]);
    await page.locator('.forge-live').getByRole('button', { name: 'Buscar más', exact: true }).click();
    await expect(page.getByText(/Solicitud de «Buscar más» recibida por el Kernel/)).toBeVisible();
    expect(posted).toEqual([{ confirmed: true, agent: 'hermes', cadence: 'manual', mode: 'search_more' }]);
    await expect(page.locator('.forge-live').getByRole('button', { name: 'Buscar más', exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page, width);
  });
}
