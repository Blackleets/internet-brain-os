import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:8080/goals/g_96d4b6e2273840f7", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const box = await page.locator("[data-forge-receipt]").boundingBox();
console.log("box", box);
const text = await page.evaluate(() => {
  const r = document.querySelector("[data-forge-receipt]");
  const card = document.querySelector("h3");
  return {
    receipt: r?.innerText,
    kickers: Array.from(document.querySelectorAll(".kicker")).map((n) => n.textContent),
    h3: card?.textContent,
  };
});
console.log(JSON.stringify(text, null, 2));
await page.locator("[data-forge-receipt]").screenshot({ path: "/workspace/screenshots/receipt-panel.png" });
const finding = page.locator("h3").first();
if (await finding.count()) {
  await page.locator(".space-y-4, [class*='space-y-4']").first().screenshot({ path: "/workspace/screenshots/finding-bands.png" }).catch(() => {});
}
await page.screenshot({ path: "/workspace/screenshots/case-done.png" });
await browser.close();
