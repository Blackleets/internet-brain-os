import { readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentMissionExecutor as LegacyAgentMissionExecutor } from './agent-mission-executor-legacy.mjs';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';

const unique = 'xyz-nonexist-token-9f3a';
const snippetFinding = {
  url: 'https://jwt.io/',
  title: `Search result ${unique}`,
  text: `UNTRUSTED SEARCH SNIPPET ${unique}`,
};

async function claimedFixture(Executor) {
  const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-ingest-fail-close-')), 'store.json'));
  const goal = await new GoalManager(store).create({
    title: `Locate record ${unique} in public filings`,
    categories: ['offer'],
    keywords: [unique],
  });
  const mission = await new AgentMissionManager(store, { isAgentReady: () => true }).create(goal.id, {
    agent: 'hermes',
    confirmed: true,
  }, {
    confirmationActor: { actorType: 'interactive_user', decidedBy: 'dashboard-ui' },
  });
  const executor = new Executor(store, new OpportunityProjector(store), { automaticClaims: false });
  const claim = await executor.claim('hermes', mission.id);
  return { store, mission, executor, claim };
}

describe('legacy ingest cannot mint Evidence from Hermes text', () => {
  it('keeps #ingestInto as a private throw instead of Evidence minting', () => {
    const source = readFileSync(resolve('apps/local-kernel/agent-mission-executor-legacy.mjs'), 'utf8');
    const method = source.match(/#ingestInto\([\s\S]*?\n  \}/)?.[0];
    expect(method).toBeTruthy();
    expect(method).toContain("throw new InboxError(");
    expect(method).toContain("'AGENT_FINDINGS_NOT_EVIDENCE'");
    expect(method).not.toContain('evidence:agent:');
    expect(method).not.toContain('case:agent:');
    expect(method).not.toContain('rawText: finding.text');
    expect(source).not.toContain('this.#ingestInto(');
  });

  it.each([
    ['live', AgentMissionExecutor],
    ['legacy', LegacyAgentMissionExecutor],
  ])('%s complete that used to ingest throws and does not forge or mint Evidence', async (_label, Executor) => {
    const { store, mission, executor, claim } = await claimedFixture(Executor);
    await expect(executor.complete(mission.id, {
      leaseId: claim.leaseId,
      findings: [snippetFinding],
    })).rejects.toMatchObject({ code: 'AGENT_FINDINGS_NOT_EVIDENCE' });
    const data = await store.read();
    expect(data.agentMissions[0]).toMatchObject({ status: 'running', executionPhase: 'investigating' });
    expect(data.agentMissions[0].status).not.toBe('completed');
    expect(data.agentMissions[0].executionPhase).not.toBe('forged');
    expect(data.evidence ?? []).toHaveLength(0);
    expect(data.cases ?? []).toHaveLength(0);
    expect(data.opportunities ?? []).toHaveLength(0);
  });
});
