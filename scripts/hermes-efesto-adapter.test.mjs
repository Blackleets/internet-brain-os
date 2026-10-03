import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildHermesArgs,
  buildHermesEnvironment,
  buildHermesPrompt,
  normalizeHermesExecutable,
  parseHermesFindings,
  prepareHermesHome,
  resolveSourceHermesHome,
  runHermesProcess,
  runHermesOneShot,
  seedIsolatedHermesCredentials,
  wipeCopiedHermesCredentials,
  applySourceHermesModelRoute,
  parseTopLevelHermesModelRoute,
  collectHermesSearchTelemetry,
  parseHermesSearchCalls,
} from './hermes-efesto-adapter.mjs';

const SAMPLE_DEBUG_LOG = new URL('./fixtures/hermes-web-tools-debug.sample.json', import.meta.url);
const SAMPLE_SEARCHES = [
  { query: 'empleo repartidor rider España', limit: 10, resultCount: 10 },
  { query: 'trabajo delivery Barcelona', limit: 10, resultCount: 7 },
  // errored call: what was searched is known, how many results came back is not
  { query: 'ofertas rider glovo', limit: 10 },
  // no limit and a malformed count in the log: both omitted, never guessed
  { query: 'repartidor autónomo requisitos' },
];

describe('Hermes Efesto adapter', () => {
  it('builds a bounded public discovery prompt from an authorized mission', () => {
    const prompt = buildHermesPrompt({
      schemaVersion: 'efesto.hermes-mission.v1',
      mission: { id: 'mission-1', goalTitle: 'Find grants in Madrid', cadence: 'once', scope: { categories: ['funding'], keywords: ['grant'], location: 'Madrid' } },
    });
    expect(prompt).toContain('Return ONLY one valid JSON object');
    expect(prompt).toContain('Find grants in Madrid');
    expect(prompt).toContain('public-source discovery mission');
    expect(prompt).toContain('candidates, not verified Evidence');
    expect(prompt).toContain('canonical, directly readable public pages');
    expect(prompt).toContain('Make exactly one public search call');
    expect(prompt).toContain('Do not call another tool after the search result.');
    expect(prompt).toContain('Return 3 to 5 relevant findings');
    expect(prompt.startsWith('/no_think\n')).toBe(true);
    expect(prompt).toContain('{"findings":[{"url":"https://public.example/path"}]}');
    expect(prompt).toContain('Each finding must contain exactly one field: url.');
    expect(prompt).toContain('Do not copy titles, snippets, summaries, dates, or other prose');
  });

  it('isolates user customizations while keeping the official search backend available', () => {
    const prompt = 'Return JSON only';
    const args = buildHermesArgs(prompt, 4, 'custom', 'qwen3.5:2b');
    expect(args).toEqual(['chat', '--query', prompt, '--quiet', '--max-turns', '4', '--provider', 'custom', '--model', 'qwen3.5:2b', '--ignore-rules', '--toolsets', 'search']);
    expect(args).not.toContain('--safe-mode');
    expect(args).not.toContain('web');
    expect(args).not.toContain('browser');
    expect(args).not.toContain('terminal');
  });

  it('uses an ephemeral Hermes home and refuses inherited project plugins', () => {
    const env = buildHermesEnvironment({
      HERMES_HOME: '/user-owned-hermes',
      HERMES_SAFE_MODE: '1',
      HERMES_ENABLE_PROJECT_PLUGINS: '1',
      OPENROUTER_API_KEY: 'test-key',
    }, '/tmp/efesto-hermes-isolated');

    expect(env).toMatchObject({
      HERMES_HOME: '/tmp/efesto-hermes-isolated',
      HERMES_ALLOW_PRIVATE_URLS: 'false',
      HERMES_IGNORE_RULES: '1',
      OPENROUTER_API_KEY: 'test-key',
    });
    expect(env).not.toHaveProperty('HERMES_SAFE_MODE');
    expect(env).not.toHaveProperty('HERMES_ENABLE_PROJECT_PLUGINS');
    expect(env).not.toHaveProperty('HERMES_IGNORE_USER_CONFIG');
    expect(env.WEB_TOOLS_DEBUG).toBe('true');
  });

  it('turns a Hermes web_tools debug log into search telemetry without guessing missing fields', async () => {
    const sample = JSON.parse(await readFile(SAMPLE_DEBUG_LOG, 'utf8'));
    expect(parseHermesSearchCalls(sample.tool_calls)).toEqual(SAMPLE_SEARCHES);
    expect(parseHermesSearchCalls(undefined)).toEqual([]);
    expect(parseHermesSearchCalls([
      { tool_name: 'web_search_tool', parameters: { query: '   ' }, error: null, results_count: 3 },
      { tool_name: 'web_search_tool', parameters: { query: 'x'.repeat(301) }, error: null, results_count: 3 },
      { tool_name: 'web_search_tool', parameters: { query: 'ok', limit: 0 }, error: null, results_count: -1 },
      null,
    ])).toEqual([{ query: 'ok' }]);
    const many = Array.from({ length: 12 }, (_, index) => ({ tool_name: 'web_search_tool', parameters: { query: `q${index}`, limit: 10 }, error: null, results_count: 1 }));
    expect(parseHermesSearchCalls(many)).toHaveLength(8);
  });

  it('reads the debug logs from the isolated Hermes home, removes them, and tolerates a missing or broken log', async () => {
    const home = await mkdtemp(join(tmpdir(), 'efesto-hermes-telemetry-'));
    try {
      expect(await collectHermesSearchTelemetry(home)).toEqual([]);
      await mkdir(join(home, 'logs'));
      await writeFile(join(home, 'logs', 'web_tools_debug_a.json'), await readFile(SAMPLE_DEBUG_LOG, 'utf8'), 'utf8');
      await writeFile(join(home, 'logs', 'web_tools_debug_b.json'), '{not json', 'utf8');
      await writeFile(join(home, 'logs', 'vision_tools_debug_c.json'), '{"tool_calls":[{"tool_name":"web_search_tool","parameters":{"query":"nope"}}]}', 'utf8');
      expect(await collectHermesSearchTelemetry(home)).toEqual(SAMPLE_SEARCHES);
      expect((await readdir(join(home, 'logs'))).sort()).toEqual(['vision_tools_debug_c.json']);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it('reports the searches Hermes made alongside its findings, read before the isolated home is deleted', async () => {
    const isolated = await mkdtemp(join(tmpdir(), 'efesto-hermes-telemetry-run-'));
    const quietHome = await mkdtemp(join(tmpdir(), 'efesto-hermes-telemetry-quiet-'));
    try {
      const sample = await readFile(SAMPLE_DEBUG_LOG, 'utf8');
      await writeFile(join(isolated, 'chat'), `const fs = require('node:fs'); const path = require('node:path');
if (process.env.WEB_TOOLS_DEBUG !== 'true') process.exit(3);
fs.mkdirSync(path.join(process.env.HERMES_HOME, 'logs'), { recursive: true });
fs.writeFileSync(path.join(process.env.HERMES_HOME, 'logs', 'web_tools_debug_run.json'), ${JSON.stringify(sample)});
process.stdout.write(JSON.stringify({ findings: [{ url: 'https://example.com/a' }] }));
`, 'utf8');
      const payload = { schemaVersion: 'efesto.hermes-mission.v1', mission: { id: 'mission-1', goalTitle: 'Find grants', cadence: 'once', scope: {} } };
      const result = await runHermesOneShot(payload, { executable: process.execPath, hermesHome: isolated, timeoutMs: 4_000, env: { ...process.env, HERMES_HOME: isolated } });
      expect(result.findings.map((finding) => finding.url)).toEqual(['https://example.com/a']);
      expect(result.searches).toEqual(SAMPLE_SEARCHES);
      // The run's debug log is consumed: nothing is left in the isolated home.
      expect(await readdir(join(isolated, 'logs'))).toEqual([]);
      await writeFile(join(quietHome, 'chat'), "process.stdout.write(JSON.stringify({ findings: [{ url: 'https://example.com/b' }] }));\n", 'utf8');
      const quiet = await runHermesOneShot(payload, { executable: process.execPath, hermesHome: quietHome, timeoutMs: 4_000, env: { ...process.env, HERMES_HOME: quietHome } });
      expect(quiet).not.toHaveProperty('searches');
    } finally {
      await rm(isolated, { recursive: true, force: true });
      await rm(quietHome, { recursive: true, force: true });
    }
  });

  it('resolves the process Hermes home without using the isolated destination', () => {
    expect(resolveSourceHermesHome({ HERMES_HOME: '/user-owned-hermes', LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local' })).toBe('/user-owned-hermes');
    expect(resolveSourceHermesHome({ LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local' })).toMatch(/hermes$/);
  });

  it('copies only credential files into the isolated Hermes home and never state.db', async () => {
    const source = await mkdtemp(join(tmpdir(), 'efesto-hermes-cred-src-'));
    const isolated = await mkdtemp(join(tmpdir(), 'efesto-hermes-cred-dst-'));
    try {
      await writeFile(join(source, 'auth.json'), '{"active_provider":"test"}\n', 'utf8');
      await writeFile(join(source, '.env'), 'OPENROUTER_API_KEY=test-not-a-real-secret\n', 'utf8');
      await writeFile(join(source, 'state.db'), 'founder-state-must-not-copy', 'utf8');
      await writeFile(join(source, 'config.yaml'), 'founder-config-must-not-replace-isolated\n', 'utf8');
      const copied = await seedIsolatedHermesCredentials(isolated, source);
      expect(copied.sort()).toEqual(['.env', 'auth.json']);
      expect(await readFile(join(isolated, 'auth.json'), 'utf8')).toContain('active_provider');
      await expect(readFile(join(isolated, 'state.db'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(readFile(join(isolated, 'config.yaml'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await seedIsolatedHermesCredentials(isolated, isolated)).toEqual([]);
      expect(await seedIsolatedHermesCredentials(isolated, '')).toEqual([]);
    } finally {
      await rm(source, { recursive: true, force: true });
      await rm(isolated, { recursive: true, force: true });
    }
  });

  it('wipes only copied credential names and never the source home', async () => {
    const source = await mkdtemp(join(tmpdir(), 'efesto-hermes-wipe-src-'));
    const isolated = await mkdtemp(join(tmpdir(), 'efesto-hermes-wipe-dst-'));
    try {
      await writeFile(join(source, 'auth.json'), '{"active_provider":"test"}\n', 'utf8');
      await writeFile(join(source, '.env'), 'OPENROUTER_API_KEY=test-not-a-real-secret\n', 'utf8');
      await writeFile(join(isolated, 'auth.json'), '{"active_provider":"copied"}\n', 'utf8');
      await writeFile(join(isolated, 'state.db'), 'must-remain', 'utf8');
      await wipeCopiedHermesCredentials(isolated, ['auth.json', 'state.db', '.env']);
      await expect(readFile(join(isolated, 'auth.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readFile(join(isolated, 'state.db'), 'utf8')).toBe('must-remain');
      expect(await readFile(join(source, 'auth.json'), 'utf8')).toContain('active_provider');
      expect(await readFile(join(source, '.env'), 'utf8')).toContain('test-not-a-real-secret');
      await wipeCopiedHermesCredentials(isolated, ['auth.json']);
    } finally {
      await rm(source, { recursive: true, force: true });
      await rm(isolated, { recursive: true, force: true });
    }
  });

  it('unlinks copied credentials after a caller-owned one-shot and never deletes the source home', async () => {
    const source = await mkdtemp(join(tmpdir(), 'efesto-hermes-oneshot-src-'));
    const isolated = await mkdtemp(join(tmpdir(), 'efesto-hermes-oneshot-dst-'));
    try {
      await writeFile(join(source, 'auth.json'), '{"active_provider":"test"}\n', 'utf8');
      await writeFile(join(source, '.env'), 'OPENROUTER_API_KEY=test-not-a-real-secret\n', 'utf8');
      await writeFile(join(source, '.anthropic_oauth.json'), '{"test":true}\n', 'utf8');
      await writeFile(join(isolated, 'chat'), 'process.stdout.write(JSON.stringify({findings:[{url:"https://example.com/a"}]}));\n', 'utf8');
      const result = await runHermesOneShot({
        schemaVersion: 'efesto.hermes-mission.v1',
        mission: { id: 'mission-1', goalTitle: 'Find grants', cadence: 'once', scope: {} },
      }, {
        executable: process.execPath,
        hermesHome: isolated,
        timeoutMs: 4_000,
        env: { ...process.env, HERMES_HOME: source },
      });
      expect(result.findings[0].url).toBe('https://example.com/a');
      await expect(readFile(join(isolated, 'auth.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(readFile(join(isolated, '.env'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(readFile(join(isolated, '.anthropic_oauth.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readFile(join(source, 'auth.json'), 'utf8')).toContain('active_provider');
      expect(await readFile(join(source, '.env'), 'utf8')).toContain('test-not-a-real-secret');
      expect(await readFile(join(source, '.anthropic_oauth.json'), 'utf8')).toContain('test');
    } finally {
      await rm(source, { recursive: true, force: true });
      await rm(isolated, { recursive: true, force: true });
    }
  });

  it('does not unlink source credentials when the isolated home is the source home', async () => {
    const source = await mkdtemp(join(tmpdir(), 'efesto-hermes-oneshot-same-'));
    try {
      await writeFile(join(source, 'auth.json'), '{"active_provider":"test"}\n', 'utf8');
      await writeFile(join(source, '.env'), 'OPENROUTER_API_KEY=test-not-a-real-secret\n', 'utf8');
      await writeFile(join(source, 'chat'), 'process.stdout.write(JSON.stringify({findings:[]}));\n', 'utf8');
      await runHermesOneShot({
        schemaVersion: 'efesto.hermes-mission.v1',
        mission: { id: 'mission-1', goalTitle: 'Find grants', cadence: 'once', scope: {} },
      }, {
        executable: process.execPath,
        hermesHome: source,
        timeoutMs: 4_000,
        env: { ...process.env, HERMES_HOME: source },
      });
      expect(await readFile(join(source, 'auth.json'), 'utf8')).toContain('active_provider');
      expect(await readFile(join(source, '.env'), 'utf8')).toContain('test-not-a-real-secret');
    } finally {
      await rm(source, { recursive: true, force: true });
    }
  });

  it('copies only the source model route into isolated config.yaml and never toolsets', async () => {
    const source = await mkdtemp(join(tmpdir(), 'efesto-hermes-model-src-'));
    const isolated = await mkdtemp(join(tmpdir(), 'efesto-hermes-model-dst-'));
    try {
      await writeFile(join(source, 'config.yaml'), 'model:\n  default: nvidia/nemotron-test\n  provider: nvidia\n  base_url: https://example.invalid/v1\ntoolsets:\n  - hermes-cli\nagent:\n  max_turns: 60\n', 'utf8');
      const isolatedConfig = await prepareHermesHome(isolated, 4);
      const route = await applySourceHermesModelRoute(isolated, source);
      expect(route).toEqual({ default: 'nvidia/nemotron-test', provider: 'nvidia', base_url: 'https://example.invalid/v1' });
      expect(JSON.parse(await readFile(isolatedConfig, 'utf8'))).toEqual({
        agent: { max_turns: 4 },
        model: { default: 'nvidia/nemotron-test', provider: 'nvidia', base_url: 'https://example.invalid/v1' },
      });
      expect(parseTopLevelHermesModelRoute('not-model: true\n')).toBeUndefined();
    } finally {
      await rm(source, { recursive: true, force: true });
      await rm(isolated, { recursive: true, force: true });
    }
  });

  it('writes one exclusive bounded-turn config into the isolated Hermes home', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'efesto-hermes-config-test-'));
    try {
      const configPath = await prepareHermesHome(directory);
      expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual({ agent: { max_turns: 8 } });
      await expect(prepareHermesHome(directory)).rejects.toMatchObject({ code: 'EEXIST' });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('supports a stricter per-run turn cap without allowing expansion beyond eight', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'efesto-hermes-turn-cap-test-'));
    const invalidDirectory = await mkdtemp(join(tmpdir(), 'efesto-hermes-invalid-cap-test-'));
    try {
      const configPath = await prepareHermesHome(directory, 4);
      expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual({ agent: { max_turns: 4 } });
      await expect(prepareHermesHome(invalidDirectory, 9)).rejects.toThrow('between 1 and 8');
    } finally {
      await rm(directory, { recursive: true, force: true });
      await rm(invalidDirectory, { recursive: true, force: true });
    }
  });

  it('mirrors the bounded invocation route into the isolated profile for Hermes startup readiness', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'efesto-hermes-route-test-'));
    try {
      const configPath = await prepareHermesHome(directory, 4, 'custom', 'qwen3.5:2b');
      expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual({
        agent: { max_turns: 4 },
        model: { default: 'qwen3.5:2b', provider: 'custom' },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('preserves explicit loopback custom-provider routing for isolated remote acceptance', () => {
    const env = buildHermesEnvironment({
      HERMES_INFERENCE_PROVIDER: 'custom',
      HERMES_INFERENCE_MODEL: 'qwen3:4b',
      CUSTOM_BASE_URL: 'http://127.0.0.1:11434/v1',
    }, '/tmp/efesto-hermes-local-provider');

    expect(env).toMatchObject({
      HERMES_HOME: '/tmp/efesto-hermes-local-provider',
      HERMES_INFERENCE_PROVIDER: 'custom',
      HERMES_INFERENCE_MODEL: 'qwen3:4b',
      CUSTOM_BASE_URL: 'http://127.0.0.1:11434/v1',
      HERMES_ALLOW_PRIVATE_URLS: 'false',
    });
  });

  it('keeps PATH commands portable and resolves configured relative paths before changing cwd', () => {
    expect(normalizeHermesExecutable('hermes')).toBe('hermes');
    expect(normalizeHermesExecutable('./runtime/hermes')).toMatch(/runtime[\\/]hermes$/);
  });

  it('terminates a timed-out child before returning control to cleanup', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'efesto-hermes-timeout-test-'));
    const fixture = join(directory, 'ignore-term.mjs');
    await writeFile(fixture, "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);\n", 'utf8');
    const startedAt = Date.now();
    try {
      await expect(runHermesProcess({
        executable: process.execPath,
        args: [fixture],
        timeoutMs: 25,
        env: process.env,
        cwd: directory,
      })).rejects.toThrow('timed out');
      expect(Date.now() - startedAt).toBeLessThan(2_000);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('surfaces bounded sanitized Hermes diagnostics on a non-zero exit', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'efesto-hermes-diagnostic-test-'));
    const fixture = join(directory, 'failed-hermes.mjs');
    await writeFile(fixture, "process.stderr.write('provider rejected model; api_key=sk-not-a-real-secret-123456789\\nsession_id: private-session'); process.exit(7);\n", 'utf8');
    try {
      await expect(runHermesProcess({
        executable: process.execPath,
        args: [fixture],
        timeoutMs: 2_000,
        env: process.env,
        cwd: directory,
      })).rejects.toThrow('Hermes exited with code 7: provider rejected model; api_key=<redacted-secret> session_id:<redacted-session>');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects an invocation turn cap outside the reviewed bound', () => {
    expect(() => buildHermesArgs('prompt', 0)).toThrow('between 1 and 8');
    expect(() => buildHermesArgs('prompt', 9)).toThrow('between 1 and 8');
    expect(() => buildHermesArgs('prompt', 4, 'custom', 'bad\nmodel')).toThrow('model is invalid');
  });

  it('accepts strict JSON and bounded candidates', () => {
    expect(parseHermesFindings('{"findings":[{"url":"https://example.com/a","title":"A","text":"Search snippet","summary":"Summary"}]}')).toEqual({
      findings: [{ url: 'https://example.com/a', title: 'A', text: 'Search snippet', summary: 'Summary' }],
    });
  });

  it('accepts one JSON code fence but strips it before parsing', () => {
    expect(parseHermesFindings('```json\n{"findings":[]}\n```')).toEqual({ findings: [] });
  });

  it('accepts Qwen whitespace before the JSON fence label', () => {
    expect(parseHermesFindings('``` json\n{"findings":[]}\n```')).toEqual({ findings: [] });
  });

  it('uses only the first fenced JSON payload and ignores trailing presentation text', () => {
    expect(parseHermesFindings('```json\n{"findings":[]}\n```\nHere are the requested sources.')).toEqual({ findings: [] });
  });

  it('turns URL-only discovery into neutral candidates pending Kernel verification', () => {
    expect(parseHermesFindings('{"findings":[{"url":"https://example.com/a"}]}')).toEqual({
      findings: [{
        url: 'https://example.com/a',
        title: 'Public source: example.com',
        text: 'Public source candidate pending Kernel verification.',
      }],
    });
  });

  it('repairs only literal string controls and trailing commas before schema validation', () => {
    expect(parseHermesFindings('```json\n{"findings":[{"url":"https://example.com/a","title":"A","text":"line one\nline two",}],}\n```')).toEqual({
      findings: [{ url: 'https://example.com/a', title: 'A', text: 'line one\nline two' }],
    });
  });

  it('repairs an invalid escape without weakening field validation', () => {
    expect(parseHermesFindings('{"findings":[{"url":"https://example.com/a","title":"A\\_B","text":"snippet"}]}')).toEqual({
      findings: [{ url: 'https://example.com/a', title: 'A\\_B', text: 'snippet' }],
    });
  });

  it('extracts only deduplicated literal web URLs when the final response is prose', () => {
    expect(parseHermesFindings('Sources:\n- [One](https://example.com/a).\n- https://second.example/path?q=1!\n- https://example.com/a')).toEqual({
      findings: [
        { url: 'https://example.com/a', title: 'Public source: example.com', text: 'Public source candidate pending Kernel verification.' },
        { url: 'https://second.example/path?q=1', title: 'Public source: second.example', text: 'Public source candidate pending Kernel verification.' },
      ],
    });
  });

  it('rejects non-web URL-only findings', () => {
    expect(() => parseHermesFindings('{"findings":[{"url":"file:///tmp/private"}]}')).toThrow('public http or https');
  });

  it('accepts one bounded Qwen thinking envelope before strict JSON', () => {
    expect(parseHermesFindings('<think>Plan two searches, then answer.</think>\n```json\n{"findings":[]}\n```')).toEqual({ findings: [] });
  });

  it('reports only output-shape metadata when JSON remains invalid', () => {
    expect(() => parseHermesFindings('<think>reason</think>\nnot-json')).toThrow('chars=30 think=true fence=false findings=false repair=false urls=0');
  });

  it('rejects authority or unsupported fields', () => {
    expect(() => parseHermesFindings('{"findings":[{"url":"https://example.com","title":"A","text":"B","admitted":true}]}')).toThrow('unsupported field');
  });

  it('rejects invalid schemas and oversized result batches', () => {
    expect(() => buildHermesPrompt({ schemaVersion: 'wrong', mission: {} })).toThrow('efesto.hermes-mission.v1');
    expect(() => parseHermesFindings(JSON.stringify({ findings: Array.from({ length: 21 }, () => ({})) }))).toThrow('at most 20');
    expect(() => parseHermesFindings(Array.from({ length: 21 }, (_, index) => `https://source${index}.example/path`).join('\n'))).toThrow('at most 20');
  });
});
