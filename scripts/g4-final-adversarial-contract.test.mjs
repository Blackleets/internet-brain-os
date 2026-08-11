import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(resolve(path), 'utf8');

describe('G4 final automatic read-only adversarial contract', () => {
  it('requires trusted user receipt plus real registered R0 capabilities before any automatic lease', () => {
    const policy = read('packages/kernel/src/goal/automatic-read-only-continuation.ts');
    const receipt = read('apps/local-kernel/goal-execution-authorization.mjs');
    const claimGate = read('apps/local-kernel/automatic-mission-claim-gate.mjs');
    const executor = read('apps/local-kernel/agent-mission-executor-legacy.mjs');
    expect(policy).toContain('read_only_continuation');
    expect(policy).toContain('r0_observe');
    expect(policy).toContain('interactive_user');
    expect(receipt).toContain('efesto.goal-execution-authorization.v1');
    expect(claimGate).toContain("const AUTOMATIC_SEARCH_CAPABILITY = 'web.search'");
    expect(claimGate).toContain('HEPHAESTUS_HERMES_READ_ONLY_READY');
    expect(executor).toContain('leaseId');
  });

  it('keeps authentic Hermes technically search-only and treats output as candidates', () => {
    const adapter = read('scripts/hermes-efesto-adapter.mjs');
    const worker = read('apps/local-kernel/hermes-mission-worker.mjs');
    const executor = read('apps/local-kernel/agent-mission-executor.mjs');
    expect(adapter).toContain("['--ignore-rules', '--toolsets', 'search', ...(usageFile ? ['--usage-file', resolve(usageFile)] : []), '-z', prompt]");
    expect(adapter).toContain("for (const key of ['api_calls', 'output_tokens', 'total_tokens'])");
    expect(adapter).toContain("const MAX_AGENT_TURNS = 8");
    expect(adapter).toContain("flag: 'wx'");
    expect(adapter).toContain('HERMES_HOME: hermesHome');
    expect(adapter).toContain("delete env.HERMES_ENABLE_PROJECT_PLUGINS");
    expect(adapter).toContain("HERMES_ALLOW_PRIVATE_URLS: 'false'");
    expect(adapter).toContain('cwd: hermesHome');
    expect(worker).toContain("resultKind: 'search_candidates'");
    expect(executor).toContain("status: 'pending_verification'");
    expect(executor).toContain('evidenceCreated: 0');
  });

  it('allows only Kernel web.read fetched content to become automatic Evidence', () => {
    const verifier = read('apps/local-kernel/mission-search-candidate-verifier.mjs');
    const fetcher = read('packages/connectors/src/web-page.ts');
    expect(verifier).toContain("const READ_CAPABILITY = 'web.read'");
    expect(verifier).toContain('PublicWebReadExecutionAdapter');
    expect(verifier).toContain("extractionMethod: 'kernel-web-read-v1'");
    expect(verifier).toContain('requireSameCandidateBatch');
    expect(fetcher).toContain('isPublicAddress');
    expect(fetcher).toContain("redirect: 'manual'");
    expect(fetcher).toContain('Too many redirects');
    expect(fetcher).toContain('Private network URLs are not supported');
  });

  it('reconciles restart state through the same authenticated gates instead of inventing progress', () => {
    const recovery = read('apps/local-kernel/automatic-mission-recovery.mjs');
    const oneClick = read('apps/local-kernel/one-click-kernel.mjs');
    expect(recovery).toContain('/api/agent-missions');
    expect(recovery).toContain("executionPhase === 'verifying'");
    expect(recovery).toContain("mission.status === 'queued'");
    expect(oneClick).toContain('loadExistingApiToken');
    expect(oneClick).toContain('recoverAutomaticMissions');
    expect(oneClick).not.toContain('console.log(recoveryToken');
  });

  it('keeps UI truth read-only and side effects outside G4 automatic authority', () => {
    const shared = read('packages/kernel/src/goal/goal-surface-snapshot.ts');
    const dashboard = read('apps/dashboard/components/efesto-product-shell.tsx');
    const extension = read('apps/extension/src/popup.js');
    const goalList = read('apps/extension/src/goal-surface-goal-list.js');
    expect(shared).toContain("sourceOfTruth: 'kernel'");
    expect(shared).toContain("mission.executionPhase === 'verifying'");
    expect(dashboard).toContain('loadGoalSurfaces');
    expect(extension).toContain('listGoalSurfaces');
    expect(goalList).toContain('Authorize research');
    expect(extension).toContain('Authorize Hermes to research this Goal once?');
  });
});
