import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildHermesArgs,
  buildHermesEnvironment,
  buildHermesPrompt,
  normalizeHermesExecutable,
  parseHermesFindings,
  prepareHermesHome,
  runHermesProcess,
} from './hermes-efesto-adapter.mjs';

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
    expect(prompt).toContain('no more than two public search calls');
    expect(prompt).toContain('Return 3 to 5 relevant findings');
    expect(prompt.startsWith('/no_think\n')).toBe(true);
    expect(prompt).toContain('Keep every string on one line, escape it as JSON, and do not use trailing commas.');
  });

  it('isolates user customizations while keeping the official search backend available', () => {
    const prompt = 'Return JSON only';
    const args = buildHermesArgs(prompt);
    expect(args).toEqual(['--ignore-rules', '--toolsets', 'search', '-z', prompt]);
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
    await writeFile(fixture, "process.stderr.write('provider rejected model; api_key=sk-not-a-real-secret-123456789'); process.exit(7);\n", 'utf8');
    try {
      await expect(runHermesProcess({
        executable: process.execPath,
        args: [fixture],
        timeoutMs: 2_000,
        env: process.env,
        cwd: directory,
      })).rejects.toThrow('Hermes exited with code 7: provider rejected model; api_key=<redacted-secret>');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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

  it('accepts one bounded Qwen thinking envelope before strict JSON', () => {
    expect(parseHermesFindings('<think>Plan two searches, then answer.</think>\n```json\n{"findings":[]}\n```')).toEqual({ findings: [] });
  });

  it('reports only output-shape metadata when JSON remains invalid', () => {
    expect(() => parseHermesFindings('<think>reason</think>\nnot-json')).toThrow('chars=30 think=true fence=false findings=false');
  });

  it('rejects authority or unsupported fields', () => {
    expect(() => parseHermesFindings('{"findings":[{"url":"https://example.com","title":"A","text":"B","admitted":true}]}')).toThrow('unsupported field');
  });

  it('rejects invalid schemas and oversized result batches', () => {
    expect(() => buildHermesPrompt({ schemaVersion: 'wrong', mission: {} })).toThrow('efesto.hermes-mission.v1');
    expect(() => parseHermesFindings(JSON.stringify({ findings: Array.from({ length: 21 }, () => ({})) }))).toThrow('at most 20');
  });
});
