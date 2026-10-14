/** Offline eval: readable-text extraction on recorded real public pages. Usage: npx tsx scripts/eval-readable-text.mts [path-to-alt-web-page.ts] */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const dir = resolve('tests/fixtures/readable-eval');
const BUDGET = 4000; // chars of page text an evidence window typically sees
const norm = (s: string) => s.replace(/\s+/g, ' ').toLowerCase();
const mod = await import(resolve(process.argv[2] ?? 'packages/connectors/src/web-page.ts'));
const htmlToText: (h: string) => string = mod.htmlToText;
const { items } = JSON.parse(readFileSync(`${dir}/labels.json`, 'utf8'));
let found = 0, inBudget = 0, falseHits = 0, chars = 0;
for (const it of items) {
  const t = norm(htmlToText(readFileSync(`${dir}/${it.file}`, 'utf8')));
  const idx = t.indexOf(norm(it.evidence));
  if (idx >= 0) found++; if (idx >= 0 && idx + it.evidence.length <= BUDGET) inBudget++;
  if (t.includes(norm(it.negative))) falseHits++;
  chars += t.length;
  console.log(`${it.file.padEnd(20)} len=${String(t.length).padStart(7)} evidenceAt=${idx}`);
}
console.log(JSON.stringify({ pages: items.length, evidenceFound: found, evidenceWithinBudget: inBudget, negativeFalseHits: falseHits, totalChars: chars }));
