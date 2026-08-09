import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentMissionManager } from './agent-missions.mjs';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';

describe('Agent Mission readiness reconciliation', () => {
  it('promotes waiting_for_agent to queued when the adapter becomes ready without changing authorization', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-ready-reconcile-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find public jobs', categories: ['job'] });
    const waitingManager = new AgentMissionManager(store, { isAgentReady: () => false });
    const mission = await waitingManager.create(goal.id, { agent: 'hermes', confirmed: true }, {
      confirmationActor: { actorType: 'interactive_user', decidedBy: 'dashboard-ui' },
    });
    expect(mission.status).toBe('waiting_for_agent');
    const authorization = mission.authorization;

    const readyManager = new AgentMissionManager(store, { isAgentReady: () => true });
    const [recovered] = await readyManager.list();
    expect(recovered).toMatchObject({
      id: mission.id,
      status: 'queued',
      executionPhase: 'queued',
      limitation: 'Agent became ready; recovered and queued for authorized execution',
    });
    expect(recovered.authorization).toEqual(authorization);
  });
});
