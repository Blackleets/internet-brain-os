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

  it('reads a Kernel-settled verification without a Find (failed/failed) precisely, with Buscar más and no working state', () => {
    const settled = { status: 'failed', executionPhase: 'failed', failedAt: '2026-10-03T09:03:00.000Z', verifyingAt: '2026-10-03T09:02:00.000Z' };
    const unsupported = forgedResults.map((item) => (item.candidateId === 'c1' ? { ...item, supported: false } : item));
    const noSupport = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('failed', { status: 'failed', executionPhase: 'failed', findCount: 0 }), mission: row({ ...settled, verificationResults: unsupported, lastFailure: { code: 'verified_without_support', reason: 'Kernel web.read read 2 pages; none supports the Goal (no Kernel SUPPORT, no Find)' } }), evidence: { status: 'available', records } }));
    expect(noSupport.phase).toBe('verified_unsupported');
    expect(noSupport.phaseLabel).toBe('Leídas sin SUPPORT');
    expect(noSupport.counts.supported).toBe(0);
    expect(noSupport.searchMore).toBeTruthy();
    expect(noSupport.motion).not.toBe('active');
    const failedReads = candidates.map((item) => ({ candidateId: item.id, status: 'verification_failed', reason: 'web.read returned HTTP 403' }));
    const unread = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('failed', { status: 'failed', executionPhase: 'failed' }), mission: row({ ...settled, verificationResults: failedReads, lastFailure: { code: 'web_read_failed', reason: 'Kernel web.read could not read any candidate page' } }) }));
    expect(unread.phase).toBe('read_failed_all');
    expect(unread.searchMore).toBeTruthy();
    // A failed Mission without candidates (bounded attempts exhausted) stays a plain failure.
    expect(mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('failed', { status: 'failed' }), mission: row({ status: 'failed', executionPhase: 'failed', searchCandidates: [], failedAt: '2026-10-03T09:03:00.000Z' }) })).phase).toBe('failed');
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
    expect(searching.search).toEqual({ goal: 'Taladro percutor 18 V', keywords: ['taladro', 'percutor'], exactQueries: [], runs: [] });
    expect(searching.searchResultCount).toBeUndefined();
    expect(searching.searchKeywords).toEqual(['taladro', 'percutor']);
    expect(searching.phaseSince).toBe('2026-10-03T09:00:30.000Z');
    expect(searching.nextStep).toMatch(/web\.read/);
    // Only the Kernel's display-only searchTelemetry (v1) carries real queries and counts.
    const telemetry = (searches: unknown[], extra: Record<string, unknown> = {}) => ({ schemaVersion: 'efesto.mission-search-telemetry.v1', displayOnly: true, recordedAt: '2026-10-03T09:00:40.000Z', searches, ...extra });
    const published = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ searchTelemetry: telemetry([
      { query: 'taladro percutor 18v oferta', limit: 10, resultCount: 10 },
      { query: 'taladro percutor Madrid', limit: 10, resultCount: 8 },
      { query: 42 },
    ]) }) }));
    expect(published.search.exactQueries).toEqual(['taladro percutor 18v oferta', 'taladro percutor Madrid']);
    expect(published.search.runs).toEqual([{ query: 'taladro percutor 18v oferta', resultCount: 10 }, { query: 'taladro percutor Madrid', resultCount: 8 }]);
    expect(published.searchResultCount).toBe(18);
    // A search without its count: queries shown, no total (never guessed).
    const partial = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ searchTelemetry: telemetry([{ query: 'a', resultCount: 10 }, { query: 'b' }]) }) }));
    expect(partial.search.exactQueries).toEqual(['a', 'b']);
    expect(partial.searchResultCount).toBeUndefined();
    // Anything not shaped like the Kernel contract, or the old speculative fields, is ignored.
    for (const extra of [
      { searchTelemetry: telemetry([{ query: 'x', resultCount: 3 }], { schemaVersion: 'other' }) },
      { searchTelemetry: telemetry([{ query: 'x', resultCount: 3 }], { displayOnly: false }) },
      { searchQueries: ['legacy'], searchResultCount: 9, searchTelemetry: { resultsCount: 9 } },
    ]) {
      const ignored = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row(extra) }));
      expect(ignored.search.exactQueries).toEqual([]);
      expect(ignored.searchResultCount).toBeUndefined();
    }
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

  describe('relaunch (mission left in running/verifying by the Kernel)', () => {
    const now = Date.parse('2026-10-03T10:00:00.000Z');
    const unsupported = [
      { candidateId: 'c1', status: 'verified', evidenceId: 'e1', sourceUrl: candidates[0].url, supported: false, supportReason: 'homepage_insufficient_coverage' },
    ];
    const failedAll = candidates.map((item) => ({ candidateId: item.id, status: 'verification_failed', reason: 'web.read returned HTTP 403' }));

    it('offers relaunch for a read-without-SUPPORT mission with no lease', () => {
      const model = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ verificationResults: unsupported }), now }));
      expect(model.phase).toBe('verified_unsupported');
      expect(model.relaunch).toEqual({ goalId: 'goal:1' });
    });

    it('offers relaunch when every page failed to read and no lease is live', () => {
      const model = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ verificationResults: failedAll, leaseExpiresAt: '2026-10-03T09:59:00.000Z' }), now }));
      expect(model.phase).toBe('read_failed_all');
      expect(model.relaunch).toEqual({ goalId: 'goal:1' });
    });

    it('never offers relaunch while Hermes holds a live lease, while verifying, or once forged', () => {
      const leased = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ verificationResults: unsupported, leaseExpiresAt: '2026-10-03T10:05:00.000Z' }), now }));
      expect(leased.relaunch).toBeUndefined();
      const verifying = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row(), now }));
      expect(verifying.phase).toBe('verifying');
      expect(verifying.relaunch).toBeUndefined();
      const forged = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('forged', { status: 'completed' }), mission: row({ status: 'completed', verificationResults: forgedResults }), now }));
      expect(forged.relaunch).toBeUndefined();
    });

    it('needs the full Kernel mission row (no guess from the surface alone)', () => {
      const model = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), now }));
      expect(model.relaunch).toBeUndefined();
    });
  });

  describe('"Buscar más" (search_more keeps earlier attempts)', () => {
    const now = Date.parse('2026-10-03T10:00:00.000Z');
    const forgedRow = row({ status: 'completed', executionPhase: 'forged', completedAt: '2026-10-03T09:03:00.000Z', verificationResults: forgedResults });

    it('is offered once an attempt finished and nobody works the Mission, never while queued, searching or leased', () => {
      const forged = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('forged', { status: 'completed' }), mission: forgedRow, now }));
      expect(forged.searchMore).toEqual({ goalId: 'goal:1' });
      const unsupported = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ verificationResults: [forgedResults[1]] }), now }));
      expect(unsupported.phase).toBe('verified_unsupported');
      expect(unsupported.searchMore).toEqual({ goalId: 'goal:1' });
      const leased = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: row({ verificationResults: [forgedResults[1]], leaseExpiresAt: '2026-10-03T10:05:00.000Z' }), now }));
      expect(leased.searchMore).toBeUndefined();
      const queued = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('queued', { status: 'queued' }), mission: row({ status: 'queued', executionPhase: 'queued', searchCandidates: undefined }), now }));
      expect(queued.searchMore).toBeUndefined();
      const searching = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('investigating'), mission: row({ executionPhase: 'investigating', searchCandidates: undefined }), now }));
      expect(searching.searchMore).toBeUndefined();
      expect(mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('forged', { status: 'completed' }), now })).searchMore).toBeUndefined();
    });

    it('shows the kept attempt\'s SUPPORT and Evidence apart, without adding them to the new attempt\'s counters', () => {
      const prior = [{
        startedAt: '2026-10-03T09:00:00.000Z', status: 'completed', executionPhase: 'forged',
        searchCandidates: candidates.map(({ id, url, title, status }) => ({ id, url, title, status })),
        verificationResults: forgedResults,
      }];
      const newCandidate = { id: 'n1', url: 'https://new.example/taladro', title: 'Hermes: nuevo', status: 'pending_verification' };
      const current = row({ status: 'queued', executionPhase: 'queued', searchCandidates: undefined, verificationResults: undefined, priorAttempts: prior, knownSourceUrls: [candidates[0].url] });
      const evidence = { status: 'available' as const, records: records.map((item) => ({ ...item, priorAttempt: true as const })) };
      const queued = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('queued', { status: 'queued' }), mission: current, evidence, opportunities: [find], now }));
      expect(queued.counts).toEqual({ sources: 0, read: 0, evidence: 0, supported: 0 });
      expect(queued.prior).toMatchObject({ attempts: 1, supported: 1, evidence: 2 });
      expect(queued.prior?.sources.map((item) => [item.url, item.state, item.priorAttempt])).toEqual([
        [candidates[0].url, 'supported', true],
        [candidates[1].url, 'unsupported', true],
      ]);
      expect(queued.prior?.sources[0]).toMatchObject({ findTitle: 'Taladro percutor 18 V — Tools', quote: 'Taladro percutor 18 V por 109,90 €' });
      expect(queued.summary).toContain('Intentos anteriores: 2 Evidence y 1 con SUPPORT, conservados.');

      // The new attempt brings a new page and the earlier one again: the earlier one shows once, in the current attempt.
      const again = row({ searchCandidates: [newCandidate, { ...candidates[1] }], verificationResults: [
        { candidateId: 'n1', status: 'verified', evidenceId: 'e9', sourceUrl: newCandidate.url, supported: true },
        { candidateId: 'c2', status: 'verified', evidenceId: 'e2', sourceUrl: candidates[1].url, supported: false, supportReason: 'insufficient_term_coverage' },
      ], priorAttempts: prior });
      const withNew = { status: 'available' as const, records: [{ ...records[0], id: 'e9', candidateId: 'n1', sourceUrl: newCandidate.url }, records[1], { ...records[0], priorAttempt: true as const }] };
      const verifying = mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('verifying'), mission: again, evidence: withNew, opportunities: [find], now }));
      expect(verifying.counts).toEqual({ sources: 2, read: 2, evidence: 2, supported: 1 });
      expect(verifying.prior?.sources.map((item) => item.url)).toEqual([candidates[0].url]);
    });

    it('has no prior section for a Mission that never searched more', () => {
      expect(mission(buildForgeModel({ connected: true, kernelOnline: true, surface: surface('forged', { status: 'completed' }), mission: forgedRow, now })).prior).toBeUndefined();
    });
  });
});

describe('run 6 diagnostics: retried attempts and read failures say what happened', () => {
  it('a Kernel retry after a timed-out attempt is labelled "intento N de 3" with the earlier failure', () => {
    const retry = buildForgeModel({ connected: true, kernelOnline: true, surface: surface('investigating'), mission: row({ executionPhase: 'investigating', searchCandidates: [], attempt: 2, lastFailure: { reason: 'Hermes adapter exited with code 1: Hermes one-shot timed out', attempt: 1 } }) }) as ForgeMissionModel;
    expect(retry.phase).toBe('searching');
    expect(retry.phaseLabel).toBe('Buscando candidatos · intento 2 de 3');
    expect(retry.phaseDetail).toBe('El intento anterior falló (Hermes tardó demasiado). Hermes lo vuelve a intentar.');
    const invalid = buildForgeModel({ connected: true, kernelOnline: true, surface: surface('investigating'), mission: row({ executionPhase: 'investigating', searchCandidates: [], attempt: 3, lastFailure: { reason: 'Hermes adapter exited with code 1: Hermes must return { findings: [...] } with at most 20 findings' } }) }) as ForgeMissionModel;
    expect(invalid.phaseDetail).toContain('Hermes devolvió una respuesta inválida');
    const first = buildForgeModel({ connected: true, kernelOnline: true, surface: surface('investigating'), mission: row({ executionPhase: 'investigating', searchCandidates: [], attempt: 1 }) }) as ForgeMissionModel;
    expect(first.phaseLabel).toBe('Buscando candidatos');
  });

  it('bot-protection and private-network read failures read in Spanish', () => {
    expect(readFailureReason('web.read got a bot-protection check page instead of the page content')).toBe('No se pudo leer: el sitio mostró una comprobación anti-bots, no su contenido');
    expect(readFailureReason('Private network URLs are not supported')).toBe('No se pudo leer: la dirección resolvió a una red privada y el Kernel no la lee');
  });
});
