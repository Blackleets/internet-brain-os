import { describe, expect, it } from 'vitest';
import type { MissionSummary } from '../kernel/contracts';
import type { GoalSurface, GoalSurfaceWorkState } from '../kernel/goal-surfaces';
import type { MissionEvidenceRecord } from '../kernel/mission-evidence';
import { buildForgeModel } from './forge-model';
import { buildForgeScene } from './forge-scene';

// Kernel-shaped TEST FIXTURES (not product data).
const MISSION_ID = 'mission:scene-test';
const surface = (workState: GoalSurfaceWorkState): GoalSurface => ({
  schemaVersion: 'efesto.goal-surface.v1', sourceOfTruth: 'kernel', observedAt: '2026-10-03T10:00:00.000Z',
  goal: { id: 'goal:1', title: 'Rust lifetimes explained', status: 'active', revision: 1, createdAt: '2026-10-03T09:00:00.000Z', updatedAt: '2026-10-03T09:00:00.000Z', compatibility: 'legacy_radar', policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' } },
  mission: { id: MISSION_ID, status: 'running', workState, createdAt: '2026-10-03T09:00:00.000Z', updatedAt: '2026-10-03T09:01:00.000Z' },
});
const candidates = [
  { id: 'c1', url: 'https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html', title: 'Validating References with Lifetimes', status: 'pending_verification' },
  { id: 'c2', url: 'https://blog.example/rust', title: 'A blog', status: 'pending_verification' },
  { id: 'c3', url: 'https://down.example/', title: 'Down', status: 'pending_verification' },
  { id: 'c4', url: 'https://later.example/', title: 'Later', status: 'pending_verification' },
];
const row = (extra: Record<string, unknown> = {}) => ({ id: MISSION_ID, goalId: 'goal:1', goalTitle: 'Rust lifetimes explained', status: 'running', executionPhase: 'verifying', createdAt: '2026-10-03T09:00:00.000Z', searchCandidates: candidates, ...extra }) as MissionSummary;
const results = [
  { candidateId: 'c1', status: 'verified', evidenceId: 'e1', sourceUrl: candidates[0].url, supported: true, supportReason: 'supported' },
  { candidateId: 'c2', status: 'verified', evidenceId: 'e2', sourceUrl: candidates[1].url, supported: false, supportReason: 'insufficient_term_coverage' },
  { candidateId: 'c3', status: 'verification_failed', reason: 'web.read returned HTTP 404' },
];
const records: MissionEvidenceRecord[] = [
  { id: 'e1', candidateId: 'c1', sourceUrl: candidates[0].url, title: 'Validating References with Lifetimes', capturedAt: '2026-10-03T09:02:00.000Z', supported: true, supportReason: 'supported', excerpt: { text: 'Rust lifetimes ensure references are valid', anchor: 'goal_term', truncatedStart: false, truncatedEnd: false } },
  { id: 'e2', candidateId: 'c2', sourceUrl: candidates[1].url, title: 'A blog', capturedAt: '2026-10-03T09:02:01.000Z', supported: false, supportReason: 'insufficient_term_coverage', excerpt: null },
];

describe('buildForgeScene (real Kernel data → visual elements)', () => {
  it('draws nothing and stays still when no Kernel is connected', () => {
    const scene = buildForgeScene(buildForgeModel({ connected: false, kernelOnline: false }));
    expect(scene).toMatchObject({ mood: 'off', motion: 'still', elements: [], searchPulse: false });
    expect(buildForgeScene(buildForgeModel({ connected: true, connecting: true, kernelOnline: false }))).toMatchObject({ mood: 'connecting', motion: 'breathing' });
    expect(buildForgeScene(buildForgeModel({ connected: true, kernelOnline: true }))).toMatchObject({ mood: 'idle', motion: 'breathing', elements: [] });
  });

  it('only breathes while a mission is queued: no sparks, no search pulse', () => {
    const scene = buildForgeScene(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('queued'), mission: row({ status: 'queued', executionPhase: 'queued', searchCandidates: undefined }) }));
    expect(scene.mood).toBe('waiting');
    expect(scene.motion).toBe('breathing');
    expect(scene.elements).toEqual([]);
    expect(scene.searchPulse).toBe(false);
  });

  it('pulses the search (and draws no spark) while Hermes searches without candidates yet', () => {
    const scene = buildForgeScene(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('investigating'), mission: row({ executionPhase: 'investigating', searchCandidates: undefined }) }));
    expect(scene).toMatchObject({ mood: 'searching', motion: 'live', searchPulse: true, counts: { sparks: 0, threads: 0, gold: 0, ash: 0 } });
  });

  it('draws exactly one spark per real candidate URL while the Kernel verifies', () => {
    const scene = buildForgeScene(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row() }));
    expect(scene.mood).toBe('verifying');
    expect(scene.motion).toBe('live');
    expect(scene.searchPulse).toBe(false);
    expect(scene.elements.map((element) => [element.url, element.kind])).toEqual(candidates.map((candidate) => [candidate.url, 'spark']));
    expect(scene.counts).toEqual({ sparks: 4, threads: 0, gold: 0, ash: 0 });
  });

  it('maps Evidence to threads, Kernel SUPPORT to gold and rejections to ash with the Kernel reason', () => {
    const model = buildForgeModel({
      connected: true, kernelOnline: true, surface: surface('forged'),
      mission: row({ status: 'completed', executionPhase: 'forged', verificationResults: results }),
      evidence: { status: 'available', records },
    });
    const scene = buildForgeScene(model);
    const byId = Object.fromEntries(scene.elements.map((element) => [element.url, element]));
    expect(byId[candidates[0].url]).toMatchObject({ kind: 'gold', evidenceId: 'e1' });
    expect(byId[candidates[1].url]).toMatchObject({ kind: 'ash', evidenceId: 'e2', reason: expect.stringContaining('términos del Goal') });
    expect(byId[candidates[1].url].readFailed).toBeUndefined();
    expect(byId[candidates[2].url]).toMatchObject({ kind: 'ash', readFailed: true, reason: 'No se pudo leer: la página ya no existe (HTTP 404)' });
    expect(byId[candidates[3].url].kind).toBe('spark');
    // threads = Evidence records (gold + no-SUPPORT ash); a failed read never had Evidence.
    expect(scene.counts).toEqual({ sparks: 4, threads: 2, gold: 1, ash: 2 });
    expect(scene.mood).toBe('gold');
    expect(scene.motion).toBe('breathing');
  });

  it('cools to ash when nothing earned Kernel SUPPORT', () => {
    const scene = buildForgeScene(buildForgeModel({
      connected: true, kernelOnline: true, surface: surface('forged'),
      mission: row({ status: 'completed', executionPhase: 'research_completed', searchCandidates: candidates.slice(1, 3), verificationResults: results.slice(1) }),
      evidence: { status: 'available', records: records.slice(1) },
    }));
    expect(scene.counts.gold).toBe(0);
    expect(scene.mood).toBe('ash');
    expect(scene.elements.every((element) => element.kind === 'ash' && element.reason)).toBe(true);
  });
});
