// Frame-timing check (no video) for the preview recorder below.
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
  const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, });
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
const fps = (page) => page.evaluate(() => new Promise((res) => { const d = []; let last = performance.now(); const t0 = last; const tick = (now) => { d.push(now - last); last = now; if (now - t0 < 3000) requestAnimationFrame(tick); else { d.sort((a, b) => a - b); res({ fps: Math.round(d.length / 3), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), long: d.filter((x) => x > 25).length }); } }; requestAnimationFrame(tick); }));
const out = { mode };
for (const mobile of [false, true]) {
  const v = await open(mobile);
  await v.page.locator('.forge-live').first().waitFor({ timeout: 30000 });
  const key = mobile ? 'mobile' : 'desktop';
  await v.page.waitForTimeout(mode === 'webs' ? 3000 : 1000);
  out[`${key}Play`] = await fps(v.page);
  await v.page.waitForTimeout(mode === 'webs' ? 20000 : 16000);
  out[`${key}Settled`] = await fps(v.page);
  out[`${key}FrameMs`] = await v.page.locator('canvas[data-frame-ms]').first().getAttribute('data-frame-ms').catch(() => null);
  await v.context.close();
}
await browser.close();
console.log(JSON.stringify(out));
