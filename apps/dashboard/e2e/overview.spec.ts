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
  await page.getByRole('button', { name: 'Conectar Kernel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'URL del Kernel', exact: true }).fill('http://127.0.0.1:4100');
  await page.getByLabel('Token privado', { exact: true }).fill(token);
  await page.getByRole('button', { name: 'Autorizar dispositivo', exact: true }).click();
  await expect(page.getByRole('button', { name: /Kernel listo/ })).toBeVisible();
}

async function expectLocalScorecard(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Valor del producto', exact: true })).toBeVisible();
  await expect(page.getByText('Solo local · sin telemetría externa', { exact: true })).toBeVisible();
  await expect(page.getByText('Goals con hallazgo útil', { exact: true })).toBeVisible();
  await expect(page.getByText('Tiempo al primer hallazgo útil', { exact: true })).toBeVisible();
  await expect(page.getByText('50%', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('5 min', { exact: true })).toBeVisible();
}

test('runs the conversation-first journey only after explicit confirmation', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') writes.push(new URL(request.url()).pathname); });
  await page.goto('/');
  expect(page.viewportSize()).toEqual({ width: 1536, height: 1024 });
  await expect(page.locator('.efesto-product')).toHaveCSS('grid-template-columns', /236px/);
  await expect(page.getByRole('heading', { name: '¿En qué trabajamos?', exact: true })).toBeVisible();
  await expect(page.getByText('EFESTO · INTELLIGENCE FORGE', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Mensaje', exact: true })).toBeVisible();
  await expect(page.getByText('Privado por diseño', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Goal', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Chat', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.forge-quick-prompts, .forge-suggestion-rail, .forge-suggestion-next')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Mensaje', exact: true })).toHaveAttribute('placeholder', 'Configura un modelo para empezar…');
  await page.getByRole('button', { name: 'Goal', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Goal', exact: true })).toHaveAttribute('placeholder', /Encuéntrame|Busca trabajos|Investiga una empresa|Encuentra oportunidades/);

  await connect(page);
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kernel conectado', exact: true })).toBeVisible();
  await expectLocalScorecard(page);

  await page.getByRole('button', { name: 'Goal', exact: true }).click();
  await page.getByRole('textbox', { name: 'Goal', exact: true }).fill('Auditar fuentes públicas');
  await page.getByRole('button', { name: 'Preparar Goal', exact: true }).click();
  await expect(page.getByText('PLAN PROPUESTO · AÚN NO EJECUTADO', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);

  await page.getByRole('button', { name: 'Confirmar y ejecutar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Misiones', exact: true })).toBeVisible();
  expect(writes).toEqual(['/api/goals', '/api/goals/goal-e2e/missions']);
});

test('switches the Efesto surface language from gear settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes', exact: true })).toBeVisible();

  await page.getByRole('combobox', { name: 'Idioma de la interfaz', exact: true }).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('efesto.locale.v1'))).toBe('en');

  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What are we working on?', exact: true })).toBeVisible();
  await expect(page.getByText('Enter to send', { exact: true })).toBeVisible();
});

test('wires Finds, Evidence and model Chat to real product contracts', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') writes.push(new URL(request.url()).pathname); });
  await page.goto('/');
  await connect(page);

  await page.getByRole('button', { name: 'Hallazgos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hallazgos', exact: true })).toBeVisible();
  await expect(page.getByText('AI automation project', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Útil', exact: true }).click();
  await expect.poll(() => writes).toContain('/api/opportunities/opportunity-1/feedback');

  await page.getByRole('button', { name: 'Evidencia', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Evidencia', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Supplier research/ }).click();
  const source = page.getByRole('link', { name: /Abrir fuente/ });
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute('href', 'https://supplier.example/source');

  await page.getByRole('button', { name: 'Modelos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Modelos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /qwen3:4b/ }).click();
  await expect(page.getByRole('textbox', { name: 'Mensaje', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Mensaje', exact: true }).fill('Resume el estado');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await expect(page.getByText('Fixture response from the selected local model.', { exact: true })).toBeVisible();
  await expect(page.getByText('La conversación permanece separada de la evidencia y la memoria.', { exact: true })).toBeVisible();
  expect(writes).toContain('/api/chat/stream');
});

test('disconnect removes the session credential and returns truthful offline state', async ({ page }) => {
  await page.goto('/');
  await connect(page);
  await page.getByRole('button', { name: /Kernel listo/ }).click();
  await page.getByRole('button', { name: 'Desconectar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Conectar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Conectar Kernel', exact: true })).toBeVisible();
  await expect(page.getByText('Métricas temporalmente no disponibles', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('hephaestus.owner.connection.session.v1'))).toBeNull();
});

test('supports keyboard Goal preparation with visible focus and reduced motion', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') writes.push(new URL(request.url()).pathname); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await page.getByRole('button', { name: 'Goal', exact: true }).click();
  await expect(page.getByText('Enter para preparar', { exact: true })).toBeVisible();
  const goal = page.getByRole('textbox', { name: 'Goal', exact: true });
  await goal.focus();
  await expect(goal).toBeFocused();
  expect(await goal.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('none');
  expect(await page.locator('.forge-composer').evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
  await goal.fill('Busca una oportunidad pública y verificable');
  await goal.press('Enter');
  await expect(page.getByText('PLAN PROPUESTO · AÚN NO EJECUTADO', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);

  const motion = await page.locator('.forge-composer').evaluate((element) => ({
    transitionDuration: getComputedStyle(element).transitionDuration,
    animationDuration: getComputedStyle(element).animationDuration,
  }));
  expect(parseFloat(motion.transitionDuration)).toBeLessThanOrEqual(0.001);
  expect(parseFloat(motion.animationDuration)).toBeLessThanOrEqual(0.001);
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


  test('uses a drawer, single-column Forge surface and safe composer without horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Alternar navegación', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '¿En qué trabajamos?', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Mensaje', exact: true })).toBeVisible();
    await expect(page.locator('.forge-composer')).toBeVisible();
    await expect(page.locator('.forge-quick-prompts, .forge-suggestion-rail, .forge-suggestion-next')).toHaveCount(0);
    await page.getByRole('button', { name: 'Goal', exact: true }).click();
    const goal = page.getByRole('textbox', { name: 'Goal', exact: true });
    await expect(goal).toHaveAttribute('placeholder', /Encuéntrame|Busca trabajos|Investiga una empresa|Encuentra oportunidades/);
    await expect(page.getByText('Privado por diseño', { exact: true })).toBeVisible();

    const initial = await page.evaluate(() => ({ viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth }));
    expect(initial.documentWidth).toBe(initial.viewportWidth);

    await page.getByRole('button', { name: 'Alternar navegación', exact: true }).click();
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
    await page.getByRole('button', { name: 'Alternar navegación', exact: true }).click();
    await page.getByRole('button', { name: 'Inicio', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Kernel conectado', exact: true })).toBeVisible();
    await expectLocalScorecard(page);
    await page.getByRole('textbox', { name: 'Mensaje', exact: true }).fill('Busca oportunidades reales');
    const composerBox = await page.locator('.forge-composer').boundingBox();
    expect(composerBox).not.toBeNull();
    if (!composerBox) throw new Error('Mobile composer has no layout box');
    expect(composerBox.x).toBeGreaterThanOrEqual(0);
    expect(composerBox.x + composerBox.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });
});
