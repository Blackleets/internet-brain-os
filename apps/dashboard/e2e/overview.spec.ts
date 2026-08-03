import { expect, test, type Page } from '@playwright/test';

const browserProblems = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  browserProblems.set(page, problems);
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
  });
  page.on('requestfailed', (request) => problems.push(`requestfailed: ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`));
});

test.afterEach(async ({ page }) => {
  expect(browserProblems.get(page) ?? []).toEqual([]);
});

async function connect(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Conectar' }).click();
  await expect(page.getByRole('heading', { name: 'Centro de conexiones' })).toBeVisible();
  await page.getByLabel('URL del Kernel').fill('http://127.0.0.1:4100');
  await page.getByLabel('Token privado').fill('test-token-that-is-long-enough-for-kernel-validation');
  await expect(page.getByRole('checkbox', { name: /Recordar solo en este dispositivo/ })).not.toBeChecked();
  await page.getByRole('button', { name: 'Autorizar dispositivo' }).click();
  await expect(page.getByRole('button', { name: /Kernel online/ })).toBeVisible();
}

test('renders the migrated Sites UI and connects it to truthful Kernel data', async ({ page }) => {
  await page.goto('/');
  expect(page.viewportSize()).toEqual({ width: 1536, height: 1024 });
  await expect(page.locator('.app')).toHaveCSS('grid-template-columns', /270px/);
  await expect(page.getByRole('heading', { name: '¿Qué quieres investigar hoy?' })).toBeVisible();
  await expect(page.getByText('Esperando Kernel')).toBeVisible();
  await expect(page.getByText(/Sin datos inventados/)).toBeVisible();

  await connect(page);
  await expect(page.getByText('Efesto is ready. Open the extension and press the central orb.')).toBeVisible();
  await expect(page.getByText('Hermes verificado')).toBeVisible();

  await page.getByRole('button', { name: /Internet Brain/ }).click();
  await expect(page.getByText('Investigando fuentes')).toBeVisible();
  await page.getByLabel('Mensaje').fill('Resume el estado');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Fixture response from the selected local model.')).toBeVisible();
  await expect(page.getByText(/fuera de Evidence y memoria/)).toBeVisible();

  await page.getByRole('button', { name: /Agentes/ }).click();
  await expect(page.getByRole('heading', { name: 'Hermes Agent Hub' })).toBeVisible();
  await expect(page.getByText('mission-1')).toBeVisible();
  await expect(page.getByText(/no escribe Evidence ni memoria directamente/)).toBeVisible();
});

test('disconnect clears the tab-only token and returns to the offline forge', async ({ page }) => {
  await page.goto('/');
  await connect(page);

  await page.getByRole('button', { name: 'Desconectar' }).click();
  await expect(page.getByRole('button', { name: 'Conectar' })).toBeVisible();
  await expect(page.getByLabel('Token privado')).toHaveValue('');
  await expect(page.getByText('Este navegador olvidó la URL y el token local.')).toBeVisible();
});

test.describe('mobile migrated control center', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps the forge, composer and bottom navigation inside the viewport', async ({ page }) => {
    await page.goto('/');
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: '¿Qué quieres investigar hoy?' })).toBeVisible();
    await expect(page.locator('.brain-stage')).toBeVisible();
    await expect(page.getByLabel('Mensaje')).toBeVisible();
    await expect(page.locator('.nav-section')).toHaveCSS('display', 'flex');

    const layout = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const visible = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
      });
      const clipped = visible.flatMap((element) => {
        const box = element.getBoundingClientRect();
        return box.left < -1 || box.right > viewportWidth + 1
          ? [`${element.tagName.toLowerCase()}.${element.className}: ${Math.round(box.left)}-${Math.round(box.right)}`]
          : [];
      });
      return {
        viewportWidth,
        documentWidth: document.documentElement.scrollWidth,
        clipped,
      };
    });

    expect(layout.documentWidth).toBe(layout.viewportWidth);
    expect(layout.clipped).toEqual([]);
  });
});
