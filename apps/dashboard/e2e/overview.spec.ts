import { expect, test, type Page } from '@playwright/test';

const KERNEL_URL = 'http://127.0.0.1:4100';
const KERNEL_TOKEN = 'test-token-that-is-long-enough-for-kernel-validation';
const captureDir = 'e2e-captures';

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
  await page.getByLabel('URL del Kernel').fill(KERNEL_URL);
  await page.getByLabel('Token local').fill(KERNEL_TOKEN);
  await page.getByRole('button', { name: 'Conectar al Kernel' }).click();
  await expect(page.getByRole('heading', { name: 'Centro de control' })).toBeVisible();
}

test('disconnected desktop: onboarding card, no dead controls, safe token help', async ({ page }) => {
  await page.goto('/');
  expect(page.viewportSize()).toEqual({ width: 1536, height: 1024 });
  await expect(page.locator('.connection-panel')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Conectar al Kernel' })).toBeVisible();
  await expect(page.getByText('Hephaestus Control Center')).toBeVisible();

  // No dead command bar.
  await expect(page.getByRole('search', { name: 'Command center' })).toHaveCount(0);
  // CTA is visible and functional.
  await expect(page.getByRole('button', { name: 'Conectar al Kernel' })).toBeVisible();
  // Token help is present and does not render a token value.
  await expect(page.getByText('¿Cómo obtengo el token local sin exponerlo?')).toBeVisible();
  await expect(page.locator('.roadmap-item')).toHaveCount(6);

  await page.screenshot({ path: `${captureDir}/disconnected-desktop.png`, fullPage: true });
});

test.describe('mobile disconnected', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('disconnected mobile: onboarding card fits without horizontal overflow', async ({ page }) => {
    await page.goto('/');
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    await expect(page.locator('.connection-panel')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Conectar al Kernel' })).toBeVisible();

    const layout = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const tracked = Array.from(document.querySelectorAll<HTMLElement>('.connection-panel, .connection-panel *'));
      const clipped = tracked.flatMap((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left < -1 || bounds.right > viewportWidth + 1
          ? [`${element.tagName.toLowerCase()}.${element.className}`]
          : [];
      });
      return { documentWidth: document.documentElement.scrollWidth, viewportWidth, clipped };
    });
    expect(layout.clipped).toEqual([]);
    expect(layout.documentWidth).toBe(layout.viewportWidth);

    await page.screenshot({ path: `${captureDir}/disconnected-mobile.png`, fullPage: true });
  });
});

test('connected desktop: truthful Overview renders after connection', async ({ page }) => {
  await page.goto('/');
  await connect(page);
  await expect(page.getByText('Find AI clients')).toBeVisible();
  await expect(page.getByText('AI automation project')).toBeVisible();
  await expect(page.getByText('Lead no verificado')).toBeVisible();
  await expect(page.getByText('Resumen parcial: algunos endpoints no respondieron, pero los datos disponibles se conservan.')).toBeVisible();
  await expect(page.getByText('Model Forge no está disponible en este Kernel.')).toBeVisible();

  await page.getByRole('button', { name: 'Actualizar resumen' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Desconectar del Kernel' })).toBeFocused();

  await page.screenshot({ path: `${captureDir}/connected-desktop.png`, fullPage: true });
});

test.describe('connected mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('connected mobile: Overview renders without horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await connect(page);
    await expect(page.getByText('Find AI clients')).toBeVisible();

    const layout = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const tracked = Array.from(document.querySelectorAll<HTMLElement>('.app-shell, .app-shell *'));
      const clipped = tracked.flatMap((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left < -1 || bounds.right > viewportWidth + 1
          ? [`${element.tagName.toLowerCase()}.${element.className}`]
          : [];
      });
      return { documentWidth: document.documentElement.scrollWidth, viewportWidth, clipped };
    });
    expect(layout.clipped).toEqual([]);
    expect(layout.documentWidth).toBe(layout.viewportWidth);

    await page.screenshot({ path: `${captureDir}/connected-mobile.png`, fullPage: true });
  });
});

test('disconnect clears the local session and returns to the onboarding card', async ({ page }) => {
  await page.goto('/');
  await connect(page);
  await page.getByRole('button', { name: 'Desconectar del Kernel' }).click();
  await expect(page.getByRole('heading', { name: 'Conectar al Kernel' })).toBeVisible();
  await expect(page.getByLabel('Token local')).toHaveValue('');
});
