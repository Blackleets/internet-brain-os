import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), 'utf8');
}

describe('internal Efesto release package', () => {
  it('is explicitly internal and blocks public promotion by default', async () => {
    const release = JSON.parse(await text('INTERNAL_RELEASE.json'));
    expect(release.schema).toBe('efesto.internal-release.v1');
    expect(release.version).toBe('0.1.0-internal.37');
    expect(release.channel).toBe('internal');
    expect(release.publicLaunchApproved).toBe(false);
    expect(release.entrypoint).toBe('Install Efesto.cmd');
  });

  it('packages the exact Git commit without local runtime state or secrets', async () => {
    const workflow = await text('.github/workflows/internal-test-package.yml');
    expect(workflow).toContain('git archive --format=zip');
    expect(workflow).toContain('pnpm install --frozen-lockfile');
    expect(workflow).toContain('pnpm audit --prod');
    expect(workflow).toContain('pnpm release:verify');
    expect(workflow).toContain('sha256sum');
    expect(workflow).toContain("(node_modules|\\.git|\\.hephaestus|\\.hermes)/");
    expect(workflow).toContain('retention-days: 14');
    expect(workflow).toContain('INTERNAL_RELEASE.json');
    expect(workflow).toContain('process.stdout.write(release.version)');
    expect(workflow).toContain('version=${RELEASE_VERSION}');
    expect(workflow).not.toContain('version=0.1.0-internal.1');
    expect(workflow).not.toMatch(/permissions:\s*[\s\S]*contents:\s*write/);
  });

  it('qualifies the exact packaged candidate on two supported Windows generations', async () => {
    const workflow = await text('.github/workflows/internal-test-package.yml');
    const harness = await text('scripts/qualify-packaged-windows-install.ps1');
    expect(workflow).toContain('qualify-packaged-windows-install:');
    expect(workflow).toContain('os: [windows-2022, windows-2025]');
    expect(workflow).toContain('actions/download-artifact@v4');
    expect(workflow).toContain('qualify-packaged-windows-install.ps1');
    expect(harness).toContain('Get-FileHash -Algorithm SHA256');
    expect(harness).toContain('Efesto Candidate With Spaces');
    expect(harness).toContain('Efesto Data With Spaces');
    expect(harness).toContain('publicLaunchApproved');
    expect(harness).toContain("'Install Efesto.cmd'");
    expect(harness).toContain('Invoke-FreshInstall');
    expect(harness).toContain("-StdoutTarget 'NUL' -StderrTarget 'NUL'");
    expect(harness).toContain("$freshBootstrap.pairing -ne 'required'");
    expect(harness).toContain('authorized-extensions.json');
    expect(harness).toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(harness).toContain('Invoke-CapturedRepair');
    expect(harness).toContain("$afterRepair.pairing -ne 'paired'");
    expect(harness).toContain('apps\\extension\\dist\\manifest.json');
    expect(harness).toContain('Efesto.lnk');
    expect(harness).toContain('tokenDigestAfter');
    expect(harness).toContain('owned');
    expect(harness).toContain('verified');
    expect(harness).toContain('System.Diagnostics.ProcessStartInfo');
    expect(harness).toContain('$process.WaitForExit($TimeoutMs)');
    expect(harness).toContain('node scripts\\efesto-launcher.mjs shutdown >NUL 2>NUL');
    expect(harness).not.toContain('pnpm efesto:launcher shutdown');
    expect(harness).not.toContain('RedirectStandardOutput = $true');
    expect(harness).not.toContain('ReadToEndAsync()');
    expect(harness).not.toContain('Start-Process');
    expect(harness).toContain('captured repair output');
  });

  it('requires one immutable candidate plus corrected clean-install, real-web, replay and failure UAT before launch', async () => {
    const release = JSON.parse(await text('INTERNAL_RELEASE.json'));
    const uat = await text('docs/internal-uat-v0.1.0.md');
    expect(uat).toContain(`Candidate: \`${release.version}\``);
    expect(uat).toContain(`efesto-v${release.version}-windows.zip`);
    expect(uat).not.toContain('Candidate: `0.1.0-internal.4`');
    expect(uat).toContain('builds the internal Shared runtime and trusted Kernel runtime');
    expect(uat).toContain('`alive: true`, `owned: true` and `verified: true`');
    expect(uat).toContain('Goal-first Control Center');
    expect(uat).toContain('pixel-smith/brain visual identity');
    expect(uat).toContain('work/data-flow motion appears only for observable active states');
    expect(uat).toContain('reduced-motion mode');
    expect(uat).toContain('UAT-1 — clean Windows install');
    expect(uat).toContain('UAT-3 — real public-web economic Goal');
    expect(uat).toContain('UAT-4 — persistence and replay');
    expect(uat).toContain('UAT-6 — failure handling');
    expect(uat).toContain('Memory Safety v1');
    expect(uat).toContain('Goal-first cross-surface G0');
    expect(uat).toContain('Shared Goal Truth v1');
    expect(uat).toContain('same immutable internal candidate');
    expect(uat).toContain('must never be reused');
    expect(uat).toContain('Public launch remains blocked');
  });
});
