import { expect, test, type Page } from '@playwright/test';

// The connector at the top of the shell: one tap from any screen, Kernel + agent status from the
// Kernel (GET /api/agents), step-by-step worker setup, and a "Probar conexión" that only passes after
// the agent itself reached the Kernel (here: the worker doctor's ping, sent without a browser Origin).
const token = 'test-token-that-is-long-enough-for-kernel-validation';
const shotsDir = process.env.AGENT_SHOTS_DIR;

async function connect(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Conectar Kernel' }).first().click();
  await page.getByRole('textbox', { name: 'URL del Kernel', exact: true }).fill('http://127.0.0.1:4100');
  await page.getByLabel('Token privado', { exact: true }).fill(token);
  await page.getByRole('button', { name: 'Autorizar dispositivo', exact: true }).click();
  await expect(page.getByRole('button', { name: /Kernel listo/ })).toBeVisible();
}

for (const view of [{ name: '390', width: 390, height: 844, mobile: true }, { name: 'desktop', width: 1440, height: 900, mobile: false }]) {
  test(`agent connector at ${view.name}: honest status, copyable setup, test-connection that needs a real agent contact`, async ({ browser, request }) => {
    test.setTimeout(60_000);
    await request.post('http://127.0.0.1:4100/__fixture/reset-agents');
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, isMobile: view.mobile, hasTouch: view.mobile });
    const page = await context.newPage();
    const writes: string[] = [];
    page.on('request', (req) => { if (req.method() === 'POST') writes.push(new URL(req.url()).pathname); });
    await page.goto('/');
    await connect(page);
    // Open the connector from the top of the shell (Home's top-right connector).
    await page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>('.efesto-sidebar nav button')].find((button) => button.textContent?.trim().startsWith('Inicio'))?.click());
    await page.locator('.forge-state-action').click();
    const sheet = page.getByRole('dialog', { name: 'Kernel y agentes' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Kernel listo', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('heading', { name: /^Sin contacto desde que arrancó el Kernel/ })).toBeVisible();
    await expect(sheet.getByLabel('Configuración del worker', { exact: true })).toContainText('export HEPHAESTUS_KERNEL_URL="http://127.0.0.1:4100"');
    await expect(sheet).not.toContainText(token);
    const box = await sheet.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= view.width + 1).toBe(true);
    if (shotsDir) await page.screenshot({ path: `${shotsDir}/agent-connector-${view.name}.png` });

    await sheet.getByRole('button', { name: /Probar conexión/ }).click();
    await expect(sheet.getByText(/^Aún no: el Kernel no ha recibido a Hermes Agent/)).toBeVisible();

    // The worker doctor pings from the agent machine (no browser Origin). Only then does the test pass.
    const ping = await request.post('http://127.0.0.1:4100/api/agents/hermes/ping', { headers: { 'x-hephaestus-token': token } });
    expect(ping.status()).toBe(200);
    await sheet.getByRole('button', { name: /Probar conexión/ }).click();
    await expect(sheet.getByText(/^Funciona: el Kernel recibió a Hermes Agent hace \d+ s \(comprobación del doctor\)\./)).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'Hermes conectado' })).toBeVisible();
    if (shotsDir) await page.screenshot({ path: `${shotsDir}/agent-connector-${view.name}-tested.png` });
    // The dashboard itself never posts a ping (it cannot fake a connection).
    expect(writes.filter((path) => path.startsWith('/api/agents'))).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await context.close();
  });
}
