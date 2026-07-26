import { expect, test, type Page } from '@playwright/test';

const browserProblems = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  browserProblems.set(page, problems);
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    const expectedModelForgeUnavailable = message.location().url === 'http://127.0.0.1:4100/api/model-forge' && message.text().includes('404');
    if (message.type() === 'error' && !expectedModelForgeUnavailable) problems.push(`console.error: ${message.text()}`);
  });
  page.on('requestfailed', (request) => problems.push(`requestfailed: ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`));
});

test.afterEach(async ({ page }) => {
  expect(browserProblems.get(page) ?? []).toEqual([]);
});

async function connect(page: Page): Promise<void> {
  await page.getByLabel('URL del Kernel').fill('http://127.0.0.1:4100');
  await page.getByLabel('Token local').fill('test-token-that-is-long-enough-for-kernel-validation');
  await page.getByRole('button', { name: 'Conectar al Kernel' }).click();
  await expect(page.getByRole('heading', { name: 'Centro de control' })).toBeVisible();
}

test('connects to a local Kernel and renders truthful Overview data', async ({ page }) => {
  await page.goto('/');
  expect(page.viewportSize()).toEqual({ width: 1536, height: 1024 });
  await expect(page.locator('.app-shell')).toHaveCSS('grid-template-columns', /256px/);

  await page.getByLabel('URL del Kernel').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Token local')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Conectar al Kernel' })).toBeFocused();

  await connect(page);
  await expect(page.getByText('Find AI clients')).toBeVisible();
  await expect(page.getByText('AI automation project')).toBeVisible();
  await expect(page.getByText('Lead no verificado')).toBeVisible();
  await expect(page.getByText('Resumen parcial: algunos endpoints no respondieron, pero los datos disponibles se conservan.')).toBeVisible();
  await expect(page.getByText('Model Forge no está disponible en este Kernel.')).toBeVisible();

  await page.getByRole('button', { name: 'Actualizar resumen' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Desconectar del Kernel' })).toBeFocused();
});

test('disconnect clears the local session and returns to the connection gate', async ({ page }) => {
  await page.goto('/');
  await connect(page);

  await page.getByRole('button', { name: 'Desconectar del Kernel' }).click();
  await expect(page.getByRole('heading', { name: 'Conectar al Kernel' })).toBeVisible();
  await expect(page.getByLabel('Token local')).toHaveValue('');
});

test.describe('mobile control center', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('collapses navigation without hiding persistent controls behind horizontal overflow', async ({ page }) => {
    await page.goto('/');
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    await expect(page.getByRole('banner').getByText('Kernel sin conexión')).toBeVisible();
    await expect(page.locator('.primary-navigation a span').first()).toBeHidden();

    await connect(page);
    const refresh = page.getByRole('button', { name: 'Actualizar resumen' });
    const disconnect = page.getByRole('button', { name: 'Desconectar del Kernel' });
    await expect(refresh).toBeVisible();
    await expect(disconnect).toBeVisible();
    await expect.poll(async () => {
      const [refreshBox, disconnectBox, viewportWidth] = await Promise.all([
        refresh.boundingBox(), disconnect.boundingBox(), page.evaluate(() => window.innerWidth),
      ]);
      return [refreshBox, disconnectBox].every((box) => box !== null && box.x >= 0 && box.x + box.width <= viewportWidth);
    }).toBe(true);
  });
});
