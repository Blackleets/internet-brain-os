import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveEfestoBootstrapStatus } from './efesto-bootstrap-status.mjs';

const base = {
  port: 4000,
  kernelProbe: { reachable: true, ok: true, service: 'hephaestus-local-kernel', ageMs: 120 },
  hermesProbe: { found: true, valid: true, executable: 'C:/Tools/hermes.exe' },
  obsidianProbe: { configured: true, writable: true, vaultRelativePath: 'Efesto Vault' },
  pairingProbe: { tokenPresent: true, paired: true },
  processProbe: { pidFilePresent: true, pid: 1234, alive: true, owned: true, verified: true },
};

describe('Efesto bootstrap/status contract', () => {
  it('reports ready without exposing tokens when Kernel, Hermes, Obsidian, and pairing are usable', () => {
    const status = deriveEfestoBootstrapStatus(base);
    expect(status).toMatchObject({
      kernel: 'ready', hermes: 'ready', obsidian: 'ready', pairing: 'paired', overall: 'ready',
    });
    expect(status.message).toContain('ready');
    expect(status.actions.map((action) => action.id)).toContain('open_efesto');
    expect(JSON.stringify(status)).not.toContain('token');
    expect(JSON.stringify(status)).not.toContain('secret');
  });

  it('distinguishes first run/token pairing requirements from service failure', () => {
    const status = deriveEfestoBootstrapStatus({ ...base, pairingProbe: { tokenPresent: false, paired: false } });
    expect(status).toMatchObject({ pairing: 'required', overall: 'needs_setup' });
    expect(status.actions.map((action) => action.id)).toContain('repair');
  });

  it('detects missing Hermes as setup work instead of pretending readiness', () => {
    const status = deriveEfestoBootstrapStatus({ ...base, hermesProbe: { found: false, valid: false } });
    expect(status).toMatchObject({ hermes: 'missing', overall: 'needs_setup' });
    expect(status.actions.map((action) => action.id)).toContain('repair');
  });

  it('reports invalid Hermes separately from missing Hermes', () => {
    const status = deriveEfestoBootstrapStatus({ ...base, hermesProbe: { found: true, valid: false, error: 'bad json' } });
    expect(status).toMatchObject({ hermes: 'invalid', overall: 'needs_setup' });
    expect(status.diagnostics.hermes.reason).toBe('bad json');
  });

  it('reports unwritable Obsidian vault without changing the configured path', () => {
    const status = deriveEfestoBootstrapStatus({ ...base, obsidianProbe: { configured: true, writable: false, path: join('C:', 'Vault'), error: 'EACCES' } });
    expect(status).toMatchObject({ obsidian: 'unwritable', overall: 'needs_setup' });
    expect(status.actions.map((action) => action.id)).toContain('repair');
  });

  it('reports not_configured Obsidian as setup work', () => {
    const status = deriveEfestoBootstrapStatus({ ...base, obsidianProbe: { configured: false } });
    expect(status).toMatchObject({ obsidian: 'not_configured', overall: 'needs_setup' });
  });

  it('detects port 4000 occupied by a non-Efesto service as a failure', () => {
    const status = deriveEfestoBootstrapStatus({ ...base, kernelProbe: { reachable: true, ok: false, service: 'other-service' }, processProbe: { pidFilePresent: false } });
    expect(status).toMatchObject({ kernel: 'port_conflict', overall: 'failed' });
    expect(status.actions.map((action) => action.id)).toContain('repair');
  });

  it('detects stale owned Kernel process without killing unrelated processes', () => {
    const status = deriveEfestoBootstrapStatus({ ...base, kernelProbe: { reachable: false }, processProbe: { pidFilePresent: true, pid: 999, alive: true, owned: true } });
    expect(status).toMatchObject({ kernel: 'stale', overall: 'failed' });
    expect(status.diagnostics.kernel.pid).toBe(999);
  });

  it('supports failed repair diagnostics without exposing secret values', () => {
    const status = deriveEfestoBootstrapStatus({ ...base, repairProbe: { attempted: true, ok: false, reason: 'spawn failed: [REDACTED]' }, kernelProbe: { reachable: false }, processProbe: { pidFilePresent: false } });
    expect(status).toMatchObject({ kernel: 'offline', overall: 'failed' });
    expect(status.actions.map((action) => action.id)).toContain('repair');
    expect(JSON.stringify(status)).not.toMatch(/[A-Za-z0-9_-]{32,}/);
  });

  it('keeps daily use process-safe when double-started against an already ready Kernel', () => {
    const status = deriveEfestoBootstrapStatus({ ...base, doubleStart: true });
    expect(status).toMatchObject({ kernel: 'ready', overall: 'ready' });
    expect(status.actions.map((action) => action.id)).toContain('shutdown');
  });
});
