import { describe, expect, it } from 'vitest';
import {
  goalCoreTerms, planSearchQueries, findingsFromResultRefs, parseSelectionOutput,
  selectionSchema, selectionBackend, runOllamaSelection, runHermesProcess, isAdRedirect,
} from './hermes-efesto-adapter.mjs';

const goal = {
  id: 'mission:1',
  goalTitle: 'mejores herramientas gratis de IA para pequeñas empresas',
  // The Kernel's keywords drop short words, including the acronym that carries the topic.
  scope: { categories: ['tool'], keywords: ['mejores', 'herramientas', 'gratis', 'pequeñas', 'empresas'] },
};
const results = [
  { url: 'https://leadsales.io/blog/mejores-ia-gratis-negocios/', title: 'IA gratis', description: '' },
  { url: 'https://mariaretamero.com/blog/mejores-herramientas-ia-gratuitas.html', title: '20 IA', description: '' },
  { url: 'https://example.org/pymes-ia', title: 'Pymes', description: '' },
];

describe('Goal acronyms in planned queries', () => {
  it('keeps an uppercase 2-letter acronym the Kernel keywords dropped, in Goal order', () => {
    expect(goalCoreTerms(goal)).toEqual(['mejores', 'herramientas', 'gratis', 'ia', 'pequeñas', 'empresas']);
    expect(planSearchQueries(goal)[0]).toBe('mejores herramientas gratis ia pequeñas empresas');
    for (const query of planSearchQueries(goal)) expect(query.split(' ')).toContain('ia');
  });
  it('does not promote lowercase short words or duplicate an acronym already present', () => {
    expect(goalCoreTerms({ goalTitle: 'ia de uso', scope: { keywords: ['uso'] } })).toEqual(['uso']);
    expect(goalCoreTerms({ goalTitle: 'AI tools', scope: { keywords: ['ai', 'tools'] } })).toEqual(['ai', 'tools']);
  });
});

describe('selection parsing from real hits only', () => {
  it('maps "n:K" references in a markdown answer back to listed hits and ignores out-of-range numbers', () => {
    const markdown = '| Tool | Notes |\n|---|---|\n| **Leadsales** | (n:1) |\n| Retamero | n: 2 |\n| Ghost | n:99 |';
    expect(findingsFromResultRefs(markdown, results)).toEqual([{ url: results[0].url }, { url: results[1].url }]);
    expect(parseSelectionOutput(markdown, results).findings.map((f) => f.url)).toEqual([results[0].url, results[1].url]);
  });
  it('still throws when the answer has no JSON, no URL and no reference', () => {
    expect(() => parseSelectionOutput('Here are some great tools for you.', results)).toThrow();
  });
});

describe('ollama-structured selection', () => {
  it('constrains every url to the listed hits with a JSON schema enum', () => {
    expect(selectionSchema(results).properties.findings.items.properties.url.enum).toEqual(results.map((r) => r.url));
  });
  it('is opt-in and validated', () => {
    expect(selectionBackend({})).toBe('hermes');
    expect(selectionBackend({ HEPHAESTUS_SELECTION_BACKEND: 'ollama-structured' })).toBe('ollama-structured');
    expect(() => selectionBackend({ HEPHAESTUS_SELECTION_BACKEND: 'cloud' })).toThrow();
  });
  it('calls Ollama /api/chat with think:false and format=schema, and returns the selected listed hits', async () => {
    let sent;
    const fetchImpl = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return { ok: true, json: async () => ({ message: { content: JSON.stringify({ findings: [{ url: results[2].url }] }) } }) }; };
    const out = await runOllamaSelection({ prompt: 'p', results, env: { OLLAMA_HOST: '127.0.0.1:11434', HERMES_INFERENCE_MODEL: 'qwen3.5:2b' }, timeoutMs: 60_000, fetchImpl });
    expect(sent.url).toBe('http://127.0.0.1:11434/api/chat');
    expect(sent.body.think).toBe(false);
    expect(sent.body.options.num_ctx).toBe(8192);
    expect(sent.body.format.properties.findings.items.properties.url.enum).toHaveLength(3);
    expect(out.findings.map((f) => f.url)).toEqual([results[2].url]);
  });
  it('fails readably when Ollama is unreachable', async () => {
    const fetchImpl = async () => { throw new TypeError('fetch failed'); };
    await expect(runOllamaSelection({ prompt: 'p', results, env: { HERMES_INFERENCE_MODEL: 'm' }, fetchImpl })).rejects.toThrow('could not reach Ollama');
  });
});

describe('Hermes nonzero exit after a usable answer', () => {
  it('salvages listed hits from stdout instead of failing the attempt', async () => {
    const script = `process.stdout.write(${JSON.stringify('Tabla:\n| A | n:1 |\n| B | n:3 |')}); process.exit(1);`;
    const out = await runHermesProcess({ executable: process.execPath, args: ['-e', script], timeoutMs: 10_000, env: process.env, cwd: process.cwd(), results });
    expect(out.findings.map((f) => f.url)).toEqual([results[0].url, results[2].url]);
  });
  it('still fails when the nonzero exit carries nothing usable', async () => {
    const script = 'process.stderr.write("boom"); process.exit(1);';
    await expect(runHermesProcess({ executable: process.execPath, args: ['-e', script], timeoutMs: 10_000, env: process.env, cwd: process.cwd(), results })).rejects.toThrow('Hermes exited with code 1');
  });
});

describe('ad redirects are not candidates', () => {
  it('recognises search-engine ad click URLs and leaves normal pages alone', () => {
    expect(isAdRedirect('https://www.bing.com/aclick?ld=abc&u=xyz')).toBe(true);
    expect(isAdRedirect('https://duckduckgo.com/y.js?ad_domain=x')).toBe(true);
    expect(isAdRedirect('https://www.bing.com/search?q=ia')).toBe(false);
    expect(isAdRedirect('https://leadsales.io/blog/mejores-ia-gratis-negocios/')).toBe(false);
  });
});
