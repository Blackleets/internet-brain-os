import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GitHubEvidenceProjector } from './github-evidence-projector.mjs';

const goalId = 'goal:github-audit';
const receipt = {
  schemaVersion: 'efesto.github-read-receipt.v1',
  id: 'github-read:repository-1',
  authorizationId: 'github-auth:1',
  goalId,
  capability: 'github.repository.read',
  scope: 'github.read',
  operation: 'repository',
  resource: { owner: 'Blackleets', repo: 'internet-brain-os', limit: 20 },
  provider: 'github-api',
  fetchedAt: '2026-08-14T12:00:00.000Z',
  sourceUrl: 'https://github.com/Blackleets/internet-brain-os',
  contentHash: 'content-hash-1',
};

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'efesto-github-evidence-'));
  const store = new LocalKnowledgeStore(join(dir, 'store.json'));
  await store.write({ goals: [{ id: goalId, title: 'Audit repository', status: 'active' }] });
  return { store, projector: new GitHubEvidenceProjector(store) };
}

describe('GitHub Evidence projector', () => {
  it('projects a verified receipt into one Case and one Evidence record', async () => {
    const { store, projector } = await fixture();
    const result = await projector.project({ goalId, receipt, result: { fullName: 'Blackleets/internet-brain-os', private: false } });

    expect(result).toMatchObject({
      schemaVersion: 'efesto.github-evidence.v1',
      goalId,
      receiptId: receipt.id,
      sourceUrl: receipt.sourceUrl,
      duplicate: false,
    });
    const persisted = await store.read();
    expect(persisted.cases).toHaveLength(1);
    expect(persisted.evidence).toHaveLength(1);
    expect(persisted.evidence[0]).toMatchObject({
      id: result.evidenceId,
      caseId: result.caseId,
      sourceReceiptId: receipt.id,
      contentHash: receipt.contentHash,
      extractionMethod: 'github-readonly-v1',
      integration: 'github',
      goalId,
      operation: 'repository',
    });
    expect(persisted.evidence[0].rawText).toContain('Blackleets/internet-brain-os');
  });

  it('is safe to retry and rejects receipts outside the authorized Goal', async () => {
    const { store, projector } = await fixture();
    const input = { goalId, receipt, result: { fullName: 'Blackleets/internet-brain-os' } };
    const first = await projector.project(input);
    const replay = await projector.project(input);

    expect(replay).toMatchObject({ caseId: first.caseId, evidenceId: first.evidenceId, duplicate: true });
    expect((await store.read()).evidence).toHaveLength(1);

    await expect(projector.project({ goalId: 'goal:other', receipt, result: {} }))
      .rejects.toMatchObject({ code: 'GITHUB_GOAL_MISMATCH', status: 403 });
  });
});
