// Searching-state preview (PREVIEW :3312). The run-6 Goal as it looked while Hermes searched (12:01–12:38):
// the real goal-surface/mission records from the Kernel with the mission put back to running/investigating
// and no candidates yet. Visual preview only — labelled as a reconstruction overlay, nothing is written.
import { createRequire } from 'node:module';
import { readFileSync, renameSync } from 'node:fs';
const require = createRequire('/workspace/ibos-forge-live/apps/dashboard/package.json');
const { chromium } = require('@playwright/test');
const token = readFileSync('/tmp/forge-kernel-token', 'utf8').trim();
const [goalId, missionId] = process.argv.slice(2);
const browser = await chromium.launch();
async function open(mobile) {
  const vp = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await context.route(/\/api\/goal-surfaces$/, async (r) => { const response = await r.fetch(); const json = await response.json(); json.surfaces = json.surfaces.filter((s) => s.goal.id === goalId).map((s) => ({ ...s, mission: { ...s.mission, status: 'running', executionPhase: 'investigating', workState: 'investigating' } })); await r.fulfill({ response, json }); });
  await context.route(/\/api\/agent-missions$/, async (r) => { const response = await r.fetch(); const json = await response.json(); json.missions = json.missions.map((m) => (m.id === missionId ? { ...m, status: 'running', executionPhase: 'investigating', searchCandidates: [], verificationResults: [], findingsFunnel: undefined, verifyingAt: undefined } : m)); await r.fulfill({ response, json }); });
  await context.route(/\/api\/agent-missions\/[^/]+\/evidence$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, schemaVersion: 'efesto.mission-evidence.v1', sourceOfTruth: 'kernel', missionId, limits: { maxRecords: 20, maxExcerptChars: 280 }, evidence: [] }) }));
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3312/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Conectar Kernel' }).first().click();
  await page.getByRole('textbox', { name: 'URL del Kernel', exact: true }).fill('http://127.0.0.1:4310');
  await page.getByLabel('Token privado', { exact: true }).fill(token);
  await page.getByRole('button', { name: 'Autorizar dispositivo', exact: true }).click();
  await page.waitForTimeout(900);
  const closeToast = page.getByRole('button', { name: 'Cerrar aviso' });
  if (await closeToast.count()) await closeToast.first().click();
  await page.evaluate(() => [...document.querySelectorAll('.efesto-sidebar nav button')].find((b) => b.textContent.trim().startsWith('Inicio'))?.click());
  return { context, page, mobile };
}
const views = [null, await open(false)];
for (const v of views.slice(1)) await v.page.locator('.forge-live').first().waitFor({ timeout: 30000 });
await views[1].page.waitForTimeout(3000);
const r = await views[1].page.evaluate(() => new Promise((res) => { const d = []; let last = performance.now(); const t0 = last; const tick = (t) => { d.push(t - last); last = t; if (t - t0 < 6000) requestAnimationFrame(tick); else { d.sort((a, b) => a - b); res({ frames: d.length, fps: Math.round(d.length / 6), p50: d[Math.floor(d.length * 0.5)].toFixed(1), p95: d[Math.floor(d.length * 0.95)].toFixed(1), max: d[d.length - 1].toFixed(1) }); } }; requestAnimationFrame(tick); }));
console.log(JSON.stringify(r));
await browser.close();
