import { describe, expect, it, vi } from 'vitest';
import { createGoal, getKernelStatus, inspectModelForge, listAgentMissions, listCases, listGoals, listOpportunities, LocalTransportError, pairKernel, sendOpportunityFeedback, sendPageContext, startGoalResearch } from './local-transport.js';

const context = {
  schemaVersion: 'hephaestus.page-context.v1',
  url: 'https://example.com',
  title: 'Example',
  visibleText: 'Evidence text',
  capturedAt: '2026-07-19T11:00:00.000Z',
};
const apiToken = 'test-token-that-is-at-least-32-characters';

describe('sendPageContext', () => {
  it('posts structured context to the local Kernel', async () => {
    const fetchImpl = vi.fn(async (_url, init) => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, receiptId: 'receipt:1', caseId: 'case:1', evidenceId: 'evidence:1' }),
      requestBody: init.body,
    }));

    await expect(sendPageContext(context, { fetchImpl, apiToken })).resolves.toEqual({
      ok: true,
      receiptId: 'receipt:1',
      caseId: 'case:1',
      evidenceId: 'evidence:1',
      obsidianUpdated: false,
      intelligenceStatus: undefined,
      opportunity: undefined,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:4000/api/browser/page-context',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual(context);
    expect(fetchImpl.mock.calls[0][1].headers['x-hephaestus-token']).toBe(apiToken);
  });

  it('targets an existing Case without changing the page context contract', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 202,
      json: async () => ({ ok: true, receiptId: 'receipt:2', caseId: 'case:existing', evidenceId: 'evidence:2' }),
    }));
    await sendPageContext(context, { fetchImpl, apiToken, targetCaseId: 'case:existing' });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ ...context, targetCaseId: 'case:existing' });
  });

  it('rejects unsupported payloads before network access', async () => {
    const fetchImpl = vi.fn();
    await expect(sendPageContext({ schemaVersion: 'unknown' }, { fetchImpl, apiToken })).rejects.toMatchObject({
      code: 'INVALID_CONTEXT',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns safe unavailable errors without page contents', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503 }));
    await expect(sendPageContext(context, { fetchImpl, apiToken })).rejects.toEqual(
      expect.objectContaining({
        name: 'LocalTransportError',
        code: 'KERNEL_UNAVAILABLE',
        message: 'Local Kernel request failed with HTTP 503',
      }),
    );
  });

  it('rejects malformed success responses', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }));
    await expect(sendPageContext(context, { fetchImpl, apiToken })).rejects.toBeInstanceOf(LocalTransportError);
  });

  it('rejects missing credentials and non-loopback endpoints before network access', async () => {
    const fetchImpl = vi.fn();
    await expect(sendPageContext(context, { fetchImpl })).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    await expect(sendPageContext(context, { fetchImpl, apiToken, baseUrl: 'https://example.com' }))
      .rejects.toMatchObject({ code: 'INVALID_ENDPOINT' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('listCases', () => {
  it('returns validated local Case summaries', async () => {
    const cases = [{ id: 'case:1', title: 'Investigation', status: 'draft' }];
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, cases }) }));
    await expect(listCases({ fetchImpl, apiToken })).resolves.toEqual(cases);
    expect(fetchImpl.mock.calls[0][1].headers['x-hephaestus-token']).toBe(apiToken);
  });
});

describe('listOpportunities', () => {
  it('returns the private local Opportunity inbox', async () => {
    const opportunities = [{ id: 'opportunity:1', category: 'grant', relevance: 82 }];
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, opportunities }) }));
    await expect(listOpportunities({ fetchImpl, apiToken })).resolves.toEqual(opportunities);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4000/api/opportunities', {
      headers: { 'x-hephaestus-token': apiToken },
    });
  });

  it('sends bounded explicit feedback to the private learner', async () => {
    const feedback = { opportunityId: 'opportunity:1', signal: 'useful' };
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, feedback }) }));
    await expect(sendOpportunityFeedback('opportunity:1', 'useful', { fetchImpl, apiToken })).resolves.toEqual(feedback);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4000/api/opportunities/opportunity%3A1/feedback', expect.objectContaining({ method: 'POST', body: JSON.stringify({ signal: 'useful' }) }));
  });
});

describe('Goals transport', () => {
  it('lists and creates Goals only through the authenticated local Kernel', async () => {
    const goal = { id: 'goal:1', title: 'Find grants' };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, goals: [goal] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, goal }) });
    await expect(listGoals({ fetchImpl, apiToken })).resolves.toEqual([goal]);
    await expect(createGoal({ title: 'Find grants', categories: ['grant'] }, { fetchImpl, apiToken })).resolves.toEqual(goal);
    expect(fetchImpl.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'POST', body: JSON.stringify({ title: 'Find grants', categories: ['grant'] }) }));
    expect(fetchImpl.mock.calls[1][1].headers['x-hephaestus-token']).toBe(apiToken);
  });

  it('starts only an explicitly confirmed bounded Hermes mission', async () => {
    const mission = { id: 'mission:1', status: 'waiting_for_agent' };
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, mission }) }));
    await expect(startGoalResearch('goal:1', { fetchImpl, apiToken })).resolves.toEqual(mission);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4000/api/goals/goal%3A1/missions', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ agent: 'hermes', cadence: 'manual', confirmed: true }),
    }));
  });

  it('loads observable Agent Hub mission states', async () => {
    const missions = [{ id: 'mission:1', status: 'running', attempt: 1 }];
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, missions }) }));
    await expect(listAgentMissions({ fetchImpl, apiToken })).resolves.toEqual(missions);
  });
});

describe('getKernelStatus', () => {
  it('returns only safe readiness fields without requiring a credential', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, kernel: 'ready', hermes: 'ready', replayLab: 'ready', ollama: 'configured', obsidian: 'configured' }),
    }));
    await expect(getKernelStatus({ fetchImpl })).resolves.toEqual({
      kernel: 'ready', hermes: 'ready', replayLab: 'ready', ollama: 'configured', obsidian: 'configured',
    });
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4000/status');
  });
});

describe('Model Forge transport', () => {
  it('loads hardware-safe local recommendations through the authenticated Kernel', async () => {
    const forge = { runtime: 'available', hardware: { ramGiB: 8, cpuCores: 4, tier: 'balanced' }, recommended: 'qwen3:4b', models: [] };
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, forge }) }));
    await expect(inspectModelForge({ fetchImpl, apiToken })).resolves.toEqual(forge);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4000/api/model-forge', {
      headers: { 'x-hephaestus-token': apiToken },
    });
  });
});

describe('pairKernel', () => {
  it('exchanges a short-lived code for a validated local credential', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, apiToken }) }));
    await expect(pairKernel('ABCD-2345', { fetchImpl })).resolves.toBe(apiToken);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4000/pair', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ code: 'ABCD-2345' }),
    }));
  });

  it('rejects malformed codes without network access', async () => {
    const fetchImpl = vi.fn();
    await expect(pairKernel('123', { fetchImpl })).rejects.toMatchObject({ code: 'INVALID_PAIRING_CODE' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
