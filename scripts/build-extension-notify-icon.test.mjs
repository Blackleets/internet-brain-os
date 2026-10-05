import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const notifyPng = join(root, 'apps/extension/icons/efesto-notification.png');
const background = join(root, 'apps/extension/src/background.js');
const buildScript = join(root, 'scripts/build-extension.mjs');
const zipPath = join(root, 'efesto-extension.zip');

describe('packaged extension OS notify icon', () => {
  it('ships a PNG chrome.notifications icon and packages it into the zip', () => {
    expect(existsSync(notifyPng)).toBe(true);
    const backgroundSource = readFileSync(background, 'utf8');
    expect(backgroundSource).toContain("iconUrl: 'icons/efesto-notification.png'");
    expect(backgroundSource).not.toContain("iconUrl: 'icons/efesto-notification.svg'");
    const buildSource = readFileSync(buildScript, 'utf8');
    expect(buildSource).toContain('efesto-notification.png');
    expect(buildSource).toContain("join(extDir, 'icons')");

    const result = spawnSync(process.execPath, [buildScript], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(existsSync(join(root, 'apps/extension/dist/icons/efesto-notification.png'))).toBe(true);

    const listing = spawnSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
    expect(listing.status).toBe(0);
    expect(listing.stdout).toContain('icons/efesto-notification.png');
  });
});
