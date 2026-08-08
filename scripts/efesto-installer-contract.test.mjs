import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const installer = readFileSync(new URL('./install-efesto.ps1', import.meta.url), 'utf8');
const installCmd = readFileSync(new URL('../Install Efesto.cmd', import.meta.url), 'utf8');
const launcherCmd = readFileSync(new URL('../Efesto Launcher.cmd', import.meta.url), 'utf8');

describe('Efesto Windows one-click installer contract', () => {
  test('installs prerequisites automatically and pins pnpm', () => {
    expect(installer).toContain('OpenJS.NodeJS.LTS');
    expect(installer).toContain('winget install');
    expect(installer).toContain('pnpm@11.11.0');
    expect(installer).toContain("@('install', '--frozen-lockfile')");
  });

  test('builds the extension and starts the trusted launcher path', () => {
    expect(installer).toContain("@('build:extension')");
    expect(installer).toContain("@('efesto:launcher', 'repair')");
    expect(installer).not.toMatch(/kernel-api-token\s*=|API_SECRET\s*=|HEPHAESTUS_API_TOKEN\s*=/i);
  });

  test('offers a double-click entrypoint and self-healing daily launcher', () => {
    expect(installCmd).toContain('install-efesto.ps1');
    expect(launcherCmd).toContain('where node');
    expect(launcherCmd).toContain('where pnpm');
    expect(launcherCmd).toContain('INSTALL_OR_REPAIR');
    expect(launcherCmd).toContain('install-efesto.ps1');
  });

  test('creates only an owner-local desktop shortcut', () => {
    expect(installer).toContain("GetFolderPath('Desktop')");
    expect(installer).toContain("'Efesto.lnk'");
    expect(installer).not.toContain('Public\\Desktop');
  });
});
