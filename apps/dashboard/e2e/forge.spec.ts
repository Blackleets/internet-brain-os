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

async function expectHonestSources(page: Page): Promise<void> {
  const forge = page.locator('.forge-live');
  await expect(forge.getByRole('heading', { name: 'Fixture ownership guide' })).toBeVisible();
  await expect(forge.locator('.forge-source[data-state="supported"]')).toHaveCount(1);
  await expect(forge.locator('.forge-source[data-state="unsupported"]')).toHaveCount(1);
  await expect(forge.locator('.forge-source[data-state="read_failed"]')).toHaveCount(1);
  await expect(forge.getByText(/Fixture excerpt: ownership is a set of rules/)).toBeVisible();
  await expect(forge.getByText(/HERMES SNIPPET FIXTURE/)).toHaveCount(0);
  await expect(forge.getByText(/La página no cubre suficientes términos del Goal/)).toBeVisible();
  await expect(forge.getByLabel('Contadores de la misión')).toContainText('con SUPPORT');
}

test('forge live view on a 390×844 phone: real Kernel states, readable cards, no overflow', async ({ page }, testInfo) => {
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
  await expect(page.getByRole('list', { name: 'Términos del Goal presentes en la Evidence' }).getByRole('listitem')).toHaveText(['fixture', 'ownership']);
  await expect(page.locator('.forge-bench')).toHaveAttribute('data-mode', 'searched');
  await expect(page.locator('.forge-bench-meta')).toHaveText('Búsqueda web terminada · 3 candidatos reales');
  await page.screenshot({ path: testInfo.outputPath('forge-mobile-390x844.png') });
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
  await expect(forge.getByText(/la consulta exacta no la publica el Kernel/)).toBeVisible();
  await expect(forge.getByRole('list', { name: 'Palabras clave de la misión' }).getByRole('listitem')).toHaveText(['ownership', 'rust']);
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
  await expect(forge.getByText(/Siguiente: Hermes toma la misión/)).toBeVisible();
  await expect(forge.locator('.forge-bench-query')).toHaveCount(0);
  await expect(forge.locator('.forge-source')).toHaveCount(0);
  await expect(forge.getByRole('button', { name: /Repetir la forja/ })).toHaveCount(0);
});

test('forge live view on desktop: wide anvil composition with sources on both sides', async ({ page }, testInfo) => {
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
  expect(cards.some((x) => x < anvilCenter)).toBe(true);
  expect(cards.some((x) => x > anvilCenter)).toBe(true);
  await page.locator('.forge-live').getByRole('button', { name: 'Ver Find' }).click();
  await expect(page.getByRole('heading', { name: 'Hallazgos', exact: true })).toBeVisible();
  await expect(page.getByText('Ownership (fixture Find)', { exact: true })).toBeVisible();
  await openHome(page, false);
  await expectNoHorizontalOverflow(page, 1280);
  await page.screenshot({ path: testInfo.outputPath('forge-desktop-1280x800.png') });
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
