import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path) { return readFileSync(resolve(path), 'utf8'); }

describe('G4 automatic read-only cross-surface contract', () => {
  it('keeps Shared Goal Truth as the web and extension source of persisted Mission state', () => {
    const dashboard = source('apps/dashboard/components/efesto-product-shell.tsx');
    const extension = source('apps/extension/src/popup.js');
    const goalSnapshot = source('packages/kernel/src/goal/goal-surface-snapshot.ts');
    expect(dashboard).toContain('loadGoalSurfaces');
    expect(dashboard).toContain('brainPhaseFromWorkState');
    expect(extension).toContain('listGoalSurfaces');
    expect(extension).toContain("latest?.executionPhase === 'verifying' ? 'Efesto is verifying findings'");
    expect(goalSnapshot).toContain("mission.executionPhase === 'verifying'");
    expect(goalSnapshot).toContain("mission.executionPhase === 'forged'");
  });

  it('keeps exactly one explicit research authorization boundary before autonomous reads', () => {
    const popup = source('apps/extension/src/popup.js');
    const goalList = source('apps/extension/src/goal-surface-goal-list.js');
    const oneClick = source('apps/local-kernel/one-click-kernel.mjs');
    const verifier = source('apps/local-kernel/mission-search-candidate-verifier.mjs');
    expect(goalList).toContain('Authorize research');
    expect(popup).toContain('Authorize Hermes to research this Goal once?');
    expect((popup.match(/Authorize Hermes to research this Goal once\?/g) ?? [])).toHaveLength(1);
    expect(oneClick).not.toContain('confirm(');
    expect(oneClick).toContain('requestMissionCandidateVerification');
    expect(verifier).toContain("const READ_CAPABILITY = 'web.read'");
    expect(verifier).not.toContain('confirm(');
  });

  it('refreshes extension truth on observable Mission revision changes without fabricating work', () => {
    const popup = source('apps/extension/src/popup.js');
    const refresher = source('apps/extension/src/agent-hub-refresh.js');
    expect(popup).toContain('missionRevision(missions)');
    expect(popup).toContain('await loadGoals(stored)');
    expect(popup).toContain("if (latest?.status === 'completed') await loadOpportunities(stored)");
    expect(refresher).toContain("latest?.status === 'running' || latest?.executionPhase === 'verifying'");
    expect(refresher).toContain('latest.forgedAt');
  });

  it('projects an automatic policy block without pretending queued work is progressing', () => {
    const goalSnapshot = source('packages/kernel/src/goal/goal-surface-snapshot.ts');
    const extensionPresentation = source('apps/extension/src/goal-surface-presentation.js');
    const dashboard = source('apps/dashboard/components/efesto-product-shell.tsx');
    expect(goalSnapshot).toContain('automaticBlock');
    expect(goalSnapshot).toContain('blockedReason');
    expect(goalSnapshot).toContain("if (mission.blockedReason) return 'failed'");
    expect(extensionPresentation).toContain('Automatic research blocked');
    expect(extensionPresentation).toContain('runtime_read_only_unverified');
    expect(dashboard).toContain("if (workState === 'failed') return 'failed'");
  });

  it('does not grant side-effect or memory authority from cross-surface state', () => {
    const verifier = source('apps/local-kernel/mission-search-candidate-verifier.mjs');
    const claimGate = source('apps/local-kernel/automatic-mission-claim-gate.mjs');
    expect(claimGate).toContain("const AUTOMATIC_SEARCH_CAPABILITY = 'web.search'");
    expect(verifier).toContain("const READ_CAPABILITY = 'web.read'");
    expect(claimGate).not.toContain('purchase');
    expect(verifier).not.toContain('memoryManager');
  });
});
