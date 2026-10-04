// Read-only smoke on live 3311: forge.log vs anvil rect, probe legend, pill on one line.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/workspace/ibos-forge-live/apps/dashboard/package.json');
const { chromium } = require('@playwright/test');
const token = readFileSync('/tmp/forge-kernel-token', 'utf8').trim();
const browser = await chromium.launch();
for (const [w, h, m] of [[390, 844, true], [1440, 900, false]]) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, isMobile: m, hasTouch: m });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3311/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Conectar Kernel' }).first().click();
  await page.getByRole('textbox', { name: 'URL del Kernel', exact: true }).fill('http://127.0.0.1:4310');
  await page.getByLabel('Token privado', { exact: true }).fill(token);
  await page.getByRole('button', { name: 'Autorizar dispositivo', exact: true }).click();
  await page.waitForTimeout(1500);
  const closeToast = page.getByRole('button', { name: 'Cerrar aviso' });
  if (await closeToast.count()) await closeToast.first().click().catch(() => {});
  await page.evaluate(() => [...document.querySelectorAll('.efesto-sidebar nav button')].find((b) => b.textContent.trim().startsWith('Inicio'))?.click());
  await page.locator('.forge-live-fx').first().waitFor({ state: 'attached', timeout: 20000 });
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => {
    const fx = document.querySelector('.forge-live-fx'); const [x, y, aw, ah] = (fx?.dataset.anvil ?? '').split(',').map(Number);
    const fr = fx.getBoundingClientRect(); const anvil = { l: fr.left + x, t: fr.top + y, r: fr.left + x + aw, b: fr.top + y + ah };
    const tk = document.querySelector('.forge-ticker')?.getBoundingClientRect();
    const hit = tk && !(tk.right <= anvil.l || tk.left >= anvil.r || tk.bottom <= anvil.t || tk.top >= anvil.b);
    const pill = document.querySelector('.connection-pill').getBoundingClientRect();
    return { anvil: Boolean(fx.dataset.anvil), tickerOverAnvil: hit, probeLegend: Boolean(document.querySelector('.lg-probe')), pillHeight: Math.round(pill.height) };
  });
  console.log(w, JSON.stringify(r));
  await context.close();
}
await browser.close();
