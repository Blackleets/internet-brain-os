import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { probeLauncherProcess } from './efesto-bootstrap.mjs';

async function pathsWithRecord(record) {
  const dir = await mkdtemp(join(tmpdir(), 'efesto-process-'));
  const pidFile = join(dir, 'efesto-launcher-process.json');
  await writeFile(pidFile, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return { pidFile };
}

const validRecord = {
  owner: 'efesto-launcher-v1',
  pid: 4321,
  startedAt: '2026-07-22T20:00:00.000Z',
  command: 'C:/repo/apps/local-kernel/one-click-kernel.mjs',
  commandFingerprint: 'apps/local-kernel/one-click-kernel.mjs',
  nonce: 'launch-nonce-123',
};

describe('Efesto launcher process identity probe', () => {
  it('verifies the original Efesto process by pid, marker, command fingerprint, and nonce', async () => {
    const paths = await pathsWithRecord(validRecord);
    await expect(probeLauncherProcess(paths, {
      isProcessAlive: async () => true,
      readProcessIdentity: async () => ({ commandLine: `node ${validRecord.command} --efesto-launcher-nonce ${validRecord.nonce}` }),
    })).resolves.toMatchObject({ pid: 4321, alive: true, owned: true, verified: true });
  });

  it('marks an absent PID as unverified stale state', async () => {
    const paths = await pathsWithRecord(validRecord);
    await expect(probeLauncherProcess(paths, { isProcessAlive: async () => false })).resolves.toMatchObject({
      pid: 4321,
      alive: false,
      owned: true,
      verified: false,
      reason: 'not_alive',
    });
  });

  it('detects PID reuse by a non-Efesto command line', async () => {
    const paths = await pathsWithRecord(validRecord);
    await expect(probeLauncherProcess(paths, {
      isProcessAlive: async () => true,
      readProcessIdentity: async () => ({ commandLine: 'node C:/other/server.mjs' }),
    })).resolves.toMatchObject({ alive: true, owned: true, verified: false, reason: 'fingerprint_mismatch' });
  });

  it('detects an altered owner marker before trusting the PID', async () => {
    const paths = await pathsWithRecord({ ...validRecord, owner: 'other-launcher' });
    await expect(probeLauncherProcess(paths, { isProcessAlive: async () => true })).resolves.toMatchObject({
      alive: true,
      owned: false,
      verified: false,
      reason: 'owner_mismatch',
    });
  });
});
