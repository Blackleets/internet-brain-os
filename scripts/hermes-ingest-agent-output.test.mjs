import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const scriptPath = resolve('scripts/hermes-ingest-agent-output.mjs');

describe('Hermes ingestion sensitive-data boundary', () => {
  it('keeps sensitive preflight ahead of the Kernel build import', async () => {
    const source = await readFile(scriptPath, 'utf8');
    const preflightIndex = source.indexOf('scanHermesSensitiveData(source)');
    const kernelImportIndex = source.indexOf("await import('../packages/kernel/dist/index.js')");

    expect(preflightIndex).toBeGreaterThan(-1);
    expect(kernelImportIndex).toBeGreaterThan(-1);
    expect(preflightIndex).toBeLessThan(kernelImportIndex);
  });

  it('blocks a sensitive capture before build, signing, or transport', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hermes-ingest-preflight-'));
    const inputPath = join(directory, 'capture.json');
    const secret = 'sk-sensitive-value-that-must-not-leak';

    try {
      await writeFile(inputPath, JSON.stringify({
        runId: 'run-sensitive',
        api_key: secret,
      }));

      let failure;
      try {
        await execFileAsync(process.execPath, [scriptPath, inputPath], {
          env: {
            PATH: process.env.PATH,
            IBOS_HERMES_SECRET: 'local-signing-secret',
            IBOS_HERMES_INGEST_URL: 'http://127.0.0.1:1/hermes/ingestions',
          },
        });
      } catch (error) {
        failure = error;
      }

      expect(failure).toBeDefined();
      expect(failure.code).toBe(2);
      expect(failure.stderr).toContain('Hermes ingestion blocked by sensitive-data preflight.');
      expect(failure.stderr).toContain('SENSITIVE_JSON_FIELD at line 1');
      expect(failure.stderr).toContain('No request was signed or sent.');
      expect(failure.stderr).not.toContain(secret);
      expect(failure.stderr).not.toContain('Kernel build is required');
      expect(failure.stderr).not.toContain('fetch failed');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
