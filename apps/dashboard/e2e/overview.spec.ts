import { expect, test, type Page } from '@playwright/test';

const browserProblems = new WeakMap<Page, string[]>();
const token = 'test-token-that-is-long-enough-for-kernel-validation';

test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  browserProblems.set(page, problems);
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(`console.error: ${message.text()}`); });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'unknown';
    const path = new URL(request.url()).pathname;
    if (!(request.method() === 'GET' && path === '/health' && failure === 'net::ERR_ABORTED')) problems.push(`requestfailed: ${request.url()} (${failure})`);
  });
});

test.afterEach(async ({ page }) => { expect(browserProblems.get(page) ?? []).toEqual([]); });

async function connect(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Conectar Kernel' }).first().click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'URL del Kernel', exact: true }).fill('http://127.0.0.1:4100');
  await page.getByLabel('Token privado', { exact: true }).fill(token);
  await page.getByRole('button', { name: 'Autorizar dispositivo', exact: true }).click();
  await expect(page.getByRole('button', { name: /Kernel ready/ })).toBeVisible();
}

async function switchToGoalMode(page: Page): Promise<void> {
  // The forge boots in chat mode; preparing a Goal requires Goal mode.
  await page.getByRole('button', { name: 'Goal', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Goal', exact: true })).toHaveAttribute('aria-pressed', 'true');
}

async function expectLocalScorecard(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Valor del producto', exact: true })).toBeVisible();
  await expect(page.getByText('Solo local · sin telemetría externa', { exact: true })).toBeVisible();
  await expect(page.getByText('Goals con Find útil', { exact: true })).toBeVisible();
  await expect(page.getByText('Tiempo al primer Find útil', { exact: true })).toBeVisible();
}

test('runs the Goal-first journey only after explicit confirmation', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') writes.push(new URL(request.url()).pathname); });
  await page.goto('/');
  expect(page.viewportSize()).toEqual({ width: 1536, height: 1024 });
  await expect(page.locator('.efesto-product')).toHaveCSS('grid-template-columns', /236px/);
  await expect(page.getByRole('heading', { name: '¿En qué trabajamos?', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chat', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Privado por diseño', { exact: true })).toBeVisible();

  await connect(page);
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  // Shared Goal Truth: the goal-surface mission reports investigating while
  // the legacy agent-mission record says forged; the visible phase must
  // follow the goal surface, not the legacy record.
  await expect(page.getByText('Investigando', { exact: true })).toBeVisible();
  // The product scorecard lives on the Missions route (G5.2 contract).
  await page.locator('.efesto-sidebar nav').getByRole('button', { name: /^Misiones/ }).click();
  await expectLocalScorecard(page);
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await switchToGoalMode(page);

  await page.getByRole('textbox', { name: 'Goal', exact: true }).fill('Auditar fuentes públicas');
  await page.getByRole('button', { name: 'Preparar Goal', exact: true }).click();
  await expect(page.getByText('PLAN PROPUESTO · AÚN NO EJECUTADO', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);

  await page.getByRole('button', { name: 'Confirmar y ejecutar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Missions', exact: true })).toBeVisible();
  expect(writes).toEqual(['/api/goals', '/api/goals/goal-e2e/missions']);
});

test('wires Finds, Evidence and model Chat to real product contracts', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') writes.push(new URL(request.url()).pathname); });
  await page.goto('/');
  await connect(page);

  await page.locator('.efesto-sidebar nav').getByRole('button', { name: /^Hallazgos/ }).click();
  await expect(page.getByText('AI automation project', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Útil', exact: true }).click();
  await expect.poll(() => writes).toContain('/api/opportunities/opportunity-1/feedback');

  await page.locator('.efesto-sidebar nav').getByRole('button', { name: /^Evidencia/ }).click();
  await expect(page.getByRole('heading', { name: 'Evidence', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Supplier research/ }).click();
  const source = page.getByRole('link', { name: /Abrir fuente/ });
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute('href', 'https://supplier.example/source');

  await page.locator('.efesto-sidebar nav').getByRole('button', { name: /^Modelos/ }).click();
  await page.getByRole('button', { name: /qwen3:4b/ }).click();
  await page.getByRole('textbox', { name: 'Mensaje', exact: true }).fill('Resume el estado');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(page.getByText('Fixture response from the selected local model.', { exact: true })).toBeVisible();
  await expect(page.getByText('La conversación permanece separada de Evidence y memoria.', { exact: true })).toBeVisible();
  expect(writes).toContain('/api/chat/stream');
});

test('disconnect removes the session credential and returns truthful offline state', async ({ page }) => {
  await page.goto('/');
  await connect(page);
  await page.getByRole('button', { name: /Kernel ready/ }).click();
  await page.getByRole('button', { name: 'Desconectar', exact: true }).click();
  // Back in Settings after disconnect: the connection card flips to its
  // offline form (URL/token inputs visible again).
  await expect(page.getByRole('textbox', { name: 'URL del Kernel' })).toBeVisible();
  await expect(page.getByText('Métricas temporalmente no disponibles', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('hephaestus.owner.connection.session.v1'))).toBeNull();
});

test('supports keyboard Goal preparation with visible focus and reduced motion', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') writes.push(new URL(request.url()).pathname); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await switchToGoalMode(page);
  const goal = page.getByRole('textbox', { name: 'Goal', exact: true });
  await goal.focus();
  await expect(goal).toBeFocused();
  expect(await goal.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await goal.fill('Busca una oportunidad pública y verificable');
  await goal.press('Enter');
  await expect(page.getByText('PLAN PROPUESTO · AÚN NO EJECUTADO', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

test.describe('mobile Efesto product shell', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('publishes install metadata for the mobile web surface', async ({ page, request }) => {
    await page.goto('/');
    const response = await request.get('/manifest.webmanifest');
    expect(response.ok()).toBeTruthy();
    const manifest = await response.json();
    expect(manifest.name).toBe('Efesto · The Intelligence Forge');
    expect(manifest.short_name).toBe('Efesto');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.icons).toEqual(expect.arrayContaining([expect.objectContaining({ src: '/efesto-smith.svg' })]));
  });

  test('uses a drawer, single-column Goal surface and safe composer without horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Alternar navegación' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '¿En qué trabajamos?', exact: true })).toBeVisible();

    const initial = await page.evaluate(() => ({ viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth }));
    expect(initial.documentWidth).toBe(initial.viewportWidth);

    await page.getByRole('button', { name: 'Alternar navegación' }).first().click();
    const sidebar = page.locator('.efesto-sidebar');
    await expect(sidebar).toBeVisible();
    await expect.poll(async () => (await sidebar.boundingBox())?.x ?? -999).toBeGreaterThanOrEqual(-1);
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox).not.toBeNull();
    if (!sidebarBox) throw new Error('Mobile sidebar has no layout box');
    expect(sidebarBox.x + sidebarBox.width).toBeLessThanOrEqual(391);

    await page.getByRole('button', { name: 'Cerrar menú', exact: true }).first().click();
    await expect.poll(async () => (await sidebar.boundingBox())?.x ?? 0).toBeLessThan(-100);

    await connect(page);
    await page.getByRole('button', { name: 'Alternar navegación' }).first().click();
    await page.getByRole('button', { name: 'Inicio', exact: true }).click();
    await switchToGoalMode(page);
    await page.getByRole('textbox', { name: 'Goal', exact: true }).fill('Busca oportunidades reales');
    const composer = page.locator('.forge-composer-zone');
    const composerBox = await composer.boundingBox();
    expect(composerBox).not.toBeNull();
    if (!composerBox) throw new Error('Mobile composer has no layout box');
    expect(composerBox.x).toBeGreaterThanOrEqual(0);
    expect(composerBox.x + composerBox.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });
});
