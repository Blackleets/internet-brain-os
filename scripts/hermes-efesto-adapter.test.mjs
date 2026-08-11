import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildHermesArgs,
  buildHermesEnvironment,
  buildHermesPrompt,
  normalizeHermesExecutable,
  parseHermesFindings,
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
  });

  it('isolates user customizations while keeping the official search backend available', () => {
    const prompt = 'Return JSON only';
    const args = buildHermesArgs(prompt);
    expect(args).toEqual(['--ignore-user-config', '--ignore-rules', '--toolsets', 'search', '-z', prompt]);
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
      HERMES_IGNORE_USER_CONFIG: '1',
      HERMES_IGNORE_RULES: '1',
      OPENROUTER_API_KEY: 'test-key',
    });
    expect(env).not.toHaveProperty('HERMES_SAFE_MODE');
    expect(env).not.toHaveProperty('HERMES_ENABLE_PROJECT_PLUGINS');
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

  it('accepts strict JSON and bounded candidates', () => {
    expect(parseHermesFindings('{"findings":[{"url":"https://example.com/a","title":"A","text":"Search snippet","summary":"Summary"}]}')).toEqual({
      findings: [{ url: 'https://example.com/a', title: 'A', text: 'Search snippet', summary: 'Summary' }],
    });
  });

  it('accepts one JSON code fence but strips it before parsing', () => {
    expect(parseHermesFindings('```json\n{"findings":[]}\n```')).toEqual({ findings: [] });
  });

  it('rejects authority or unsupported fields', () => {
    expect(() => parseHermesFindings('{"findings":[{"url":"https://example.com","title":"A","text":"B","admitted":true}]}')).toThrow('unsupported field');
  });

  it('rejects invalid schemas and oversized result batches', () => {
    expect(() => buildHermesPrompt({ schemaVersion: 'wrong', mission: {} })).toThrow('efesto.hermes-mission.v1');
    expect(() => parseHermesFindings(JSON.stringify({ findings: Array.from({ length: 21 }, () => ({})) }))).toThrow('at most 20');
  });
});
