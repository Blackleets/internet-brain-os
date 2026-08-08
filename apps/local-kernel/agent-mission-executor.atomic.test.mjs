import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';

async function fixture(prefix) {
  const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), prefix)), 'store.json'));
  const goal = await new GoalManager(store).create({ title: 'Find remote AI work', categories: ['job'] });
  const mission = await new AgentMissionManager(store, { isAgentReady: () => true }).create(goal.id, {
    agent: 'hermes',
    confirmed: true,
  });
  return { store, mission };
}

describe('Agent Hub atomic completion', () => {
  it('Given a completed result, When the exact completion is retried, Then persisted state is unchanged', async () => {
    const { store, mission } = await fixture('efesto-executor-idempotent-');
    const executor = new AgentMissionExecutor(store, new OpportunityProjector(store));
    const claim = await executor.claim();
    const input = {
      leaseId: claim.leaseId,
      findings: [{
        url: 'https://jobs.example/idempotent',
        title: 'Remote role',
        text: 'We are hiring for a full-time remote role with salary. Apply now.',
      }],
    };

    const first = await executor.complete(mission.id, input);
    const beforeReplay = await store.read();
    const replay = await executor.complete(mission.id, input);

    expect(first.mission.resultSummary).toMatchObject({ received: 1, evidenceCreated: 1 });
    expect(replay).toMatchObject({ idempotent: true, mission: { id: mission.id, status: 'completed' }, findings: [] });
    expect(await store.read()).toEqual(beforeReplay);
  });

  it('Given a later projection failure, When completion aborts, Then no partial Evidence or Opportunity is persisted', async () => {
    const { store, mission } = await fixture('efesto-executor-atomic-');
    const baseProjector = new OpportunityProjector(store);
    const failingProjector = {
      projectInto(data, input, references) {
        if (input.url.includes('/second')) throw new Error('simulated opportunity projection failure');
        return baseProjector.projectInto(data, input, references);
      },
    };
    const executor = new AgentMissionExecutor(store, failingProjector);
    const claim = await executor.claim();

    await expect(executor.complete(mission.id, {
      leaseId: claim.leaseId,
      findings: [
        { url: 'https://jobs.example/first', title: 'First role', text: 'We are hiring for a remote role.' },
        { url: 'https://jobs.example/second', title: 'Second role', text: 'We are hiring for another remote role.' },
      ],
    })).rejects.toThrow('simulated opportunity projection failure');

    const data = await store.read();
    expect(data.agentMissions[0]).toMatchObject({ status: 'running', executionPhase: 'investigating' });
    expect(data.cases).toHaveLength(0);
    expect(data.evidence).toHaveLength(0);
    expect(data.opportunities).toHaveLength(0);
  });

  it('Given competing completion calls for one lease, When they race, Then only one result creates side effects', async () => {
    const { store, mission } = await fixture('efesto-executor-race-');
    const executor = new AgentMissionExecutor(store, new OpportunityProjector(store));
    const claim = await executor.claim();

    const results = await Promise.all([
      executor.complete(mission.id, {
        leaseId: claim.leaseId,
        findings: [{ url: 'https://jobs.example/race-first', title: 'First role', text: 'We are hiring for a remote role.' }],
      }),
      executor.complete(mission.id, {
        leaseId: claim.leaseId,
        findings: [{ url: 'https://jobs.example/race-second', title: 'Second role', text: 'We are hiring for another remote role.' }],
      }),
    ]);

    expect(results.some((result) => result.findings.length === 1)).toBe(true);
    expect(results.some((result) => result.findings.length === 0)).toBe(true);
    const data = await store.read();
    expect(data.evidence).toHaveLength(1);
    expect(data.agentMissions[0]?.status).toBe('completed');
  });
});
