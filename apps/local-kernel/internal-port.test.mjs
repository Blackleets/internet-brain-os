import { describe, expect, it } from 'vitest';
import { selectInternalPort } from './internal-port.mjs';

describe('Efesto internal Kernel port selection', () => {
  it('uses the adjacent port when it is free', async () => {
    const checked = [];
    const selected = await selectInternalPort({
      externalPort: 4000,
      isPortAvailable: async (port) => { checked.push(port); return true; },
    });
    expect(selected).toBe(4001);
    expect(checked).toEqual([4001]);
  });

  it('skips an occupied adjacent port and selects the next free loopback port', async () => {
    const checked = [];
    const selected = await selectInternalPort({
      externalPort: 4000,
      isPortAvailable: async (port) => { checked.push(port); return port !== 4001; },
    });
    expect(selected).toBe(4002);
    expect(checked).toEqual([4001, 4002]);
  });

  it('honors an explicit free internal port', async () => {
    await expect(selectInternalPort({
      externalPort: 4000,
      requestedPort: '4100',
      isPortAvailable: async (port) => port === 4100,
    })).resolves.toBe(4100);
  });

  it('fails closed when an explicitly configured internal port is occupied', async () => {
    await expect(selectInternalPort({
      externalPort: 4000,
      requestedPort: '4100',
      isPortAvailable: async () => false,
    })).rejects.toThrow('HEPHAESTUS_INTERNAL_PORT 4100 is already in use');
  });

  it('rejects an internal port that aliases the external Kernel port', async () => {
    await expect(selectInternalPort({ externalPort: 4000, requestedPort: 4000 })).rejects.toThrow('Kernel ports must be distinct');
  });

  it('fails clearly when the bounded scan has no free candidate', async () => {
    await expect(selectInternalPort({
      externalPort: 4000,
      maxCandidates: 3,
      isPortAvailable: async () => false,
    })).rejects.toThrow('No free internal Kernel port was found after 3 candidates');
  });
});
