import { describe, expect, it, vi } from 'vitest';
import { KernelClient } from './client';
import { MissionEvidenceContractError, loadMissionEvidence, parseMissionEvidence } from './mission-evidence';

const body = {
  ok: true, schemaVersion: 'efesto.mission-evidence.v1', sourceOfTruth: 'kernel', missionId: 'mission:1',
  evidence: [{ id: 'e1', candidateId: 'c1', caseId: 'case-1', sourceUrl: 'https://tools.example/a', title: 'T', capturedAt: '2026-10-03T10:00:00.000Z', supported: true, supportReason: 'supported', excerpt: { text: 'Taladro 18 V', anchor: 'goal_term', truncatedStart: false, truncatedEnd: true } }],
};

describe('parseMissionEvidence', () => {
  it('accepts the Kernel contract', () => {
    expect(parseMissionEvidence(body, 'mission:1').evidence[0]).toMatchObject({ id: 'e1', supported: true, excerpt: { text: 'Taladro 18 V', truncatedEnd: true } });
  });

  it('rejects other sources of truth, mismatched missions, non-HTTP sources and oversize excerpts', () => {
    expect(() => parseMissionEvidence({ ...body, sourceOfTruth: 'hermes' })).toThrow(MissionEvidenceContractError);
    expect(() => parseMissionEvidence(body, 'mission:2')).toThrow(MissionEvidenceContractError);
    expect(() => parseMissionEvidence({ ...body, evidence: [{ ...body.evidence[0], sourceUrl: 'javascript:alert(1)' }] })).toThrow(MissionEvidenceContractError);
    expect(() => parseMissionEvidence({ ...body, evidence: [{ ...body.evidence[0], excerpt: { ...body.evidence[0].excerpt, text: 'x'.repeat(281) } }] })).toThrow(MissionEvidenceContractError);
    expect(() => parseMissionEvidence({ ...body, evidence: [{ ...body.evidence[0], supported: 'yes' }] })).toThrow(MissionEvidenceContractError);
  });

  it('keeps a null excerpt as no quote', () => {
    expect(parseMissionEvidence({ ...body, evidence: [{ ...body.evidence[0], excerpt: null }] }).evidence[0].excerpt).toBeNull();
  });
});

describe('loadMissionEvidence', () => {
  it('calls the authenticated read-only route with an encoded mission id', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    const client = new KernelClient({ baseUrl: 'http://127.0.0.1:4000', token: 'tok', fetcher: fetcher as unknown as typeof fetch });
    const result = await loadMissionEvidence(client, 'mission:1');
    expect(result.missionId).toBe('mission:1');
    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe('http://127.0.0.1:4000/api/agent-missions/mission%3A1/evidence');
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).get('x-hephaestus-token')).toBe('tok');
  });
});
