import { describe, expect, it } from 'vitest';
import {
  bootstrapResponse,
  casesResponse,
  goalsResponse,
  healthResponse,
  missionsResponse,
  modelForgeResponse,
  opportunitiesResponse,
  statusResponse,
} from '../../test/fixtures';
import {
  KernelContractError,
  parseBootstrap,
  parseCases,
  parseGoals,
  parseHealth,
  parseGoalIntelligencePlan,
  parseMissions,
  parseModelForge,
  parseOpportunities,
  parseStatus,
} from './parse';

describe('Kernel response parsers', () => {
  it('accepts the current public readiness envelopes', () => {
    expect(parseHealth(healthResponse)).toMatchObject({ service: 'hephaestus-local-kernel', hermes: false });
    expect(parseStatus(statusResponse)).toMatchObject({ kernel: 'ready', obsidian: 'not_configured' });
    expect(parseBootstrap(bootstrapResponse)).toMatchObject({ overall: 'ready', actions: [{ id: 'open_efesto' }] });
  });

  it('accepts the current authenticated collection envelopes', () => {
    expect(parseCases(casesResponse)).toEqual([{ id: 'case-1', title: 'Supplier research', status: 'active' }]);
    expect(parseGoals(goalsResponse)).toMatchObject([{ id: 'goal-1', priority: 3, status: 'active' }]);
    expect(parseMissions(missionsResponse)).toMatchObject([{ id: 'mission-1', executionPhase: 'investigating', attempt: 1 }]);
    expect(parseOpportunities(opportunitiesResponse)).toMatchObject([{ id: 'opportunity-1', personalizedRelevance: 92 }]);
    expect(parseModelForge(modelForgeResponse)).toMatchObject({ runtime: 'available', recommended: 'qwen3:4b' });
  });

  it('accepts the Kernel-owned Goal intelligence contract and its truthful source states', () => {
    expect(parseGoalIntelligencePlan({
      ok: true,
      schemaVersion: 'efesto.goal-intelligence.v1',
      authority: 'kernel',
      generatedAt: '2026-08-14T14:00:00.000Z',
      goal: { title: 'Audita GitHub', categories: ['client'], keywords: ['github'] },
      intent: { primaryCategory: 'client', mode: 'connector_research' },
      sources: [{
        id: 'hermes', adapter: 'native', selected: true, required: true, reason: 'public_research', status: 'ready',
        scopes: ['public.read'], requiredCapabilities: ['mission.execute', 'public.read'], activeCapabilities: ['mission.execute', 'public.read'], action: 'agents',
      }, {
        id: 'github', adapter: 'mcp', selected: true, required: true, reason: 'goal_signal', status: 'not_configured',
        scopes: ['github.read'], requiredCapabilities: ['github.repository.read'], activeCapabilities: [], action: 'settings',
      }],
      readiness: 'needs_setup', nextAction: 'configure_source', limitations: ['read_only_sources', 'source_not_configured'],
    })).toMatchObject({
      authority: 'kernel',
      sources: [{ id: 'hermes', status: 'ready' }, { id: 'github', status: 'not_configured', activeCapabilities: [] }],
    });
  });

  it('preserves optional Kernel fields that the Phase 1 view may render', () => {
    const response = {
      ...missionsResponse,
      missions: [{ ...missionsResponse.missions[0], resultSummary: { received: 2, evidenceCreated: 1, opportunitiesPromoted: 1 } }],
    };

    expect(parseMissions(response)[0]).toMatchObject({
      resultSummary: { received: 2, evidenceCreated: 1, opportunitiesPromoted: 1 },
    });
  });

  it('rejects a fourth mission attempt at the persisted attempt path', () => {
    try {
      parseMissions({ ok: true, missions: [{ ...missionsResponse.missions[0], attempt: 4 }] });
      throw new Error('expected parseMissions to reject attempt 4');
    } catch (error) {
      expect(error).toMatchObject({ name: 'KernelContractError', path: 'missions.missions[0].attempt' });
    }
  });

  it.each([
    ['health envelope', () => parseHealth({ ok: false })],
    ['cases array', () => parseCases({ ok: true, cases: {} })],
    ['empty case identifier', () => parseCases({ ok: true, cases: [{ id: '', title: 'Valid', status: 'active' }] })],
    ['invalid goal state', () => parseGoals({ ok: true, goals: [{ ...goalsResponse.goals[0], status: 'paused' }] })],
    ['invalid mission state', () => parseMissions({ ok: true, missions: [{ ...missionsResponse.missions[0], status: 'paused' }] })],
    ['invalid mission phase', () => parseMissions({ ok: true, missions: [{ ...missionsResponse.missions[0], executionPhase: 'invented' }] })],
    ['invalid opportunity state', () => parseOpportunities({ ok: true, opportunities: [{ ...opportunitiesResponse.opportunities[0], status: 'verified' }] })],
    ['invalid model runtime', () => parseModelForge({ ok: true, forge: { ...modelForgeResponse.forge, runtime: 'running' } })],
    ['invalid intelligence readiness', () => parseGoalIntelligencePlan({ ok: true, schemaVersion: 'efesto.goal-intelligence.v1', authority: 'kernel', generatedAt: '2026-08-14T14:00:00.000Z', goal: { title: 'Goal', categories: [], keywords: [] }, intent: { primaryCategory: null, mode: 'public_research' }, sources: [], readiness: 'invented', nextAction: 'confirm_goal', limitations: [] })],
  ])('rejects an invalid %s', (_breakName, parse) => {
    expect(parse).toThrow(KernelContractError);
  });

  it('reports the invalid field path without exposing the payload', () => {
    try {
      parseStatus({ ...statusResponse, kernel: 'invented' });
      throw new Error('expected parseStatus to throw');
    } catch (error) {
      expect(error).toMatchObject({ name: 'KernelContractError', path: 'status.kernel' });
      expect(String(error)).not.toContain(JSON.stringify(statusResponse));
    }
  });
});
