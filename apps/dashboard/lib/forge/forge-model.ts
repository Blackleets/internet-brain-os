import { t } from '../i18n';
import type { MissionSummary, OpportunitySummary } from '../kernel/contracts';
import type { GoalSurface } from '../kernel/goal-surfaces';
import type { MissionEvidenceRecord } from '../kernel/mission-evidence';
import { isKernelSupportedFind } from '../kernel/supported-find';
import { goalSubjectTerms, goalTermsPresent } from './goal-terms';

/**
 * Pure mapping from Kernel read models to the Forge live view.
 *
 * Honesty contract (tests in forge-model.test.ts):
 * - every source is a real Mission search candidate or Kernel verification row;
 * - a quote is shown only when the Kernel Evidence endpoint returned an excerpt for that Evidence;
 *   Hermes candidate snippets are never quoted (a snippet is not Evidence);
 * - per-page "reading now" does not exist: the Kernel reads every candidate before persisting,
 *   so while verifying every pending candidate shares the same mission-level state;
 * - offline / no mission produce explicit states with no sources and no numbers.
 */

export type ForgeEvidenceLoad =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'available'; records: readonly MissionEvidenceRecord[] }
  | { status: 'unavailable' };

export type ForgeInput = {
  connected: boolean;
  /** True between connecting and the first Kernel read: no state is claimed yet. */
  connecting?: boolean;
  kernelOnline: boolean;
  surface?: GoalSurface;
  /** Full /api/agent-missions row for surface.mission.id (searchCandidates + verificationResults). */
  mission?: MissionSummary;
  evidence?: ForgeEvidenceLoad;
  opportunities?: readonly OpportunitySummary[];
  /** Clock for lease checks (ms since epoch); defaults to Date.now(). */
  now?: number;
};

export type ForgeSourceState = 'candidate' | 'read_failed' | 'evidence' | 'supported' | 'unsupported';
export type ForgeQuoteState = 'available' | 'none' | 'loading' | 'unavailable' | 'not_applicable';

export type ForgeSource = {
  id: string;
  url: string;
  host: string;
  path: string;
  state: ForgeSourceState;
  /** Hermes search-candidate title: an unverified locator label, never Evidence. */
  candidateTitle?: string;
  /** Title of the fetched page as stored by the Kernel on the Evidence record. */
  evidenceTitle?: string;
  evidenceId?: string;
  quote?: string;
  quoteTruncatedStart?: boolean;
  quoteTruncatedEnd?: boolean;
  quoteState: ForgeQuoteState;
  reasonCode?: string;
  reason?: string;
  findTitle?: string;
  /** Goal subject terms present in the Kernel Evidence excerpt/title (display mirror, not the verdict). */
  goalTerms?: string[];
  /** From an earlier attempt kept by "Buscar más" (Mission priorAttempts); not counted in this attempt. */
  priorAttempt?: true;
};

/**
 * What earlier attempts of this Mission left (Kernel priorAttempts, kept by "Buscar más"): only
 * pages the Kernel read. Never added to the current attempt's counters.
 */
export type ForgePriorAttempts = {
  attempts: number;
  sources: ForgeSource[];
  evidence: number;
  supported: number;
};

export type ForgePhase =
  | 'waiting_agent'
  | 'queued'
  | 'searching'
  | 'verifying'
  | 'read_failed_all'
  | 'verified_unsupported'
  | 'forged'
  | 'research_completed'
  | 'completed_empty'
  | 'completed_without_evidence'
  | 'failed'
  | 'blocked';

export type ForgeStepState = 'pending' | 'active' | 'done' | 'gold' | 'failed' | 'skipped';
export type ForgeStepId = 'goal' | 'search' | 'read' | 'support' | 'find';
export type ForgeStep = { id: ForgeStepId; label: string; state: ForgeStepState };

export type ForgeCounts = { sources: number; read: number; evidence: number; supported: number };

export type ForgeMissionModel = {
  kind: 'mission';
  missionId: string;
  goalTitle: string;
  phase: ForgePhase;
  phaseLabel: string;
  phaseDetail: string;
  /** active = the Kernel/agent is still working; settled = terminal or waiting on the user. */
  motion: 'active' | 'settled';
  steps: ForgeStep[];
  counts: ForgeCounts;
  sources: ForgeSource[];
  evidenceStatus: ForgeEvidenceLoad['status'];
  summary: string;
  /** Goal subject terms (Goal title + Mission keywords) used for gold highlights. */
  goalTerms: string[];
  /** Mission keywords exactly as the Kernel stored them (scope.keywords). */
  searchKeywords: string[];
  /**
   * What the forge can honestly say about the web search. The exact queries (and per-query result
   * counts) come only from the Mission's display-only `searchTelemetry` (Kernel schema
   * efesto.mission-search-telemetry.v1); without it the forge says Hermes searched "desde el Goal".
   */
  search: { goal: string; keywords: string[]; exactQueries: string[]; runs: ForgeSearchRun[] };
  /**
   * Total results the searches returned: only when every recorded search carries its count.
   * Never inferred from the candidates.
   */
  searchResultCount?: number;
  /**
   * Adapter funnel the Kernel recorded (display-only, in searchTelemetry): how many findings Hermes
   * returned and how many the adapter discarded before the Kernel, by reason. Absent when not recorded.
   */
  findingsFunnel?: ForgeFindingsFunnel;
  /** Kernel timestamp of the moment the current phase started (ISO), when the row has it. */
  phaseSince?: string;
  /** Honest next step for waiting/queued states. */
  nextStep?: string;
  /**
   * Set when the Kernel left the mission read without SUPPORT (or with every read failed) in
   * running/verifying with no live Hermes lease: nothing will move it on its own, so the user may
   * confirm it again through the same Goal mission endpoint the dashboard uses to confirm a Goal.
   */
  relaunch?: { goalId: string };
  /**
   * Set when the Mission finished an attempt and nobody is working it: "Buscar más" confirms a new
   * attempt (mode search_more) that keeps earlier Finds and Evidence and adds to them.
   */
  searchMore?: { goalId: string };
  /** Earlier attempts kept by the Kernel (priorAttempts); absent when there are none. */
  prior?: ForgePriorAttempts;
  /**
   * "Editar Goal" (POST /api/goals/:id/revisions): the confirmed Goal's current text and Kernel
   * revision. `blocked` is set while Hermes holds a live lease (the Kernel refuses the edit then).
   */
  editGoal?: { goalId: string; title: string; revision: number; blocked?: string };
};

export type ForgeModel =
  | { kind: 'offline'; reason: 'not_connected' | 'connecting' | 'kernel_unreachable'; summary: string }
  | { kind: 'empty'; summary: string }
  | ForgeMissionModel;

export const FORGE_STEP_LABELS: Record<ForgeStepId, string> = {
  goal: 'Goal',
  get search() { return t('f.stepSearch'); },
  get read() { return t('f.stepRead'); },
  get support() { return t('f.stepSupport'); },
  get find() { return t('f.stepFind'); },
};

const SUPPORT_REASONS: Record<string, string> = {
  get insufficient_term_coverage() { return t('f.rNotEnough'); },
  get homepage_insufficient_coverage() { return t('f.rHome'); },
  get unique_id_missing() { return t('f.rId'); },
  get no_evidence() { return t('f.rNoText'); },
  get empty_goal() { return t('f.rNoTerms'); },
};

export function buildForgeModel(input: ForgeInput): ForgeModel {
  if (!input.connected) {
    return { kind: 'offline', reason: 'not_connected', summary: t('f.sumOff') };
  }
  if (input.connecting) {
    return { kind: 'offline', reason: 'connecting', summary: t('f.sumConnecting') };
  }
  if (!input.kernelOnline) {
    return { kind: 'offline', reason: 'kernel_unreachable', summary: t('f.sumPaused') };
  }
  const surfaceMission = input.surface?.mission;
  if (!input.surface || !surfaceMission) {
    return { kind: 'empty', summary: t('f.sumReady') };
  }
  const row = input.mission && input.mission.id === surfaceMission.id ? input.mission : undefined;
  const evidence = input.evidence ?? { status: 'idle' as const };
  const sources = buildSources(row, evidence, input.opportunities);
  const counts = countSources(sources, evidence);
  const phase = derivePhase(settledWorkState(surfaceMission.workState, row), Boolean(surfaceMission.blockedReason || blockedOnRow(row)), counts, sources);
  const { label, detail } = phaseCopy(phase, counts, row);
  const goalTitle = input.surface.goal.title || (typeof row?.goalTitle === 'string' ? row.goalTitle : '');
  const searchKeywords = missionKeywords(row);
  const goalTerms = goalSubjectTerms(goalTitle, searchKeywords);
  for (const source of sources) {
    if (source.state !== 'supported' && source.state !== 'unsupported' && source.state !== 'evidence') continue;
    const present = goalTermsPresent([source.quote, source.evidenceTitle], goalTerms);
    if (present.length) source.goalTerms = present;
  }
  const phaseSince = phaseTimestamp(phase, row, surfaceMission);
  const nextStep = NEXT_STEPS[phase];
  const runs = searchTelemetryRuns(row);
  const resultCount = runs.length && runs.every((run) => run.resultCount !== undefined)
    ? runs.reduce((sum, run) => sum + (run.resultCount ?? 0), 0)
    : undefined;
  const funnel = findingsFunnel(row);
  const relaunch = canRelaunch(phase, surfaceMission.status, row, input.now ?? Date.now()) && input.surface.goal.id ? { goalId: input.surface.goal.id } : undefined;
  const searchMore = canSearchMore(phase, surfaceMission.status, row, input.now ?? Date.now()) && input.surface.goal.id ? { goalId: input.surface.goal.id } : undefined;
  const prior = buildPriorAttempts(row, evidence, input.opportunities, sources, goalTerms);
  const editBlocked = goalEditBlock(row, surfaceMission, input.now ?? Date.now());
  const editGoal = input.surface.goal.id ? {
    goalId: input.surface.goal.id,
    title: input.surface.goal.title,
    revision: Number.isInteger(input.surface.goal.revision) && input.surface.goal.revision > 0 ? input.surface.goal.revision : 1,
    ...(editBlocked ? { blocked: editBlocked } : {}),
  } : undefined;
  return {
    kind: 'mission',
    missionId: surfaceMission.id,
    goalTitle,
    phase,
    phaseLabel: label,
    phaseDetail: detail,
    motion: ACTIVE_PHASES.has(phase) ? 'active' : 'settled',
    steps: buildSteps(phase, counts),
    counts,
    sources,
    evidenceStatus: evidence.status,
    goalTerms,
    searchKeywords,
    search: { goal: goalTitle, keywords: searchKeywords, exactQueries: runs.map((run) => run.query), runs },
    ...(resultCount !== undefined ? { searchResultCount: resultCount } : {}),
    ...(funnel ? { findingsFunnel: funnel } : {}),
    ...(phaseSince ? { phaseSince } : {}),
    ...(nextStep ? { nextStep } : {}),
    ...(relaunch ? { relaunch } : {}),
    ...(searchMore ? { searchMore } : {}),
    ...(prior ? { prior } : {}),
    ...(editGoal ? { editGoal } : {}),
    summary: t('f.summary', { label, src: counts.sources, srcW: plural(counts.sources, t('f.sourceW'), t('f.sourcesW')), read: counts.read, readW: plural(counts.read, t('f.readLower'), t('f.readPlural')), ev: counts.evidence, sup: counts.supported, prior: prior ? t('f.summaryPrior', { ev: prior.evidence, sup: prior.supported }) : '' }),
  };
}

const ACTIVE_PHASES = new Set<ForgePhase>(['waiting_agent', 'queued', 'searching', 'verifying']);

/** Presentation only: the Kernel repeats these checks atomically when saving a revision. */
function goalEditBlock(row: MissionSummary | undefined, surface: NonNullable<GoalSurface['mission']>, now: number): string | undefined {
  if (hasLiveLease(row, now)) return t('f.editBusyHermes');
  if (!row) {
    return surface.status === 'running' && surface.workState === 'verifying' && !surface.blockedReason
      ? t('f.editBusyKernel')
      : undefined;
  }
  if (row.status !== 'running' || row.executionPhase !== 'verifying' || row.verificationBlock) return undefined;
  // Mirror settleStrandedVerification: all candidates read without SUPPORT can settle on list.
  // A partial batch or a supported result still awaiting persistence must retain its revision.
  const candidates = arrayOfRows(row.searchCandidates);
  const results = arrayOfRows(row.verificationResults);
  const settledIds = new Set(results.map((result) => result.candidateId));
  const settleable = candidates.length > 0 && results.length > 0
    && !results.some((result) => result.supported === true)
    && candidates.every((candidate) => settledIds.has(candidate.id));
  return settleable ? undefined : t('f.editBusyKernel');
}

function hasLiveLease(row: MissionSummary | undefined, now: number): boolean {
  if (!row || row.status !== 'running') return false;
  const lease = Date.parse(str(row.leaseExpiresAt));
  return Number.isFinite(lease) && lease > now;
}

function canRelaunch(phase: ForgePhase, status: string, row: MissionSummary | undefined, now: number): boolean {
  if (phase !== 'verified_unsupported' && phase !== 'read_failed_all') return false;
  if (status !== 'running' || !row) return false;
  const lease = Date.parse(str(row.leaseExpiresAt));
  return !(Number.isFinite(lease) && lease > now);
}

const SEARCH_MORE_PHASES = new Set<ForgePhase>(['forged', 'research_completed', 'verified_unsupported', 'read_failed_all', 'completed_empty', 'completed_without_evidence', 'failed']);

/**
 * Mirrors the Kernel's search_more gate (display only; the Kernel decides): the Mission is not
 * queued/waiting, has no live lease, and already ran an attempt.
 */
function canSearchMore(phase: ForgePhase, status: string, row: MissionSummary | undefined, now: number): boolean {
  if (!SEARCH_MORE_PHASES.has(phase) || !row) return false;
  if (status === 'queued' || status === 'waiting_for_agent') return false;
  const lease = Date.parse(str(row.leaseExpiresAt));
  if (status === 'running' && Number.isFinite(lease) && lease > now) return false;
  return Boolean(str(row.completedAt) || str(row.verifyingAt) || str(row.failedAt) || arrayOfRows(row.verificationResults).length);
}

const MAX_PRIOR_SOURCES = 20;

/** Pages the Kernel read in earlier attempts (newest attempt first), minus any the current attempt shows. */
function buildPriorAttempts(
  row: MissionSummary | undefined,
  evidence: ForgeEvidenceLoad,
  opportunities: readonly OpportunitySummary[] | undefined,
  current: readonly ForgeSource[],
  goalTerms: readonly string[],
): ForgePriorAttempts | undefined {
  const attempts = arrayOfRows(row?.priorAttempts);
  if (!row || !attempts.length) return undefined;
  const records = evidence.status === 'available' ? evidence.records : [];
  const recordById = new Map(records.map((item) => [item.id, item]));
  const seenUrls = new Set(current.map((item) => item.url));
  const seenEvidence = new Set(current.map((item) => item.evidenceId).filter(Boolean));
  const sources: ForgeSource[] = [];
  for (const attempt of [...attempts].reverse()) {
    for (const result of arrayOfRows(attempt.verificationResults)) {
      if (sources.length >= MAX_PRIOR_SOURCES) break;
      if (str(result.status) !== 'verified') continue;
      const id = str(result.candidateId);
      const url = str(result.sourceUrl);
      const evidenceId = str(result.evidenceId);
      const location = splitUrl(url);
      if (!id || !location || seenUrls.has(url) || (evidenceId && seenEvidence.has(evidenceId))) continue;
      seenUrls.add(url);
      if (evidenceId) seenEvidence.add(evidenceId);
      const source = { ...sourceFrom(`prior:${id}`, url, location, undefined, result, evidence, recordById, row, opportunities), priorAttempt: true as const };
      const present = goalTermsPresent([source.quote, source.evidenceTitle], goalTerms);
      if (present.length) source.goalTerms = present;
      sources.push(source);
    }
  }
  sources.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
  return {
    attempts: attempts.length,
    sources,
    evidence: sources.filter((item) => Boolean(item.evidenceId)).length,
    supported: sources.filter((item) => item.state === 'supported').length,
  };
}

const NEXT_STEPS: Partial<Record<ForgePhase, string>> = {
  waiting_agent: t('f.next1'),
  queued: t('f.next2'),
  searching: t('f.next3'),
  verifying: t('f.next4'),
};

function missionKeywords(row?: MissionSummary): string[] {
  const scope = asRow(row?.scope);
  const raw = Array.isArray(scope?.keywords) ? scope.keywords : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const value = str(item);
    if (!value || value.length > 60 || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push(value);
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * One web page a search returned, as the adapter recorded it in the display-only searchTelemetry
 * (efesto.mission-search-telemetry.v1, Kernel-validated). Display only: it is not a candidate, not
 * Evidence and never SUPPORT; the forge only names it (host + title), it never links or reads it.
 */
export type ForgeSearchResult = { url: string; host: string; title?: string };
export type ForgeSearchRun = { query: string; resultCount?: number; results?: ForgeSearchResult[] };

/** Bounds the dashboard applies again on read (the Kernel enforces the same on write). */
export const SEARCH_RESULTS_PER_RUN = 10;
export const SEARCH_RESULTS_TOTAL = 30;

export const SEARCH_TELEMETRY_SCHEMA = 'efesto.mission-search-telemetry.v1';

export const FUNNEL_DROP_REASONS = ['malformed_url', 'per_domain_cap', 'duplicate', 'other'] as const;
export type ForgeFunnelDropReason = (typeof FUNNEL_DROP_REASONS)[number];
export type ForgeFindingsFunnel = { returned: number; discarded: number; byReason: Partial<Record<ForgeFunnelDropReason, number>> };

/** The findings funnel in the Kernel's telemetry, validated again on read (bounded, adds up). */
function findingsFunnel(row?: MissionSummary): ForgeFindingsFunnel | undefined {
  const telemetry = asRow(row?.searchTelemetry);
  if (!telemetry || telemetry.schemaVersion !== SEARCH_TELEMETRY_SCHEMA || telemetry.displayOnly !== true) return undefined;
  const funnel = asRow(telemetry.funnel);
  const count = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 20;
  if (!funnel || !count(funnel.findingsReturned)) return undefined;
  const dropped = asRow(funnel.dropped) ?? {};
  const byReason: Partial<Record<ForgeFunnelDropReason, number>> = {};
  let discarded = 0;
  for (const [reason, value] of Object.entries(dropped)) {
    if (!(FUNNEL_DROP_REASONS as readonly string[]).includes(reason) || !count(value)) return undefined;
    if (value > 0) byReason[reason as ForgeFunnelDropReason] = value;
    discarded += value;
  }
  if (discarded > funnel.findingsReturned) return undefined;
  return { returned: funnel.findingsReturned, discarded, byReason };
}

/** The searches the Kernel recorded for this attempt (display-only), validated again on read. */
function searchTelemetryRuns(row?: MissionSummary): ForgeSearchRun[] {
  const telemetry = asRow(row?.searchTelemetry);
  if (!telemetry || telemetry.schemaVersion !== SEARCH_TELEMETRY_SCHEMA || telemetry.displayOnly !== true || !Array.isArray(telemetry.searches)) return [];
  const runs: ForgeSearchRun[] = [];
  let total = 0;
  for (const item of telemetry.searches.slice(0, 8)) {
    const search = asRow(item);
    const query = str(search?.query);
    if (!search || !query || query.length > 300) continue;
    const count = search.resultCount;
    const run: ForgeSearchRun = typeof count === 'number' && Number.isInteger(count) && count >= 0 && count <= 1000 ? { query, resultCount: count } : { query };
    const results = searchResults(search.results, Math.min(SEARCH_RESULTS_PER_RUN, run.resultCount ?? SEARCH_RESULTS_PER_RUN, SEARCH_RESULTS_TOTAL - total));
    total += results.length;
    runs.push(results.length ? { ...run, results } : run);
  }
  return runs;
}

/**
 * The pages one search returned, re-validated on read: public http(s) URLs without credentials,
 * bounded, deduplicated, titles decoded and stripped of control characters. Anything else is skipped.
 */
function searchResults(value: unknown, max: number): ForgeSearchResult[] {
  if (!Array.isArray(value) || max <= 0) return [];
  const out: ForgeSearchResult[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (out.length >= max) break;
    const row = asRow(item);
    const url = str(row?.url);
    if (!url || url.length > 2048 || seen.has(url)) continue;
    let parsed: URL;
    try { parsed = new URL(url); } catch { continue; }
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password || !parsed.hostname.includes('.')) continue;
    if (/^\d+(\.\d+){3}$/.test(parsed.hostname) || parsed.hostname.startsWith('[')) continue;
    seen.add(url);
    const raw = str(row?.title).replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim();
    const title = raw ? displayText(raw).slice(0, 160) : '';
    out.push({ url, host: parsed.hostname.replace(/^www\./, ''), ...(title ? { title } : {}) });
  }
  return out;
}

function phaseTimestamp(phase: ForgePhase, row: MissionSummary | undefined, mission: NonNullable<GoalSurface['mission']>): string | undefined {
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = str(row?.[key]);
      if (value && Number.isFinite(Date.parse(value))) return value;
    }
    return undefined;
  };
  switch (phase) {
    case 'waiting_agent':
    case 'queued': return pick('createdAt') ?? mission.createdAt;
    case 'searching': return pick('investigatingAt', 'claimedAt');
    case 'verifying':
    case 'verified_unsupported':
    case 'read_failed_all': return pick('verifyingAt');
    case 'forged':
    case 'research_completed':
    case 'completed_empty':
    case 'completed_without_evidence': return pick('forgedAt', 'completedAt');
    default: return undefined;
  }
}

type Row = Record<string, unknown>;

function buildSources(row: MissionSummary | undefined, evidence: ForgeEvidenceLoad, opportunities?: readonly OpportunitySummary[]): ForgeSource[] {
  if (!row) return [];
  const candidates = arrayOfRows(row.searchCandidates);
  const results = arrayOfRows(row.verificationResults);
  const resultByCandidate = new Map<string, Row>();
  for (const result of results) {
    const id = str(result.candidateId);
    if (id && !resultByCandidate.has(id)) resultByCandidate.set(id, result);
  }
  const records = evidence.status === 'available' ? evidence.records : [];
  const recordById = new Map(records.map((item) => [item.id, item]));
  const sources: ForgeSource[] = [];
  const seen = new Set<string>();
  const push = (id: string, url: string, candidateTitle: string | undefined, result: Row | undefined) => {
    if (seen.has(id)) return;
    const location = splitUrl(url);
    if (!location) return;
    seen.add(id);
    sources.push(sourceFrom(id, url, location, candidateTitle, result, evidence, recordById, row, opportunities));
  };
  for (const candidate of candidates) {
    const id = str(candidate.id);
    const url = str(candidate.url) || str(candidate.sourceUrl);
    if (!id || !url) continue;
    push(id, url, str(candidate.title) || undefined, resultByCandidate.get(id));
  }
  // Verification rows whose candidate list was not published still are real Kernel records.
  for (const result of results) {
    const id = str(result.candidateId);
    const url = str(result.sourceUrl);
    if (!id || !url) continue;
    push(id, url, undefined, result);
  }
  return sources.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
}

const STATE_ORDER: Record<ForgeSourceState, number> = { supported: 0, evidence: 1, unsupported: 2, read_failed: 3, candidate: 4 };

function sourceFrom(
  id: string,
  url: string,
  location: { host: string; path: string },
  candidateTitle: string | undefined,
  result: Row | undefined,
  evidence: ForgeEvidenceLoad,
  recordById: Map<string, MissionEvidenceRecord>,
  row: MissionSummary,
  opportunities?: readonly OpportunitySummary[],
): ForgeSource {
  const base = { id, url, host: location.host, path: location.path, ...(candidateTitle ? { candidateTitle: displayText(candidateTitle) } : {}) };
  if (!result) return { ...base, state: 'candidate', quoteState: 'not_applicable' };
  const status = str(result.status);
  if (status === 'verification_failed') {
    const reasonCode = str(result.reason);
    return { ...base, state: 'read_failed', quoteState: 'not_applicable', ...(reasonCode ? { reasonCode } : {}), reason: readFailureReason(reasonCode) };
  }
  if (status !== 'verified') return { ...base, state: 'candidate', quoteState: 'not_applicable' };
  const evidenceId = str(result.evidenceId);
  const state: ForgeSourceState = result.supported === true ? 'supported' : result.supported === false ? 'unsupported' : 'evidence';
  const record = evidenceId ? recordById.get(evidenceId) : undefined;
  const quoteState: ForgeQuoteState = !evidenceId
    ? 'none'
    : evidence.status === 'available' ? (record?.excerpt ? 'available' : 'none')
      : evidence.status === 'unavailable' ? 'unavailable' : 'loading';
  const reasonCode = str(result.supportReason) || undefined;
  const find = state === 'supported' && evidenceId
    ? opportunities?.find((item) => str(item.evidenceId) === evidenceId && isKernelSupportedFind(item, [row]))
    : undefined;
  return {
    ...base,
    state,
    ...(evidenceId ? { evidenceId } : {}),
    ...(record?.title ? { evidenceTitle: displayText(record.title) } : {}),
    ...(quoteState === 'available' && record?.excerpt ? {
      quote: displayText(record.excerpt.text),
      quoteTruncatedStart: record.excerpt.truncatedStart,
      quoteTruncatedEnd: record.excerpt.truncatedEnd,
    } : {}),
    quoteState,
    ...(state === 'unsupported' ? { reasonCode: reasonCode ?? 'unknown', reason: supportReason(reasonCode) } : {}),
    ...(state === 'supported' ? { reason: t('f.supportReason') } : {}),
    ...(find ? { findTitle: displayText(find.title) } : {}),
  };
}

function countSources(sources: readonly ForgeSource[], evidence: ForgeEvidenceLoad): ForgeCounts {
  const read = sources.filter((item) => item.state === 'supported' || item.state === 'unsupported' || item.state === 'evidence').length;
  const evidenceCount = evidence.status === 'available'
    ? evidence.records.filter((item) => item.priorAttempt !== true).length
    : sources.filter((item) => Boolean(item.evidenceId)).length;
  return {
    sources: sources.length,
    read,
    evidence: evidenceCount,
    supported: sources.filter((item) => item.state === 'supported').length,
  };
}

const LIVE_WORK_STATES = new Set(['waiting_for_agent', 'queued', 'running', 'investigating', 'verifying']);

/**
 * The Mission row (GET /api/agent-missions) can already be settled while the Goal surface read in the
 * same refresh still says it is working. A settled row wins, so no surface keeps a live clock or
 * "intento 3 de 3" after the Kernel settled the Mission.
 */
export function settledWorkState(surfaceWorkState: string, row?: MissionSummary): string {
  if (!row || !LIVE_WORK_STATES.has(surfaceWorkState)) return surfaceWorkState;
  if (row.status === 'failed') return 'failed';
  if (row.status === 'completed') return str(row.executionPhase) === 'forged' ? 'forged' : 'completed';
  return surfaceWorkState;
}

function derivePhase(workState: string, blocked: boolean, counts: ForgeCounts, sources: readonly ForgeSource[]): ForgePhase {
  if (blocked) return 'blocked';
  const failedReads = sources.filter((item) => item.state === 'read_failed').length;
  switch (workState) {
    case 'waiting_for_agent': return 'waiting_agent';
    case 'queued': return 'queued';
    case 'running':
    case 'investigating': return 'searching';
    case 'verifying':
      if (counts.read > 0 && counts.supported === 0) return 'verified_unsupported';
      if (counts.read === 0 && failedReads > 0 && failedReads === counts.sources) return 'read_failed_all';
      return 'verifying';
    case 'forged': return counts.supported > 0 ? 'forged' : 'research_completed';
    case 'completed': return counts.sources === 0 ? 'completed_empty' : 'completed_without_evidence';
    // The Kernel settles a verification without a Find as failed: keep the precise outcome.
    case 'failed':
      if (counts.read > 0 && counts.supported === 0) return 'verified_unsupported';
      if (counts.sources > 0 && failedReads === counts.sources) return 'read_failed_all';
      return 'failed';
    default: return counts.supported > 0 ? 'forged' : 'queued';
  }
}

function phaseCopy(phase: ForgePhase, counts: ForgeCounts, row?: MissionSummary): { label: string; detail: string } {
  switch (phase) {
    case 'waiting_agent': return { label: t('f.waitingHermes'), detail: t('f.waitingHermesCopy') };
    case 'queued': return { label: t('f.queued'), detail: t('f.queuedCopy') };
    case 'searching': {
      // Kernel retry of a failed attempt (bounded): say so instead of one long "Buscando" clock.
      const attempt = Number(row?.attempt);
      const failure = str(asRow(row?.lastFailure)?.reason);
      if (Number.isInteger(attempt) && attempt > 1 && failure) {
        return { label: t('f.searchingAttempt', { n: attempt, max: MAX_MISSION_ATTEMPTS }), detail: t('f.priorFailedRetry', { why: attemptFailureCopy(failure) }) };
      }
      return { label: t('f.searching'), detail: t('f.searchingCopy') };
    }
    case 'verifying': return {
      label: t('f.verifying'),
      detail: counts.sources > 0
        ? t(counts.sources === 1 ? 'f.verifyingOne' : 'f.verifyingN', { n: counts.sources })
        : t('f.verifyingCopy'),
    };
    case 'read_failed_all': return { label: t('f.noRead'), detail: t(counts.sources === 1 ? 'f.noReadOne' : 'f.noReadN', { n: counts.sources }) };
    case 'verified_unsupported':
    case 'research_completed': return {
      label: t('f.readNoSupport'),
      detail: t(counts.read === 1 ? 'f.readNoSupportOne' : 'f.readNoSupportN', { n: counts.read }),
    };
    case 'forged': return {
      label: counts.supported === 1 ? t('f.stepFind') : t('f.findsForged'),
      detail: t(counts.supported === 1 ? 'f.forgedOne' : 'f.forgedN', { n: counts.supported }),
    };
    case 'completed_empty': return { label: t('f.noCandidates'), detail: t('f.noCandidatesCopy') };
    case 'completed_without_evidence': return { label: t('s.endedNoEvidence'), detail: t('f.endedNoEvidenceCopy') };
    case 'failed': {
      const reason = str(asRow(row?.lastFailure)?.reason);
      return { label: t('s.attention'), detail: missionFailureCopy(reason) };
    }
    case 'blocked': return { label: t('f.blocked'), detail: t('f.policyDenied') };
  }
}

function buildSteps(phase: ForgePhase, counts: ForgeCounts): ForgeStep[] {
  const state: Record<ForgeStepId, ForgeStepState> = { goal: 'done', search: 'pending', read: 'pending', support: 'pending', find: 'pending' };
  const searched = counts.sources > 0;
  switch (phase) {
    case 'waiting_agent':
    case 'queued': break;
    case 'blocked': state.search = searched ? 'done' : 'failed'; if (searched) state.read = 'failed'; break;
    case 'searching': state.search = 'active'; break;
    case 'verifying': state.search = 'done'; state.read = 'active'; break;
    case 'read_failed_all': state.search = 'done'; state.read = 'failed'; state.support = 'skipped'; state.find = 'skipped'; break;
    case 'verified_unsupported':
    case 'research_completed': state.search = 'done'; state.read = 'done'; state.support = 'failed'; state.find = 'skipped'; break;
    case 'forged': state.search = 'done'; state.read = 'done'; state.support = 'gold'; state.find = 'gold'; break;
    case 'completed_empty': state.search = 'done'; state.read = 'skipped'; state.support = 'skipped'; state.find = 'skipped'; break;
    case 'completed_without_evidence': state.search = 'done'; state.read = 'failed'; state.support = 'skipped'; state.find = 'skipped'; break;
    case 'failed':
      state.search = searched ? 'done' : 'failed';
      if (searched) state.read = counts.read > 0 ? 'done' : 'failed';
      break;
  }
  return (Object.keys(FORGE_STEP_LABELS) as ForgeStepId[]).map((id) => ({ id, label: FORGE_STEP_LABELS[id], state: state[id] }));
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

/**
 * Some pages store their <title> with HTML entities left encoded (e.g. "&#8212;"). Decode them for
 * display only; React still renders the result as text, so nothing becomes markup.
 */
export function displayText(value: string): string {
  return value.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,8});/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function supportReason(code?: string): string {
  if (!code) return t('f.noSupportNoReason');
  return SUPPORT_REASONS[code] ?? t('f.noSupportCode', { code });
}

/** The Kernel's bounded attempts per Mission (agent-missions MAX_ATTEMPTS). */
const MAX_MISSION_ATTEMPTS = 3;

export function attemptFailureCopy(reason: string): string {
  if (/timed out|timeout/i.test(reason)) return t('f.fTimeout');
  if (/lease expired/i.test(reason)) return t('f.fNotFinished');
  if (/findings|valid JSON/i.test(reason)) return t('f.fInvalid');
  if (/reach Ollama|HTTP \d{3}/i.test(reason)) return t('f.fModel');
  // Raw process diagnostics (exit codes, session ids, stack traces) are not user copy.
  if (/exited with code|session_id|Traceback/i.test(reason)) return t('f.fNoCand');
  return reason.length > 90 ? `${reason.slice(0, 89)}…` : reason;
}

/** Readable Spanish for a Mission that ended failed; never echoes raw process diagnostics. */
export function missionFailureCopy(reason?: string): string {
  if (!reason) return t('f.missionFailed');
  return t('f.missionFailedWhy', { why: attemptFailureCopy(reason) });
}

const HTTP_READ_COPY: Record<string, string> = {
  get '401'() { return t('f.hLogin'); },
  get '403'() { return t('f.hDenied'); },
  get '404'() { return t('f.hGone'); },
  get '410'() { return t('f.hGone'); },
  get '429'() { return t('f.hRate'); },
  get '500'() { return t('f.hServer'); },
  get '502'() { return t('f.hBad'); },
  get '503'() { return t('f.hUnavailable'); },
};

export function readFailureReason(code?: string): string {
  if (!code) return t('f.cantRead');
  const http = code.match(/HTTP\s+(\d{3})/i);
  if (http) return t('f.rHttp', { why: HTTP_READ_COPY[http[1]] ?? t('f.hError'), code: http[1] });
  if (/empty content/i.test(code)) return t('f.rEmpty');
  if (/timeout|timed out|abort/i.test(code)) return t('f.rTimeout');
  if (/bot-protection/i.test(code)) return t('f.rBot');
  if (/private network/i.test(code)) return t('f.rPrivate');
  return t('f.rCode', { code });
}

function blockedOnRow(row?: MissionSummary): boolean {
  return Boolean(row && (asRow(row.automaticBlock) || asRow(row.verificationBlock)));
}

function splitUrl(value: string): { host: string; path: string } | undefined {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    const path = `${parsed.pathname}${parsed.search}`.replace(/\/$/, '');
    return { host: parsed.host.replace(/^www\./, ''), path: path.length > 80 ? `${path.slice(0, 79)}…` : path };
  } catch {
    return undefined;
  }
}

function arrayOfRows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}
function asRow(value: unknown): Row | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : undefined;
}
function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
