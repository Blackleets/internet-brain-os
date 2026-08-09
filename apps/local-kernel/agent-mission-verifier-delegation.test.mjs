import { describe, expect, it, vi } from 'vitest';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';

describe('AgentMissionExecutor verifier delegation', () => {
  it('delegates verify_candidates without requiring an agent lease or legacy completion', async () => {
    const verify = vi.fn(async (missionId) => ({
      mission: { id: missionId, status: 'completed', executionPhase: 'forged' },
      evidence: [{ caseId: 'case:1', evidenceId: 'evidence:1', sourceUrl: 'https://example.com' }],
      idempotent: false,
    }));
    const store = { read: async () => ({}), project: vi.fn() };
    const executor = new AgentMissionExecutor(store, { projectInto: vi.fn() }, { candidateVerifier: { verify }, automaticClaims: false });
    const result = await executor.complete('mission:1', { resultKind: 'verify_candidates' });
    expect(verify).toHaveBeenCalledWith('mission:1');
    expect(result.findings).toEqual(result.evidence);
    expect(store.project).not.toHaveBeenCalled();
  });
});
