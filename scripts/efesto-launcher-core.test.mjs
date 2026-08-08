import { describe, expect, it } from 'vitest';
import { buildKernelChildEnv, repairEfestoLauncher, shutdownEfestoLauncher } from './efesto-launcher-core.mjs';

function harness(overrides = {}) {
  const calls = [];
  let inspectCount = 0;
  const ops = {
    inspect: async () => {
      inspectCount += 1;
      if (typeof overrides.inspect === 'function') return overrides.inspect(inspectCount);
      return overrides.status;
    },
    ensureDirectories: async () => calls.push(['ensureDirectories']),
    writeLog: async (message) => calls.push(['log', message]),
    removeStalePidFile: async () => calls.push(['removeStalePidFile']),
    startKernel: async (options) => { calls.push(['startKernel', options]); return { pid: 4242 }; },
    stopOwnedProcess: async (pid) => calls.push(['stopOwnedProcess', pid]),
    waitForStopped: async () => { calls.push(['waitForStopped']); return overrides.afterStopStatus ?? overrides.status; },
    openEfesto: async () => calls.push(['openEfesto']),
    waitForReady: async () => overrides.afterStartStatus ?? overrides.status,
  };
  return { calls, ops };
}

const ready = {
  kernel: 'ready', hermes: 'ready', obsidian: 'ready', pairing: 'paired', overall: 'ready',
  diagnostics: { kernel: { pid: 111, owned: true, verified: true } }, actions: [], message: 'ready',
};

const pairingRequired = {
  kernel: 'ready', hermes: 'ready', obsidian: 'ready', pairing: 'required', overall: 'needs_setup',
  diagnostics: { kernel: { pid: 111, owned: true, verified: true } }, actions: [], message: 'pair extension',
};

describe('Efesto Windows launcher core', () => {
  it('repairs first run by creating local dirs and starting the one-click Kernel with visible pairing output', async () => {
    const { calls, ops } = harness({
      status: { kernel: 'offline', hermes: 'ready', obsidian: 'ready', pairing: 'required', overall: 'needs_setup', diagnostics: { kernel: {} } },
      afterStartStatus: pairingRequired,
    });
    const result = await repairEfestoLauncher({ ops });
    expect(result.status).toMatchObject({ kernel: 'ready', pairing: 'required' });
    expect(calls).toContainEqual(['startKernel', { showPairing: true }]);
  });

  it('does not duplicate processes when the Kernel is already paired and ready', async () => {
    const { calls, ops } = harness({ status: ready });
    const result = await repairEfestoLauncher({ ops });
    expect(result.started).toBe(false);
    expect(calls.map((call) => call[0])).not.toContain('startKernel');
  });

  it('safely restarts an owned verified Kernel when pairing is still required', async () => {
    const offlineAfterStop = { ...pairingRequired, kernel: 'offline', diagnostics: { kernel: { pidFilePresent: false } } };
    const { calls, ops } = harness({
      inspect: (count) => count === 1 ? pairingRequired : offlineAfterStop,
      afterStopStatus: offlineAfterStop,
      afterStartStatus: pairingRequired,
    });
    const result = await repairEfestoLauncher({ ops });
    expect(result.started).toBe(true);
    expect(calls).toContainEqual(['stopOwnedProcess', 111]);
    expect(calls).toContainEqual(['waitForStopped']);
    expect(calls).toContainEqual(['startKernel', { showPairing: true }]);
  });

  it('refuses pairing recovery when the existing process cannot be verified', async () => {
    const unsafe = { ...pairingRequired, diagnostics: { kernel: { pid: 111, owned: true, verified: false, reason: 'fingerprint_mismatch' } } };
    const { calls, ops } = harness({ status: unsafe });
    const result = await repairEfestoLauncher({ ops });
    expect(result.started).toBe(false);
    expect(calls.map((call) => call[0])).not.toContain('stopOwnedProcess');
    expect(calls.map((call) => call[0])).not.toContain('startKernel');
  });

  it('does not start over a non-Efesto port conflict', async () => {
    const { calls, ops } = harness({ status: { ...ready, kernel: 'port_conflict', overall: 'failed' } });
    const result = await repairEfestoLauncher({ ops });
    expect(result.status).toMatchObject({ kernel: 'port_conflict', overall: 'failed' });
    expect(calls.map((call) => call[0])).not.toContain('startKernel');
  });

  it('cleans stale owned launcher state before restart', async () => {
    const { calls, ops } = harness({
      status: { ...ready, kernel: 'stale', overall: 'failed', diagnostics: { kernel: { pid: 999, owned: false } } },
      afterStartStatus: ready,
    });
    await repairEfestoLauncher({ ops });
    expect(calls.map((call) => call[0])).toEqual(['ensureDirectories', 'removeStalePidFile', 'startKernel', 'log']);
  });

  it('stops only an owned Kernel process on safe shutdown', async () => {
    const { calls, ops } = harness({ status: ready });
    await shutdownEfestoLauncher({ ops });
    expect(calls).toContainEqual(['stopOwnedProcess', 111]);
  });

  it('passes the configured Obsidian vault to the child Kernel process environment', () => {
    expect(buildKernelChildEnv({}, { obsidianDir: 'C:/Vault' })).toMatchObject({
      HEPHAESTUS_OBSIDIAN_DIR: 'C:/Vault',
      HEPHAESTUS_PAIRING: '1',
    });
  });

  it('does not override an explicitly provided Obsidian env path', () => {
    expect(buildKernelChildEnv({ HEPHAESTUS_OBSIDIAN_DIR: 'D:/Already' }, { obsidianDir: 'C:/Vault' })).toMatchObject({
      HEPHAESTUS_OBSIDIAN_DIR: 'D:/Already',
    });
  });

  it('refuses to stop an unowned process on port 4000', async () => {
    const { calls, ops } = harness({ status: { ...ready, diagnostics: { kernel: { pid: 222, owned: false } } } });
    const result = await shutdownEfestoLauncher({ ops });
    expect(result.stopped).toBe(false);
    expect(calls.map((call) => call[0])).not.toContain('stopOwnedProcess');
  });

  it('refuses shutdown when the PID no longer exists', async () => {
    const { calls, ops } = harness({ status: { ...ready, diagnostics: { kernel: { pid: 333, owned: true, verified: false, reason: 'not_alive' } } } });
    const result = await shutdownEfestoLauncher({ ops });
    expect(result.stopped).toBe(false);
    expect(calls.map((call) => call[0])).not.toContain('stopOwnedProcess');
  });

  it('refuses shutdown when a PID was reused by another process', async () => {
    const { calls, ops } = harness({ status: { ...ready, diagnostics: { kernel: { pid: 444, owned: true, verified: false, reason: 'fingerprint_mismatch' } } } });
    const result = await shutdownEfestoLauncher({ ops });
    expect(result.stopped).toBe(false);
    expect(calls.map((call) => call[0])).not.toContain('stopOwnedProcess');
  });

  it('refuses shutdown when the owner marker was altered', async () => {
    const { calls, ops } = harness({ status: { ...ready, diagnostics: { kernel: { pid: 555, owned: false, verified: false, reason: 'owner_mismatch' } } } });
    const result = await shutdownEfestoLauncher({ ops });
    expect(result.stopped).toBe(false);
    expect(calls.map((call) => call[0])).not.toContain('stopOwnedProcess');
  });
});
