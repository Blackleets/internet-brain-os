import { expect, test, type Page } from '@playwright/test';

// Polish pass guard: every v3 shell screen keeps text ≥10px and WCAG AA (4.5:1) text contrast on
// phones and desktop, without horizontal overflow. Measured on rendered pixels' computed styles.
const token = 'test-token-that-is-long-enough-for-kernel-validation';
const VIEWS = ['Inicio', 'Objetivos', 'Hallazgos', 'Evidencia', 'Actividad', 'Agentes', 'Ajustes'];

async function connect(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Conectar Kernel' }).first().click();
  await page.getByRole('textbox', { name: 'URL del Kernel', exact: true }).fill('http://127.0.0.1:4100');
  await page.getByLabel('Token privado', { exact: true }).fill(token);
  await page.getByRole('button', { name: 'Autorizar dispositivo', exact: true }).click();
  await expect(page.getByRole('button', { name: /Kernel listo/ })).toBeVisible();
}

async function openView(page: Page, view: string): Promise<void> {
  await page.evaluate((label) => {
    const button = [...document.querySelectorAll<HTMLButtonElement>('.efesto-sidebar nav button, .efesto-sidebar button')].find((candidate) => candidate.textContent?.trim().startsWith(label));
    button?.click();
  }, view);
  await page.waitForTimeout(700);
  // The forge "reconstruction" fades rows in; judge the settled frame, not a mid-animation one.
  await expect(page.locator('.forge-live[data-playing="true"]')).toHaveCount(0, { timeout: 30_000 });
}

type Problem = { kind: 'small' | 'contrast'; text: string; detail: string };

async function legibilityProblems(page: Page): Promise<Problem[]> {
  return page.evaluate(() => {
    const parse = (value: string): [number, number, number, number] | null => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return [parts[0], parts[1], parts[2], parts[3] ?? 1];
    };
    const lum = ([r, g, b]: number[]) => {
      const c = [r, g, b].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const background = (el: Element): number[] | null => {
      // Composite translucent layers up to the first opaque background; gradients/images are skipped (unknown).
      const layers: number[][] = [];
      for (let node: Element | null = el; node; node = node.parentElement) {
        const cs = getComputedStyle(node);
        if (cs.backgroundImage !== 'none' && !layers.length && node !== document.body && node !== document.documentElement) return null;
        const color = parse(cs.backgroundColor);
        if (color && color[3] > 0) { layers.push(color); if (color[3] >= 0.99) break; }
      }
      let base = [8, 7, 6];
      for (const [r, g, b, a] of layers.reverse()) base = [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)];
      return base;
    };
    const visible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return rect.width > 1 && rect.height > 1 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.3 && rect.bottom > 0 && rect.top < innerHeight * 3;
    };
    const out: { kind: 'small' | 'contrast'; text: string; detail: string }[] = [];
    const scope = document.querySelector('.efesto-product') ?? document.body;
    for (const el of scope.querySelectorAll('*')) {
      if (el.closest('[aria-hidden="true"], svg, canvas, .forge-sr-only, .sr-only')) continue;
      const own = [...el.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent ?? '').join('').trim();
      if (own.length < 2 || !/[\p{L}\p{N}]/u.test(own) || !visible(el)) continue;
      const cs = getComputedStyle(el);
      const size = Number.parseFloat(cs.fontSize);
      if (size < 10) out.push({ kind: 'small', text: own.slice(0, 40), detail: `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${size}px` });
      const fg = parse(cs.color);
      const bg = background(el);
      if (!fg || !bg || el.closest('button:disabled, [aria-disabled="true"]')) continue;
      const opacity = [...(function* up(node: Element | null) { for (; node; node = node.parentElement) yield Number(getComputedStyle(node).opacity); })(el)].reduce((acc, value) => acc * value, 1);
      const alpha = fg[3] * opacity;
      const mixed = [fg[0] * alpha + bg[0] * (1 - alpha), fg[1] * alpha + bg[1] * (1 - alpha), fg[2] * alpha + bg[2] * (1 - alpha)];
      const [hi, lo] = [lum(mixed), lum(bg)].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) out.push({ kind: 'contrast', text: own.slice(0, 40), detail: `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${ratio.toFixed(2)}:1` });
    }
    return out;
  });
}

for (const size of [{ width: 360, height: 780, mobile: true }, { width: 390, height: 844, mobile: true }, { width: 1440, height: 900, mobile: false }]) {
  test(`v3 shell screens stay legible at ${size.width}px: text ≥10px, WCAG AA contrast, no horizontal overflow`, async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile });
    const page = await context.newPage();
    await page.goto('/');
    await connect(page);
    const problems: string[] = [];
    for (const view of VIEWS) {
      await openView(page, view);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 1) problems.push(`${view}: horizontal overflow ${overflow}px`);
      for (const problem of await legibilityProblems(page)) problems.push(`${view}: ${problem.kind} «${problem.text}» ${problem.detail}`);
    }
    expect(problems).toEqual([]);
    await context.close();
  });
}

test('Evidence titles decode stored HTML entities and wrap instead of ellipsizing on a phone', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  await connect(page);
  await openView(page, 'Evidencia');
  const title = page.locator('.case-list strong', { hasText: 'Classes — Python 3.14 documentation for supplier onboarding & research' });
  await expect(title).toBeVisible();
  await expect(page.locator('.case-list strong', { hasText: '&#8212;' })).toHaveCount(0);
  const lines = await title.evaluate((el) => Math.round(el.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(el).lineHeight)));
  expect(lines).toBeGreaterThanOrEqual(2);
  await context.close();
});
