import { describe, expect, it } from 'vitest';
import type { MissionSummary } from '../kernel/contracts';
import type { GoalSurface } from '../kernel/goal-surfaces';
import { buildForgeModel, type ForgeMissionModel } from './forge-model';
import { MAX_GRAPH_NODES, buildForgeStory, readFailureCode, shortTitle, storyStep, storyTimeline } from './forge-story';

// Kernel-shaped TEST FIXTURES modelled on a real mission's shape (not product data).
const MISSION = 'mission:story-test';
const surface = (workState: NonNullable<GoalSurface['mission']>['workState']): GoalSurface => ({
  schemaVersion: 'efesto.goal-surface.v1', sourceOfTruth: 'kernel', observedAt: '2026-10-03T10:00:00.000Z',
  goal: { id: 'goal:story', title: 'empleo de conductor', status: 'active', revision: 1, createdAt: '2026-10-03T09:00:00.000Z', updatedAt: '2026-10-03T09:00:00.000Z', compatibility: 'legacy_radar', policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' } },
  mission: { id: MISSION, status: workState === 'forged' ? 'completed' : 'running', workState, createdAt: '2026-10-03T09:00:00.000Z', updatedAt: '2026-10-03T09:01:00.000Z' },
});
const candidates = [
  { id: 'c-drive', url: 'https://www.drive.example/es-es/e/drive/barcelona/', title: 'Public source: www.drive.example' },
  { id: 'c-blocked', url: 'https://es.blocked.example/trabajo/Barcelona', title: 'Public source: es.blocked.example' },
  { id: 'c-portal', url: 'https://www.portal.example/', title: 'Public source: www.portal.example' },
  { id: 'c-dns', url: 'https://es.nodns.example/', title: 'Public source: es.nodns.example' },
];
const results = [
  { candidateId: 'c-drive', status: 'verified', sourceUrl: candidates[0].url, evidenceId: 'e-drive', supported: true, supportReason: 'supported' },
  { candidateId: 'c-blocked', status: 'verification_failed', reason: 'web.read returned HTTP 403' },
  { candidateId: 'c-portal', status: 'verified', sourceUrl: candidates[2].url, evidenceId: 'e-portal', supported: false, supportReason: 'homepage_insufficient_coverage' },
  { candidateId: 'c-dns', status: 'verification_failed', reason: 'getaddrinfo ENOTFOUND es.nodns.example' },
];
const row = (extra: Record<string, unknown> = {}) => ({ id: MISSION, goalId: 'goal:story', goalTitle: 'empleo de conductor', status: 'completed', executionPhase: 'forged', createdAt: '2026-10-03T09:00:00.000Z', searchCandidates: candidates, verificationResults: results, ...extra }) as MissionSummary;
const find = { id: 'opp', title: 'Trabajos de conductor en Barcelona: determina tus horas | Drive', category: 'job', categoryLabel: 'Empleo', benefitType: 'income', sourceHost: 'drive.example', relevance: 80, nextAction: 'Leer', status: 'new' as const, detectedAt: '2026-10-03T09:02:00.000Z', evidenceId: 'e-drive', sourceUrl: candidates[0].url, supported: true };

function mission(workState: NonNullable<GoalSurface['mission']>['workState'], extra: Record<string, unknown> = {}, withFind = true): ForgeMissionModel {
  const model = buildForgeModel({ connected: true, kernelOnline: true, surface: surface(workState), mission: row(extra), ...(withFind ? { opportunities: [find] } : {}) });
  if (model.kind !== 'mission') throw new Error('expected a mission model');
  return model;
}
const text = (segs: { text: string }[]) => segs.map((seg) => seg.text).join('');

describe('forge story (spider graph + forge.log)', () => {
  it('maps every real candidate to one graph node with its Kernel outcome and read code', () => {
    const story = buildForgeStory(mission('forged'));
    expect(story.nodes.map((node) => [node.host, node.outcome, node.code])).toEqual([
      ['drive.example', 'support', 'leída'],
      ['portal.example', 'unsupported', 'leída'],
      ['es.blocked.example', 'unread', '403'],
      ['es.nodns.example', 'unread', 'ENOTFOUND'],
    ]);
    expect(story.nodes[0].path).toBe('/es-es/e/drive/barcelona');
    expect(story.nodes[0].findTitle).toBe(find.title);
    expect(story.counts).toEqual({ candidates: 4, evidence: 2, supported: 1 });
    expect(story.reach).toBe('final');
    expect(story.hiddenNodes).toBe(0);
  });

  it('writes forge.log only from real records: candidates, Kernel reads, SUPPORT verdicts and the Find', () => {
    const lines = buildForgeStory(mission('forged')).log.map((line) => text(line.segs));
    expect(lines).toEqual([
      '$ hermes.search ← Goal  # consulta no publicada',
      '+ candidato drive.example',
      '+ candidato portal.example',
      '+ candidato es.blocked.example',
      '+ candidato es.nodns.example',
      'kernel.read drive.example ✓ Evidence',
      'kernel.read portal.example ✓ Evidence',
      'kernel.read es.blocked.example 403',
      'kernel.read es.nodns.example ENOTFOUND',
      'kernel.support drive.example ✓ SUPPORT',
      'kernel.support portal.example × sin SUPPORT',
      'forge.find ✓ Trabajos de conductor en Barcelona',
    ]);
  });

  it('never invents the query text or the result count; shows them only when the Kernel row carries them', () => {
    const plain = buildForgeStory(mission('forged'));
    expect(plain.query).toEqual({ text: 'empleo de conductor', exact: false, all: ['empleo de conductor'] });
    expect(plain.resultCount).toBeUndefined();
    expect(plain.log.some((line) => line.cue.kind === 'results')).toBe(false);
    const searchTelemetry = { schemaVersion: 'efesto.mission-search-telemetry.v1', displayOnly: true, recordedAt: '2026-10-03T09:01:00.000Z', searches: [
      { query: 'empleo conductor', limit: 10, resultCount: 10 },
      { query: 'trabajo conductor Barcelona', limit: 10 },
    ] };
    const published = buildForgeStory(mission('forged', { searchTelemetry }));
    expect(published.query).toEqual({ text: 'empleo conductor', exact: true, all: ['empleo conductor', 'trabajo conductor Barcelona'] });
    expect(published.runCounts).toEqual([10, undefined]);
    // One search has no recorded count: no total is shown, only the per-search count that exists.
    expect(published.resultCount).toBeUndefined();
    expect(published.log.slice(0, 3).map((line) => text(line.segs))).toEqual([
      '$ hermes.search «empleo conductor»', '← buscador 10 resultados', '$ hermes.search «trabajo conductor Barcelona»',
    ]);
    const counted = buildForgeStory(mission('forged', { searchTelemetry: { ...searchTelemetry, searches: [searchTelemetry.searches[0], { ...searchTelemetry.searches[1], resultCount: 7 }] } }));
    expect(counted.resultCount).toBe(17);
    // The chip types each query in turn: the second one while the crawl runs, before the spider.
    const timeline = storyTimeline(counted);
    expect(timeline.qa).toHaveLength(2);
    expect(timeline.qa[1]).toBeGreaterThanOrEqual(timeline.crawl0);
    expect(timeline.qb[1]).toBeLessThan(timeline.spider0);
    expect(timeline.ra[1]).toBeGreaterThan(timeline.qb[1]);
    // Hermes may make more searches than asked (a live run made 7): every one is typed, the last one
    // before the spider, so the settled chip shows the last query the Kernel recorded.
    const seven = buildForgeStory(mission('forged', { searchTelemetry: { ...searchTelemetry, searches: Array.from({ length: 7 }, (_, i) => ({ query: `consulta ${i + 1}`, limit: 10, resultCount: 10 })) } }));
    const t7 = storyTimeline(seven);
    expect(seven.resultCount).toBe(70);
    expect(t7.qa).toHaveLength(7);
    expect(t7.qb[6]).toBeLessThan(t7.spider0);
    for (let i = 1; i < 7; i += 1) expect(t7.qa[i]).toBeGreaterThanOrEqual(t7.qb[i - 1] - 1e-9);
  });

  it('while the Kernel verifies, holds after the candidates fell in and says the batch is in progress, with no per-page claim', () => {
    const story = buildForgeStory(mission('verifying', { status: 'running', executionPhase: 'verifying', verificationResults: [] }));
    expect(story.reach).toBe('candidates');
    expect(story.nodes.every((node) => node.outcome === 'pending' && node.code === undefined)).toBe(true);
    expect(story.log.filter((line) => line.cue.kind === 'read')).toHaveLength(0);
    expect(text(story.log.find((line) => line.cue.kind === 'reading')?.segs ?? [])).toBe('kernel.read 4 candidatos · en curso');
  });

  it('a mission the surface still calls investigating plays through to the verdicts the Kernel already published', () => {
    const story = buildForgeStory(mission('investigating', { status: 'running', executionPhase: 'investigating' }));
    expect(story.reach).toBe('final');
    expect(story.nodes.map((node) => node.outcome)).toEqual(['support', 'unsupported', 'unread', 'unread']);
    const pending = buildForgeStory(mission('investigating', { status: 'running', executionPhase: 'investigating', verificationResults: [] }));
    expect(pending.reach).toBe('candidates');
  });

  it('queued and searching missions have no nodes and nothing read', () => {
    const queued = buildForgeStory(mission('queued', { status: 'queued', executionPhase: 'queued', searchCandidates: [], verificationResults: [] }));
    expect(queued.reach).toBe('idle');
    expect(queued.nodes).toEqual([]);
    const searching = buildForgeStory(mission('investigating', { status: 'running', executionPhase: 'investigating', searchCandidates: [], verificationResults: [] }));
    expect(searching.reach).toBe('searching');
    expect(searching.log.map((line) => line.cue.kind)).toEqual(['query']);
  });

  it(`draws at most ${MAX_GRAPH_NODES} nodes and reports the rest as hidden`, () => {
    const many = Array.from({ length: 11 }, (_, index) => ({ id: `m${index}`, url: `https://site${index}.example/p` }));
    const story = buildForgeStory(mission('verifying', { status: 'running', executionPhase: 'verifying', searchCandidates: many, verificationResults: [] }));
    expect(story.nodes).toHaveLength(MAX_GRAPH_NODES);
    expect(story.hiddenNodes).toBe(3);
  });

  it('plays picks → falls → reads → one hammer strike per SUPPORT → Find, and holds where the data stops', () => {
    const story = buildForgeStory(mission('forged'));
    const timeline = storyTimeline(story);
    const ordered = [timeline.q0, timeline.q1, timeline.crawl0, timeline.spider0, ...timeline.pick, ...timeline.pull, ...timeline.read, ...timeline.strike, timeline.find, timeline.end];
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
    expect(timeline.strike).toHaveLength(1);
    expect(timeline.strikeNode).toEqual([0]);
    expect(timeline.hold.final).toBe(timeline.end);
    expect(timeline.hold.candidates).toBeLessThan(timeline.read[0]);
    expect(timeline.hold.candidates).toBeGreaterThan(timeline.pull[timeline.pull.length - 1]);
    expect(storyStep(timeline, timeline.read[0] + 0.1)).toBe(2);
    expect(storyStep(timeline, timeline.strike[0] + 0.1)).toBe(3);
    expect(storyStep(timeline, timeline.end)).toBe(4);
    const unsupported = storyTimeline(buildForgeStory(mission('forged', { verificationResults: results.map((item) => ({ ...item, supported: item.supported ? false : item.supported })) }, false)));
    expect(unsupported.strike).toEqual([]);
  });

  it('turns Kernel read failures into short codes and keeps ticker titles short', () => {
    expect(readFailureCode('web.read returned HTTP 403')).toBe('403');
    expect(readFailureCode('getaddrinfo ENOTFOUND es.nodns.example')).toBe('ENOTFOUND');
    expect(readFailureCode('request timed out')).toBe('TIMEOUT');
    expect(readFailureCode(undefined)).toBe('ERROR');
    expect(shortTitle('Trabajos de conductor en Barcelona: determina tus horas | Drive')).toBe('Trabajos de conductor en Barcelona');
    expect(shortTitle('Ownership')).toBe('Ownership');
  });
});
