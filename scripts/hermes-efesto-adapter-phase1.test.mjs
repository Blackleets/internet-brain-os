import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPlannedSearches, runWikipediaSearch, goalWikipediaLanguage, parseNumberedSelection, selectionSchema, buildSelectionPrompt } from './hermes-efesto-adapter.mjs';
import { normalizeSearchTelemetry } from '../apps/local-kernel/agent-mission-executor.mjs';

const dir = mkdtempSync(join(tmpdir(), 'efesto-phase1-'));
function worker(name, body) {
  const file = join(dir, `${name}.cjs`);
  writeFileSync(file, `let raw='';process.stdin.on('data',c=>raw+=c).on('end',()=>{const request=JSON.parse(raw);${body}});`);
  return { executable: process.execPath, args: [file] };
}

describe('keyless fallback search', () => {
  it('falls back to Wikipedia only for queries DuckDuckGo failed or answered empty, and records the source', async () => {
    const ddg = worker('mixed', `if (request.query === 'ok') process.stdout.write(JSON.stringify({ ok: true, results: [{ url: 'https://a.example/1', title: 'A' }] }));
      else if (request.query === 'empty') process.stdout.write(JSON.stringify({ ok: true, results: [] }));
      else process.stdout.write(JSON.stringify({ ok: false, error: 'DDGSException: No results found.' }));`);
    const asked = [];
    const fallbackSearch = async (query) => { asked.push(query); return { ok: true, source: 'wikipedia', results: [{ url: `https://es.wikipedia.org/wiki/${query}`, title: query, description: '' }] }; };
    const { searches, results } = await runPlannedSearches(['ok', 'empty', 'fail'], ddg, { fallbackSearch });
    expect(asked.sort()).toEqual(['empty', 'fail']);
    expect(searches.map((s) => [s.query, s.source, s.resultCount])).toEqual([['ok', 'ddgs', 1], ['empty', 'wikipedia', 1], ['fail', 'wikipedia', 1]]);
    expect(results.map((r) => r.url)).toEqual(['https://a.example/1', 'https://es.wikipedia.org/wiki/empty', 'https://es.wikipedia.org/wiki/fail']);
    // the Kernel accepts the source on the display-only telemetry (and rejects an unknown one)
    expect(normalizeSearchTelemetry({ searches }).searches.map((s) => s.source)).toEqual(['ddgs', 'wikipedia', 'wikipedia']);
    expect(normalizeSearchTelemetry({ searches: [{ query: 'x', source: 'google' }] })).toBeUndefined();
  });

  it('runs the planned queries in parallel', async () => {
    const slow = worker('slow', `setTimeout(() => process.stdout.write(JSON.stringify({ ok: true, results: [{ url: 'https://s.example/' + encodeURIComponent(request.query) }] })), 700);`);
    const t0 = Date.now();
    const { searches } = await runPlannedSearches(['a', 'b', 'c'], slow);
    expect(searches.map((s) => s.query)).toEqual(['a', 'b', 'c']);
    expect(Date.now() - t0).toBeLessThan(1900);
  });

  it('builds Wikipedia article URLs only from titles the API returned, with a User-Agent and no key', async () => {
    let seen;
    const fetchImpl = async (url, init) => { seen = { url: new URL(url), init }; return { ok: true, json: async () => ({ query: { search: [{ title: 'Inteligencia artificial', snippet: 'La <span class="searchmatch">IA</span> es' }, { title: '' }] } }) }; };
    const out = await runWikipediaSearch('herramientas ia', { lang: 'es', fetchImpl });
    expect(seen.url.host).toBe('es.wikipedia.org');
    expect(seen.url.searchParams.get('srsearch')).toBe('herramientas ia');
    expect([...seen.url.searchParams.keys()].some((k) => /key|token/i.test(k))).toBe(false);
    expect(seen.init.headers['user-agent']).toMatch(/^Efesto\//);
    expect(out).toEqual({ ok: true, source: 'wikipedia', results: [{ title: 'Inteligencia artificial', url: 'https://es.wikipedia.org/wiki/Inteligencia_artificial', description: 'La IA es' }] });
    expect(await runWikipediaSearch('x', { fetchImpl: async () => { throw new Error('down'); } })).toEqual({ ok: false, source: 'wikipedia' });
    expect(await runWikipediaSearch('x', { lang: 'evil.example/', fetchImpl })).toEqual({ ok: false, source: 'wikipedia' });
    expect(goalWikipediaLanguage({ goalTitle: 'mejores herramientas gratis de IA' })).toBe('es');
    expect(goalWikipediaLanguage({ goalTitle: 'best free AI tools' })).toBe('en');
  });
});

describe('numbered selection (small, fast model output)', () => {
  const results = [{ url: 'https://a.example/1' }, { url: 'https://b.example/2' }, { url: 'https://c.example/3' }];
  it('constrains the model to listed numbers and maps them to the real hits', () => {
    expect(selectionSchema(results, { byNumber: true }).properties.findings.items.enum).toEqual([1, 2, 3]);
    expect(parseNumberedSelection('{"findings":[2,2,9,1]}', results).findings.map((f) => f.url)).toEqual(['https://b.example/2', 'https://a.example/1']);
  });
  it('asks for numbers and shortens descriptions in the prompt', () => {
    const payload = { schemaVersion: 'efesto.hermes-mission.v1', mission: { id: 'm', goalTitle: 'g', scope: {} } };
    const long = [{ url: 'https://a.example/1', title: 't', description: 'x'.repeat(200) }];
    const numbered = buildSelectionPrompt(payload, long, { byNumber: true });
    expect(numbered).toContain('{"findings":[3,7,12]}');
    expect(numbered.length).toBeLessThan(buildSelectionPrompt(payload, long).length);
  });
});
