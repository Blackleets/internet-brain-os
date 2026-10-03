import { describe, expect, it } from 'vitest';
import type { MissionSummary, OpportunitySummary } from '../kernel/contracts';
import type { GoalSurface, GoalSurfaceWorkState } from '../kernel/goal-surfaces';
import type { MissionEvidenceRecord } from '../kernel/mission-evidence';
import { buildForgeModel, displayText, readFailureReason, supportReason, type ForgeMissionModel } from './forge-model';

// Kernel-shaped TEST FIXTURES (not product data).
const MISSION_ID = 'mission:forge-test';

function surface(workState: GoalSurfaceWorkState, extra: Partial<NonNullable<GoalSurface['mission']>> = {}): GoalSurface {
  return {
    schemaVersion: 'efesto.goal-surface.v1', sourceOfTruth: 'kernel', observedAt: '2026-10-03T10:00:00.000Z',
    goal: {
      id: 'goal:1', title: 'Taladro percutor 18 V', status: 'active', revision: 1,
      createdAt: '2026-10-03T09:00:00.000Z', updatedAt: '2026-10-03T09:00:00.000Z', compatibility: 'legacy_radar',
      policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' },
    },
    mission: { id: MISSION_ID, status: 'running', workState, createdAt: '2026-10-03T09:00:00.000Z', updatedAt: '2026-10-03T09:01:00.000Z', ...extra },
  };
}

const candidates = [
  { id: 'c1', url: 'https://www.tools.example/taladro-18v', title: 'Hermes: Taladro 18 V', snippet: 'HERMES SNIPPET — never a quote', status: 'pending_verification' },
  { id: 'c2', url: 'https://blog.example/comparativa', title: 'Hermes: Comparativa', snippet: 'snippet', status: 'pending_verification' },
  { id: 'c3', url: 'https://down.example/', title: 'Hermes: Caída', snippet: 'snippet', status: 'pending_verification' },
];

function row(extra: Record<string, unknown> = {}): MissionSummary {
  return { id: MISSION_ID, goalId: 'goal:1', goalTitle: 'Taladro percutor 18 V', status: 'running', executionPhase: 'verifying', createdAt: '2026-10-03T09:00:00.000Z', searchCandidates: candidates, ...extra } as MissionSummary;
}

const forgedResults = [
  { candidateId: 'c1', status: 'verified', evidenceId: 'e1', sourceUrl: candidates[0].url, supported: true, supportReason: 'supported' },
  { candidateId: 'c2', status: 'verified', evidenceId: 'e2', sourceUrl: candidates[1].url, supported: false, supportReason: 'insufficient_term_coverage' },
  { candidateId: 'c3', status: 'verification_failed', reason: 'web.read returned HTTP 404' },
];

const records: MissionEvidenceRecord[] = [
  { id: 'e1', candidateId: 'c1', sourceUrl: candidates[0].url, title: 'Taladro percutor 18 V — Tools', capturedAt: '2026-10-03T09:02:00.000Z', supported: true, supportReason: 'supported', excerpt: { text: 'Taladro percutor 18 V por 109,90 €', anchor: 'goal_term', truncatedStart: true, truncatedEnd: true } },
  { id: 'e2', candidateId: 'c2', sourceUrl: candidates[1].url, title: 'Comparativa', capturedAt: '2026-10-03T09:02:01.000Z', supported: false, supportReason: 'insufficient_term_coverage', excerpt: null },
];

const find: OpportunitySummary = { id: 'opp-1', title: 'Taladro percutor 18 V — Tools', category: 'deal', categoryLabel: 'Oferta', benefitType: 'saving', sourceHost: 'tools.example', relevance: 80, nextAction: 'Revisar', status: 'new', detectedAt: '2026-10-03T09:02:00.000Z', evidenceId: 'e1', caseId: 'case-1', sourceUrl: candidates[0].url, supported: true };

function mission(model: ReturnType<typeof buildForgeModel>): ForgeMissionModel {
  expect(model.kind).toBe('mission');
  return model as ForgeMissionModel;
}

describe('buildForgeModel', () => {
  it('is an honest offline state with no sources or numbers when no Kernel is connected (e.g. Vercel)', () => {
    const model = buildForgeModel({ connected: false, kernelOnline: false, surface: surface('forged'), mission: row({ verificationResults: forgedResults }) });
    expect(model).toEqual({ kind: 'offline', reason: 'not_connected', summary: expect.stringContaining('No se muestran datos de ejemplo') });
  });

  it('is offline (kernel_unreachable) when the connected Kernel stopped answering', () => {
    const model = buildForgeModel({ connected: true, kernelOnline: false, surface: surface('verifying') });
    expect(model.kind).toBe('offline');
    expect(model).toMatchObject({ reason: 'kernel_unreachable' });
  });

  it('is empty when the Kernel has no focused mission', () => {
    expect(buildForgeModel({ connected: true, kernelOnline: true }).kind).toBe('empty');
    const noMission = { ...surface('idle'), mission: undefined };
    expect(buildForgeModel({ connected: true, kernelOnline: true, surface: noMission }).kind).toBe('empty');
  });

  it('shows only the Goal while Hermes searches (no sparks without real candidates)', () => {
    const model = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('investigating'), mission: row({ executionPhase: 'investigating', searchCandidates: undefined }) }));
    expect(model.phase).toBe('searching');
    expect(model.motion).toBe('active');
    expect(model.sources).toEqual([]);
    expect(model.counts).toEqual({ sources: 0, read: 0, evidence: 0, supported: 0 });
    expect(model.steps.map((step) => step.state)).toEqual(['done', 'active', 'pending', 'pending', 'pending']);
  });

  it('maps every real candidate URL to one pending source while the Kernel verifies, without per-page progress or quotes', () => {
    const model = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row() }));
    expect(model.phase).toBe('verifying');
    expect(model.phaseLabel).toBe('Verificando fuentes');
    expect(model.sources.map((item) => item.url)).toEqual(candidates.map((item) => item.url));
    expect(new Set(model.sources.map((item) => item.state))).toEqual(new Set(['candidate']));
    expect(model.sources.every((item) => item.quote === undefined && item.quoteState === 'not_applicable')).toBe(true);
    expect(model.counts).toEqual({ sources: 3, read: 0, evidence: 0, supported: 0 });
    expect(model.steps.map((step) => step.state)).toEqual(['done', 'done', 'active', 'pending', 'pending']);
    expect(model.sources[0]).toMatchObject({ host: 'tools.example', path: '/taladro-18v', candidateTitle: 'Hermes: Taladro 18 V' });
  });

  it('forges a SUPPORT Find with the real Evidence quote, cools the rest to ash with the real Kernel reason', () => {
    const model = mission(buildForgeModel({
      connected: true, kernelOnline: true, surface: surface('forged', { findCount: 1 }),
      mission: row({ status: 'completed', executionPhase: 'forged', verificationResults: forgedResults }),
      evidence: { status: 'available', records }, opportunities: [find],
    }));
    expect(model.phase).toBe('forged');
    expect(model.motion).toBe('settled');
    expect(model.counts).toEqual({ sources: 3, read: 2, evidence: 2, supported: 1 });
    expect(model.steps.map((step) => step.state)).toEqual(['done', 'done', 'done', 'gold', 'gold']);
    const [supported, unsupported, failed] = model.sources;
    expect(supported).toMatchObject({ state: 'supported', evidenceId: 'e1', quote: 'Taladro percutor 18 V por 109,90 €', quoteState: 'available', findTitle: 'Taladro percutor 18 V — Tools', evidenceTitle: 'Taladro percutor 18 V — Tools' });
    expect(unsupported).toMatchObject({ state: 'unsupported', reasonCode: 'insufficient_term_coverage', reason: 'La página no cubre suficientes términos del Goal', quoteState: 'none' });
    expect(unsupported.quote).toBeUndefined();
    expect(failed).toMatchObject({ state: 'read_failed', reason: 'No se pudo leer: HTTP 404' });
    expect(model.summary).toBe('Find forjado. 3 fuentes, 2 leídas, 2 Evidence, 1 con Kernel SUPPORT.');
    // A Hermes snippet is never rendered as a quote.
    expect(JSON.stringify(model)).not.toContain('HERMES SNIPPET');
  });

  it('never shows a quote when the Evidence endpoint is unavailable (older Kernel) or still loading', () => {
    const base = { connected: true, kernelOnline: true, surface: surface('forged'), mission: row({ executionPhase: 'forged', verificationResults: forgedResults }) } as const;
    const unavailable = mission(buildForgeModel({ ...base, evidence: { status: 'unavailable' } }));
    expect(unavailable.sources[0]).toMatchObject({ quoteState: 'unavailable' });
    expect(unavailable.sources.some((item) => item.quote)).toBe(false);
    expect(unavailable.counts.evidence).toBe(2);
    const loading = mission(buildForgeModel({ ...base, evidence: { status: 'loading' } }));
    expect(loading.sources[0]).toMatchObject({ quoteState: 'loading' });
  });

  it('keeps zero-SUPPORT verification honest: Sin SUPPORT, no Find step, no gold', () => {
    const results = forgedResults.map((item) => (item.candidateId === 'c1' ? { ...item, supported: false, supportReason: 'homepage_insufficient_coverage' } : item));
    const model = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying', { findCount: 0 }), mission: row({ verificationResults: results }), evidence: { status: 'available', records }, opportunities: [find] }));
    expect(model.phase).toBe('verified_unsupported');
    expect(model.phaseLabel).toBe('Leídas sin SUPPORT');
    expect(model.counts.supported).toBe(0);
    expect(model.sources.some((item) => item.state === 'supported' || item.findTitle)).toBe(false);
    expect(model.steps.map((step) => step.state)).toEqual(['done', 'done', 'done', 'failed', 'skipped']);
    expect(model.sources.find((item) => item.id === 'c1')?.reason).toBe('Portada sin cobertura suficiente de los términos del Goal');
  });

  it('forged without SUPPORT is research completed, not a Find', () => {
    const results = forgedResults.map((item) => ({ ...item, supported: false }));
    const model = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('forged', { findCount: 0 }), mission: row({ verificationResults: results }) }));
    expect(model.phase).toBe('research_completed');
    expect(model.steps.find((step) => step.id === 'find')?.state).toBe('skipped');
  });

  it('reports all-failed reads as Sin lectura (retry possible), not as verifying forever', () => {
    const results = candidates.map((item) => ({ candidateId: item.id, status: 'verification_failed', reason: 'web.read returned empty content' }));
    const model = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ verificationResults: results }) }));
    expect(model.phase).toBe('read_failed_all');
    expect(model.sources.every((item) => item.reason === 'No se pudo leer: contenido vacío')).toBe(true);
  });

  it('marks blocked, failed and completed-without-candidates truthfully', () => {
    expect(mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('queued', { blockedReason: 'policy' }) })).phase).toBe('blocked');
    const failed = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('failed'), mission: row({ status: 'failed', searchCandidates: undefined, lastFailure: { reason: 'Hermes lease expired' } }) }));
    expect(failed.phase).toBe('failed');
    expect(failed.phaseDetail).toContain('Hermes lease expired');
    const empty = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('completed'), mission: row({ status: 'completed', searchCandidates: undefined }) }));
    expect(empty.phase).toBe('completed_empty');
    expect(empty.sources).toEqual([]);
  });

  it('ignores a full mission row that belongs to another mission', () => {
    const model = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: { ...row(), id: 'mission:other' } }));
    expect(model.sources).toEqual([]);
  });

  it('drops non-HTTP locators instead of rendering them', () => {
    const model = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ searchCandidates: [{ id: 'x', url: 'javascript:alert(1)', title: 't' }, ...candidates] }) }));
    expect(model.sources.map((item) => item.id)).toEqual(['c1', 'c2', 'c3']);
  });
});

describe('reason copy', () => {
  it('translates known Kernel reasons and keeps unknown codes visible', () => {
    expect(supportReason('unique_id_missing')).toBe('Falta el identificador exacto que pide el Goal');
    expect(supportReason('new_reason')).toBe('Sin Kernel SUPPORT (motivo del Kernel: new_reason)');
    expect(readFailureReason('web.read returned HTTP 503')).toBe('No se pudo leer: HTTP 503');
    expect(readFailureReason('DNS failure')).toBe('No se pudo leer: DNS failure');
  });
});

describe('displayText', () => {
  it('decodes HTML entities left in stored page titles, as plain text only', () => {
    expect(displayText('9. Classes &#8212; Python 3.14 documentation')).toBe('9. Classes — Python 3.14 documentation');
    expect(displayText('A &amp; B &lt;script&gt;')).toBe('A & B <script>');
    expect(displayText('&#xD800; &unknown; &#0;')).toBe('&#xD800; &unknown; &#0;');
  });

  it('exposes the search honestly: Goal + Kernel keywords, exact queries only when the Kernel publishes them', () => {
    const searching = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('investigating'), mission: row({ executionPhase: 'investigating', searchCandidates: undefined, investigatingAt: '2026-10-03T09:00:30.000Z', scope: { keywords: ['taladro', 'Taladro', 'percutor', ''] } }) }));
    expect(searching.search).toEqual({ goal: 'Taladro percutor 18 V', keywords: ['taladro', 'percutor'], exactQueries: [] });
    expect(searching.searchKeywords).toEqual(['taladro', 'percutor']);
    expect(searching.phaseSince).toBe('2026-10-03T09:00:30.000Z');
    expect(searching.nextStep).toMatch(/web\.read/);
    const published = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('investigating'), mission: row({ executionPhase: 'investigating', searchCandidates: undefined, searchQueries: ['taladro percutor 18v oferta', 42] }) }));
    expect(published.search.exactQueries).toEqual(['taladro percutor 18v oferta']);
  });

  it('gives queued missions a next step and the time they have been waiting, never a search claim', () => {
    const queued = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('queued'), mission: row({ status: 'queued', executionPhase: 'queued', searchCandidates: undefined }) }));
    expect(queued.phase).toBe('queued');
    expect(queued.nextStep).toMatch(/^Siguiente: Hermes toma la misión/);
    expect(queued.phaseSince).toBe('2026-10-03T09:00:00.000Z');
    expect(queued.sources).toEqual([]);
  });

  it('marks the Goal terms present in each Kernel Evidence excerpt (display only; SUPPORT stays the Kernel verdict)', () => {
    const model = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('forged', { findCount: 1 }), mission: row({ status: 'completed', executionPhase: 'forged', verificationResults: forgedResults }), evidence: { status: 'available', records }, opportunities: [find] }));
    expect(model.goalTerms).toEqual(['taladro', 'percutor', '18']);
    expect(model.sources.find((item) => item.id === 'c1')?.goalTerms).toEqual(['taladro', 'percutor', '18']);
    expect(model.sources.find((item) => item.id === 'c3')?.goalTerms).toBeUndefined();
    expect(model.sources.find((item) => item.id === 'c1')?.state).toBe('supported');
  });
});
