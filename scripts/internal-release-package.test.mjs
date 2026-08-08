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
    expect(release.version).toBe('0.1.0-internal.2');
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

  it('requires clean install, real-web Goal, replay and failure UAT before public launch', async () => {
    const uat = await text('docs/internal-uat-v0.1.0.md');
    expect(uat).toContain('UAT-1 — clean Windows install');
    expect(uat).toContain('UAT-3 — real public-web economic Goal');
    expect(uat).toContain('UAT-4 — persistence and replay');
    expect(uat).toContain('UAT-6 — failure handling');
    expect(uat).toContain('Public launch remains blocked');
  });
});
