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
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'URL del Kernel', exact: true }).fill('http://127.0.0.1:4100');
  await page.getByLabel('Token privado', { exact: true }).fill(token);
  await page.getByRole('button', { name: 'Autorizar dispositivo', exact: true }).click();
  await expect(page.getByRole('button', { name: /Kernel ready/ })).toBeVisible();
}

test('runs the Goal-first journey only after explicit confirmation', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') writes.push(new URL(request.url()).pathname); });
  await page.goto('/');
  expect(page.viewportSize()).toEqual({ width: 1536, height: 1024 });
  await expect(page.locator('.efesto-product')).toHaveCSS('grid-template-columns', /270px/);
  await expect(page.getByRole('heading', { name: '¿Qué quieres conseguir?', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Modo local desconectado/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Goal', exact: true })).toBeVisible();

  await connect(page);
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('img', { name: /Investigando/ })).toBeVisible();

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

  await page.getByRole('button', { name: /Finds/ }).click();
  await expect(page.getByText('AI automation project', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Útil', exact: true }).click();
  await expect.poll(() => writes).toContain('/api/opportunities/opportunity-1/feedback');

  await page.getByRole('button', { name: /Evidence/ }).click();
  await page.getByRole('button', { name: /Supplier research/ }).click();
  const source = page.getByRole('link', { name: /Abrir fuente/ });
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute('href', 'https://supplier.example/source');

  await page.getByRole('button', { name: /Models/ }).click();
  await page.getByRole('button', { name: /qwen3:4b/ }).click();
  await expect(page.getByRole('textbox', { name: 'Mensaje', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Mensaje', exact: true }).fill('Resume el estado');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Fixture response from the selected local model.', { exact: true })).toBeVisible();
  await expect(page.getByText('No admitido en memoria', { exact: true })).toBeVisible();
  expect(writes).toContain('/api/chat/stream');
});

test('disconnect removes the session credential and returns truthful offline state', async ({ page }) => {
  await page.goto('/');
  await connect(page);
  await page.getByRole('button', { name: /Kernel ready/ }).click();
  await page.getByRole('button', { name: 'Desconectar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Conectar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('img', { name: /Modo local desconectado/ })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('hephaestus.owner.connection.session.v1'))).toBeNull();
});

test.describe('mobile Efesto product shell', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('uses a drawer, single-column Goal surface and safe composer without horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Abrir menú', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '¿Qué quieres conseguir?', exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: /Modo local desconectado/ })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Goal', exact: true })).toBeVisible();
    await expect(page.locator('.goal-dock')).toBeVisible();

    const initial = await page.evaluate(() => ({ viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth }));
    expect(initial.documentWidth).toBe(initial.viewportWidth);

    await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
    await expect(page.locator('aside[aria-label="Navegación principal"]')).toBeVisible();
    const sidebarBox = await page.locator('.efesto-sidebar').boundingBox();
    expect(sidebarBox?.left).toBeGreaterThanOrEqual(-1);
    expect(sidebarBox?.right).toBeLessThanOrEqual(391);

    await page.getByRole('button', { name: 'Cerrar menú', exact: true }).first().click();
    await page.getByRole('textbox', { name: 'Goal', exact: true }).fill('Busca oportunidades reales');
    const composerBox = await page.locator('.goal-dock').boundingBox();
    expect(composerBox?.left).toBeGreaterThanOrEqual(0);
    expect(composerBox?.right).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });
});
