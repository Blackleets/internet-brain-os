// Preview recorder (PREVIEW :3312, never the live :3311). Modes:
//  webs  — the herramientas Goal's real Kernel records, with searchTelemetry.searches[].results filled in
//          from results-webs-data-herramientas.json (the same planned queries re-run through Hermes' ddgs
//          worker, read-only). Overlay only: nothing is written to the Kernel.
//  idle  — the "agua en africa" Goal exactly as the Kernel has it (settled): after the play-through the
//          idle spider wanders.
// Prints JSON with the replay offsets (s) per view so the mp4s can be trimmed.
import { createRequire } from 'node:module';
import { readFileSync, renameSync } from 'node:fs';
const require = createRequire('/workspace/ibos-forge-live/apps/dashboard/package.json');
const { chromium } = require('@playwright/test');
const token = readFileSync('/tmp/forge-kernel-token', 'utf8').trim();
const mode = process.argv[2];
const GOALS = {
  webs: { goalId: 'goal:085949b1b66bc7b0886e0f79f17a44dcabdac155775223b6c561788645e4b6af', missionId: 'mission:44e67e1a07c73548d17f0ed5eed7897b0a1b4a2e48cb18f21ee07a65b6e53e5d' },
  idle: { goalId: 'goal:ce5a9117816d526c4620e229729a5581e6a780719ca6063315bed6941bd8dab7', missionId: 'mission:cbc83759b8cf8c365ce4332f8410e3d858c5725550a17e14bf174231dec5f971' },
};
const { goalId, missionId } = GOALS[mode];
const rerun = mode === 'webs' ? JSON.parse(readFileSync('/workspace/ref/forge-v3-polish/results-webs-data-herramientas.json', 'utf8')) : null;
const browser = await chromium.launch();
async function open(mobile) {
  const vp = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, recordVideo: { dir: `/tmp/rec-${mode}-${mobile ? 'mobile' : 'desktop'}`, size: vp } });
  await context.route(/\/api\/goal-surfaces$/, async (r) => { const response = await r.fetch(); const json = await response.json(); json.surfaces = json.surfaces.filter((s) => s.goal.id === goalId); await r.fulfill({ response, json }); });
  if (rerun) await context.route(/\/api\/agent-missions$/, async (r) => {
    const response = await r.fetch(); const json = await response.json();
    json.missions = json.missions.map((m) => {
      if (m.id !== missionId || !m.searchTelemetry) return m;
      const searches = m.searchTelemetry.searches.map((s, i) => {
        const re = rerun.searches[i];
        if (!re || re.query !== s.query) throw new Error(`query mismatch ${i}`);
        return { ...s, results: re.results.slice(0, 10) };
      });
      return { ...m, searchTelemetry: { ...m.searchTelemetry, searches } };
    });
    await r.fulfill({ response, json });
  });
  const page = await context.newPage();
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:3312/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Conectar Kernel' }).first().click();
  await page.getByRole('textbox', { name: 'URL del Kernel', exact: true }).fill('http://127.0.0.1:4310');
  await page.getByLabel('Token privado', { exact: true }).fill(token);
  await page.getByRole('button', { name: 'Autorizar dispositivo', exact: true }).click();
  await page.waitForTimeout(900);
  const closeToast = page.getByRole('button', { name: 'Cerrar aviso' });
  if (await closeToast.count()) await closeToast.first().click();
  await page.evaluate(() => [...document.querySelectorAll('.efesto-sidebar nav button')].find((b) => b.textContent.trim().startsWith('Inicio'))?.click());
  return { context, page, mobile, t0 };
}
const views = [await open(true), await open(false)];
for (const v of views) await v.page.locator('.forge-live').first().waitFor({ timeout: 30000 });
const out = { mode };
if (mode === 'webs') {
  await views[1].page.waitForTimeout(22000); // first play-through
  for (const v of views) {
    if (v.mobile) {
      // phones: open the compact list of returned webs, then replay
      const d = v.page.locator('.forge-live-webs summary');
      out.mobileWebsCount = await v.page.locator('.forge-live-webs summary b').textContent().catch(() => null);
    }
    if (v.mobile) {
      // phones: replay without scrolling away from the forge (a real tap would scroll to the button)
      await v.page.evaluate(() => { window.scrollTo(0, 0); [...document.querySelectorAll('.forge-live-replay')][0]?.click(); });
    } else {
      const b = v.page.getByRole('button', { name: /Repetir la forja/ });
      await b.scrollIntoViewIfNeeded().catch(() => {});
      await b.click().catch(() => {});
    }
    out[`${v.mobile ? 'mobile' : 'desktop'}Replay`] = (Date.now() - v.t0) / 1000;
  }
  await views[1].page.waitForTimeout(19000);
  // phones: then the list itself
  const m = views[0];
  out.mobileListAt = (Date.now() - m.t0) / 1000;
  await m.page.locator('.forge-live-webs summary').scrollIntoViewIfNeeded();
  await m.page.locator('.forge-live-webs summary').click();
  await m.page.waitForTimeout(600);
  await m.page.locator('.forge-live-webs').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await m.page.waitForTimeout(2500);
  await m.page.mouse.wheel(0, 500); await m.page.waitForTimeout(2500);
  await m.page.screenshot({ path: '/workspace/ref/forge-v3-polish/results-webs-mobile-list.png' });
  await views[1].page.screenshot({ path: '/workspace/ref/forge-v3-polish/results-webs-desktop-end.png' });
} else {
  for (const v of views) out[`${v.mobile ? 'mobile' : 'desktop'}Start`] = (Date.now() - v.t0) / 1000;
  await views[1].page.waitForTimeout(36000);
  out.fps = await views[1].page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n += 1; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(Math.round(n / 3)); }; requestAnimationFrame(tick); }));
  out.frameMs = await views[1].page.locator('canvas[data-frame-ms]').first().getAttribute('data-frame-ms').catch(() => null);
}
const paths = [];
for (const v of views) { const p = await v.page.video().path(); await v.context.close(); paths.push([v.mobile, p]); }
await browser.close();
for (const [mobile, p] of paths) { const dest = `/tmp/rec-${mode}-${mobile ? 'mobile' : 'desktop'}.webm`; renameSync(p, dest); out[mobile ? 'mobileWebm' : 'desktopWebm'] = dest; }
console.log(JSON.stringify(out));
