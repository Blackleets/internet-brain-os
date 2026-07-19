import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { run } from './hephaestus.mjs';

async function capture(argv, env) {
  let output = '';
  const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    output += String(chunk);
    return true;
  });
  try {
    await run(argv, env);
    return output;
  } finally {
    write.mockRestore();
  }
}

describe('Hephaestus CLI', () => {
  test('persists a Case, evidence, report, and Obsidian export across invocations', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hephaestus-cli-'));
    const env = { ...process.env, HEPHAESTUS_DATA_DIR: join(root, 'data') };

    const created = JSON.parse(await capture(['case', 'create', 'Find European suppliers'], env));
    expect(created.objective).toBe('Find European suppliers');

    await capture(['evidence', 'add', '--case', created.id, '--text', 'Supplier A offers an MOQ of 100 units.'], env);
    const listed = JSON.parse(await capture(['evidence', 'list', '--case', created.id], env));
    expect(listed).toHaveLength(1);

    const report = await capture(['report', 'generate', '--case', created.id], env);
    expect(report).toContain('Collected Evidence');
    expect(report).toContain(listed[0].id);

    const vault = join(root, 'vault');
    const exported = JSON.parse(await capture(['export', 'obsidian', '--case', created.id, '--out', vault], env));
    expect(exported.notes).toHaveLength(3);
    expect(await readFile(join(vault, exported.notes[0]), 'utf8')).toContain('Find European suppliers');
  });

  test('rejects missing and unknown Case IDs with deterministic errors', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hephaestus-cli-error-'));
    const env = { ...process.env, HEPHAESTUS_DATA_DIR: root };
    await expect(run(['case', 'show'], env)).rejects.toThrow('Missing required case ID');
    await expect(run(['case', 'show', 'case:missing'], env)).rejects.toThrow('Case not found: case:missing');
  });

  test.each(['http://127.0.0.1/private', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/'])('blocks SSRF target %s before fetch', async (url) => {
    const root = await mkdtemp(join(tmpdir(), 'hephaestus-cli-ssrf-'));
    const env = { ...process.env, HEPHAESTUS_DATA_DIR: root };
    const created = JSON.parse(await capture(['case', 'create', 'Security test'], env));
    await expect(run(['ingest', 'page', '--case', created.id, '--url', url], env))
      .rejects.toThrow('Private network URLs are not supported');
  });
});
