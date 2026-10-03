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
   * What the forge can honestly say about the web search: Hermes searches from the Goal, but the
   * Kernel does not publish the exact query string, so `exactQuery` is only set if a Kernel row
   * ever carries one (`searchQueries` / `searchQuery`).
   */
  search: { goal: string; keywords: string[]; exactQueries: string[] };
  /** Kernel timestamp of the moment the current phase started (ISO), when the row has it. */
  phaseSince?: string;
  /** Honest next step for waiting/queued states. */
  nextStep?: string;
};

export type ForgeModel =
  | { kind: 'offline'; reason: 'not_connected' | 'connecting' | 'kernel_unreachable'; summary: string }
  | { kind: 'empty'; summary: string }
  | ForgeMissionModel;

export const FORGE_STEP_LABELS: Record<ForgeStepId, string> = {
  goal: 'Goal',
  search: 'Búsqueda web · candidatos',
  read: 'Páginas leídas → Evidence',
  support: 'SUPPORT del Kernel',
  find: 'Find forjado',
};

const SUPPORT_REASONS: Record<string, string> = {
  insufficient_term_coverage: 'La página no cubre suficientes términos del Goal',
  homepage_insufficient_coverage: 'Portada sin cobertura suficiente de los términos del Goal',
  unique_id_missing: 'Falta el identificador exacto que pide el Goal',
  no_evidence: 'La página no tenía texto legible',
  empty_goal: 'El Goal no tiene términos verificables',
};

export function buildForgeModel(input: ForgeInput): ForgeModel {
  if (!input.connected) {
    return { kind: 'offline', reason: 'not_connected', summary: 'Forja apagada: Kernel sin conexión. No se muestran datos de ejemplo.' };
  }
  if (input.connecting) {
    return { kind: 'offline', reason: 'connecting', summary: 'Forja conectando: esperando la primera lectura del Kernel.' };
  }
  if (!input.kernelOnline) {
    return { kind: 'offline', reason: 'kernel_unreachable', summary: 'Forja en pausa: el Kernel no responde. No se muestran datos de ejemplo.' };
  }
  const surfaceMission = input.surface?.mission;
  if (!input.surface || !surfaceMission) {
    return { kind: 'empty', summary: 'Forja lista: no hay misión activa.' };
  }
  const row = input.mission && input.mission.id === surfaceMission.id ? input.mission : undefined;
  const evidence = input.evidence ?? { status: 'idle' as const };
  const sources = buildSources(row, evidence, input.opportunities);
  const counts = countSources(sources, evidence);
  const phase = derivePhase(surfaceMission.workState, Boolean(surfaceMission.blockedReason || blockedOnRow(row)), counts, sources);
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
    search: { goal: goalTitle, keywords: searchKeywords, exactQueries: exactQueries(row) },
    ...(phaseSince ? { phaseSince } : {}),
    ...(nextStep ? { nextStep } : {}),
    summary: `${label}. ${counts.sources} ${plural(counts.sources, 'fuente', 'fuentes')}, ${counts.read} ${plural(counts.read, 'leída', 'leídas')}, ${counts.evidence} Evidence, ${counts.supported} con Kernel SUPPORT.`,
  };
}

const ACTIVE_PHASES = new Set<ForgePhase>(['waiting_agent', 'queued', 'searching', 'verifying']);

const NEXT_STEPS: Partial<Record<ForgePhase, string>> = {
  waiting_agent: 'Siguiente: arranca Hermes; tomará la misión y buscará en la web pública.',
  queued: 'Siguiente: Hermes toma la misión y busca en la web pública. Cada candidato real saldrá como una chispa.',
  searching: 'Siguiente: el Kernel lee cada candidato con web.read y guarda la Evidence.',
  verifying: 'Siguiente: el Kernel decide SUPPORT; lo que respalda el Goal se forja como Find.',
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

function exactQueries(row?: MissionSummary): string[] {
  if (!row) return [];
  const raw = Array.isArray(row.searchQueries) ? row.searchQueries : [row.searchQuery];
  return raw.map((item) => str(item)).filter((item) => item.length > 0 && item.length <= 200).slice(0, 6);
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
    ...(state === 'supported' ? { reason: 'La página leída por el Kernel cubre los términos clave del Goal' } : {}),
    ...(find ? { findTitle: displayText(find.title) } : {}),
  };
}

function countSources(sources: readonly ForgeSource[], evidence: ForgeEvidenceLoad): ForgeCounts {
  const read = sources.filter((item) => item.state === 'supported' || item.state === 'unsupported' || item.state === 'evidence').length;
  const evidenceCount = evidence.status === 'available'
    ? evidence.records.length
    : sources.filter((item) => Boolean(item.evidenceId)).length;
  return {
    sources: sources.length,
    read,
    evidence: evidenceCount,
    supported: sources.filter((item) => item.state === 'supported').length,
  };
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
    case 'failed': return 'failed';
    default: return counts.supported > 0 ? 'forged' : 'queued';
  }
}

function phaseCopy(phase: ForgePhase, counts: ForgeCounts, row?: MissionSummary): { label: string; detail: string } {
  switch (phase) {
    case 'waiting_agent': return { label: 'Esperando a Hermes', detail: 'La misión está confirmada; el agente aún no está conectado.' };
    case 'queued': return { label: 'Misión en cola', detail: 'Confirmada por ti; el Kernel la guarda en cola para Hermes.' };
    case 'searching': return { label: 'Buscando candidatos', detail: 'Hermes explora la web pública. Un candidato no es Evidence.' };
    case 'verifying': return {
      label: 'Verificando fuentes',
      detail: counts.sources > 0
        ? `El Kernel lee ${counts.sources} ${plural(counts.sources, 'candidato', 'candidatos')} con web.read y guarda Evidence al terminar.`
        : 'El Kernel aplica web.read y SUPPORT a los candidatos.',
    };
    case 'read_failed_all': return { label: 'Sin lectura', detail: 'El Kernel no pudo leer ninguna página. Reintentar es seguro.' };
    case 'verified_unsupported':
    case 'research_completed': return {
      label: 'Leídas sin SUPPORT',
      detail: `${counts.read} ${plural(counts.read, 'página leída', 'páginas leídas')}; ninguna respalda el Goal. No se forja ningún Find.`,
    };
    case 'forged': return {
      label: counts.supported === 1 ? 'Find forjado' : 'Finds forjados',
      detail: `${counts.supported} ${plural(counts.supported, 'página pasó', 'páginas pasaron')} Kernel SUPPORT y ${plural(counts.supported, 'quedó forjada como Find', 'quedaron forjadas como Finds')}.`,
    };
    case 'completed_empty': return { label: 'Sin candidatos', detail: 'La búsqueda terminó sin fuentes públicas que verificar.' };
    case 'completed_without_evidence': return { label: 'Terminada sin Evidence', detail: 'El intento terminó sin Evidence forjada.' };
    case 'failed': {
      const reason = str(asRow(row?.lastFailure)?.reason);
      return { label: 'Atención requerida', detail: reason ? `La misión falló: ${reason}` : 'La misión falló.' };
    }
    case 'blocked': return { label: 'Bloqueada', detail: 'La política del Kernel denegó la ejecución automática.' };
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
  if (!code) return 'Sin Kernel SUPPORT (el Kernel no publicó motivo)';
  return SUPPORT_REASONS[code] ?? `Sin Kernel SUPPORT (motivo del Kernel: ${code})`;
}

export function readFailureReason(code?: string): string {
  if (!code) return 'El Kernel no pudo leer la página';
  const http = code.match(/HTTP\s+(\d{3})/i);
  if (http) return `No se pudo leer: HTTP ${http[1]}`;
  if (/empty content/i.test(code)) return 'No se pudo leer: contenido vacío';
  if (/timeout|timed out|abort/i.test(code)) return 'No se pudo leer: tiempo de espera agotado';
  return `No se pudo leer: ${code}`;
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
