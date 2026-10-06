import { describe, expect, it, vi } from 'vitest';
import { startEfestoAutomatically } from './efesto-launcher-core.mjs';
function fixture(status) {
  return { inspect: vi.fn(async () => status), ensureDirectories: vi.fn(), removeStalePidFile: vi.fn(), startKernel: vi.fn(async () => ({ pid: 123 })), waitForReady: vi.fn(async () => ({ kernel: 'ready' })), writeLog: vi.fn(), stopOwnedProcess: vi.fn() };
}
describe('noninteractive login startup', () => {
  it.each(['ready', 'port_conflict', 'failed'])('does not replace a %s Kernel even if unpaired', async (kernel) => {
    const ops = fixture({ kernel, pairing: 'required' });
    expect((await startEfestoAutomatically({ ops })).started).toBe(false);
    expect(ops.startKernel).not.toHaveBeenCalled(); expect(ops.stopOwnedProcess).not.toHaveBeenCalled();
  });
  it('starts offline without displaying or resetting pairing', async () => {
    const ops = fixture({ kernel: 'offline', pairing: 'required' });
    expect((await startEfestoAutomatically({ ops })).status.kernel).toBe('ready');
    expect(ops.startKernel).toHaveBeenCalledWith({ showPairing: false }); expect(ops.stopOwnedProcess).not.toHaveBeenCalled();
  });
  it('cleans only a stale launcher record using the existing ownership probe', async () => {
    const ops = fixture({ kernel: 'stale', diagnostics: { kernel: { pid: 123 } } });
    await startEfestoAutomatically({ ops });
    expect(ops.removeStalePidFile).toHaveBeenCalledWith(123);
  });
});
