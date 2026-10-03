import { afterAll as after, beforeAll as before, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createLocalKernelServer } from './server.mjs';
import { KernelEventBus } from './kernel-event-bus.mjs';

// The Kernel only published mission.created, so /api/events could not tell a client that a
// Hermes worker claimed, completed or failed a mission. These are the worker's HTTP transitions.
const apiToken = 'test-token-for-mission-events-0123456789abcdef';

function fakeExecutor() {
  let data = { agentMissions: [{ id: 'mission:1', goalId: 'goal:1', status: 'running', executionPhase: 'forged' }] };
  return {
    store: { async project(fn) { const out = await fn(data); data = out.data; return out.result; } },
    async claim() { return { id: 'mission:1', goalId: 'goal:1', status: 'running', executionPhase: 'investigating', leaseId: 'secret-lease' }; },
    async complete(missionId, input) {
      if (input.replay) return { idempotent: true, mission: { id: missionId, status: 'completed' }, findings: [] };
      return { mission: { id: missionId, status: 'completed' }, findings: [{ caseId: undefined, text: 'agent text' }] };
    },
    async fail(missionId) { return { id: missionId, goalId: 'goal:1', status: 'failed', executionPhase: 'failed', lastFailure: { reason: 'private detail' } }; },
  };
}

describe('mission lifecycle events', () => {
  let server; let baseUrl; const frames = []; const kernelEvents = new KernelEventBus();
  before(async () => {
    kernelEvents.subscribe((frame) => frames.push(frame));
    server = createLocalKernelServer(undefined, undefined, undefined, undefined, { apiToken, agentMissionExecutor: fakeExecutor(), kernelEvents });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => { if (server?.listening) await new Promise((resolve) => server.close(resolve)); });

  const post = (path, body) => fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'x-hephaestus-token': apiToken, 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  const parse = (frame) => ({ type: /^event: (.+)$/m.exec(frame)[1], data: JSON.parse(/^data: (.+)$/m.exec(frame)[1]) });

  it('publishes mission.updated on claim, result and failure with ids and status only', async () => {
    frames.length = 0;
    assert.equal((await post('/api/agent-missions/claim')).status, 200);
    assert.equal((await post('/api/agent-missions/mission%3A1/results', { findings: [] })).status, 202);
    assert.equal((await post('/api/agent-missions/mission%3A1/failures', { reason: 'x' })).status, 202);
    assert.deepEqual(frames.map(parse), [
      { type: 'mission.updated', data: { missionId: 'mission:1', goalId: 'goal:1', status: 'running', executionPhase: 'investigating' } },
      { type: 'mission.updated', data: { missionId: 'mission:1', goalId: 'goal:1', status: 'running', executionPhase: 'forged' } },
      { type: 'mission.updated', data: { missionId: 'mission:1', goalId: 'goal:1', status: 'failed', executionPhase: 'failed' } },
    ]);
    assert.doesNotMatch(frames.join(''), /secret-lease|private detail|agent text/);
  });

  it('does not publish for an idempotent result replay or an empty claim', async () => {
    frames.length = 0;
    assert.equal((await post('/api/agent-missions/mission%3A1/results', { replay: true })).status, 202);
    assert.deepEqual(frames, []);
  });
});
