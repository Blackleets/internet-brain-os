import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// `pnpm hermes:acceptance` (boundary mode) silently rotted after #238: its probes posted bare
// findings, which the Kernel now refuses outright, so 6/14 checks failed and nobody ran it.
// Run the real boundary suite here (isolated Kernel, free ports, temp report) so CI keeps it
// honest. This runs the unchanged pass criteria: every check must pass.
async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });
}

let reportDir;
afterAll(async () => { if (reportDir) await rm(reportDir, { recursive: true, force: true }); });

describe('Hermes boundary-authority acceptance (pnpm hermes:acceptance)', () => {
  it('passes every boundary check against an isolated Kernel', async () => {
    reportDir = await mkdtemp(join(tmpdir(), 'efesto-boundary-acceptance-'));
    process.env.HEPHAESTUS_ACCEPTANCE_PORT = String(await freePort());
    process.env.HEPHAESTUS_ACCEPTANCE_INTERNAL_PORT = String(await freePort());
    process.env.HEPHAESTUS_ACCEPTANCE_REPORT = join(reportDir, 'report.json');
    const { runAcceptance } = await import('./hermes-acceptance-runner.mjs');
    const report = await runAcceptance({ live: false });
    const failed = report.checks.filter((check) => !check.passed).map((check) => `${check.id}: ${check.detail}`);
    expect(report.blocked, 'blocked').toBeUndefined();
    expect(failed).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.id)).toEqual(expect.arrayContaining(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10']));
  }, 60_000);
});
