import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { probeLauncherProcess, readWindowsProcessIdentity } from './efesto-bootstrap.mjs';

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

  it('verifies the same owned process when Windows reports backslash paths', async () => {
    const paths = await pathsWithRecord(validRecord);
    await expect(probeLauncherProcess(paths, {
      isProcessAlive: async () => true,
      readProcessIdentity: async () => ({ commandLine: `node C:\\repo\\apps\\local-kernel\\one-click-kernel.mjs --efesto-launcher-nonce ${validRecord.nonce}` }),
    })).resolves.toMatchObject({ pid: 4321, alive: true, owned: true, verified: true });
  });

  it('uses modern PowerShell CIM process inspection on Windows', async () => {
    const calls = [];
    const result = await readWindowsProcessIdentity(4321, {
      runProcessCommand: async (command, args) => {
        calls.push([command, args]);
        return { code: 0, stdout: `node C:\\repo\\apps\\local-kernel\\one-click-kernel.mjs --efesto-launcher-nonce ${validRecord.nonce}` };
      },
    });
    expect(result?.commandLine).toContain(validRecord.nonce);
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('powershell.exe');
    expect(calls[0][1]).toContain('Get-CimInstance Win32_Process -Filter \'ProcessId = 4321\' -ErrorAction SilentlyContinue; if ($null -ne $p -and $null -ne $p.CommandLine) { [Console]::Out.Write($p.CommandLine) }'.replace('Get-CimInstance', '$p = Get-CimInstance'));
  });

  it('falls back to WMIC only when CIM cannot return a command line', async () => {
    const calls = [];
    const result = await readWindowsProcessIdentity(4321, {
      runProcessCommand: async (command) => {
        calls.push(command);
        return command === 'powershell.exe'
          ? { code: 0, stdout: '' }
          : { code: 0, stdout: `CommandLine=node C:\\repo\\apps\\local-kernel\\one-click-kernel.mjs --efesto-launcher-nonce ${validRecord.nonce}` };
      },
    });
    expect(result?.commandLine).toContain(validRecord.nonce);
    expect(calls).toEqual(['powershell.exe', 'wmic.exe']);
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
