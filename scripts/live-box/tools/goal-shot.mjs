// Screenshot one Goal's forge (Inicio, filtered read-only to that Goal) at 390 and 1440. Read-only.
// Usage: node goal-shot.mjs <base> <goalId> <outPrefix>
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/workspace/ibos-forge-live/apps/dashboard/package.json');
const { chromium } = require('@playwright/test');
const token = readFileSync('/tmp/forge-kernel-token', 'utf8').trim();
const [base, goalId, out] = process.argv.slice(2);
const browser = await chromium.launch();
for (const mobile of [true, false]) {
  const vp = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const context = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await context.route(/\/api\/goal-surfaces$/, async (r) => { const response = await r.fetch(); const json = await response.json(); json.surfaces = json.surfaces.filter((s) => s.goal.id === goalId); await r.fulfill({ response, json }); });
  await context.addInitScript(() => { try { matchMedia; } catch {} });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Conectar Kernel' }).first().click();
  await page.getByRole('textbox', { name: 'URL del Kernel', exact: true }).fill('http://127.0.0.1:4310');
  await page.getByLabel('Token privado', { exact: true }).fill(token);
  await page.getByRole('button', { name: 'Autorizar dispositivo', exact: true }).click();
  await page.waitForTimeout(1200);
  const closeToast = page.getByRole('button', { name: 'Cerrar aviso' });
  if (await closeToast.count()) await closeToast.first().click().catch(() => {});
  await page.evaluate(() => [...document.querySelectorAll('.efesto-sidebar nav button')].find((b) => b.textContent.trim().startsWith('Inicio'))?.click());
  await page.locator('.forge-live').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  const key = mobile ? '390' : '1440';
  await page.screenshot({ path: `${out}-${key}.png` });
  if (mobile) {
    await page.locator('.forge-live-panel').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}-${key}-panel.png` });
  }
  const text = await page.locator('.forge-live').first().innerText();
  console.log(`== ${key}\n${text.slice(0, 1800)}`);
  await context.close();
}
await browser.close();
