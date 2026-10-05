import { InboxError } from './page-context-inbox.mjs';

/**
 * Read-only Evidence-by-Mission projection for the dashboard Forge view.
 *
 * Returns only Evidence the Kernel itself persisted for this Mission (web.read verification),
 * joined with the Kernel's own verificationResults row (SUPPORT decision + reason). It never
 * returns the full page text: each record carries one bounded, whitespace-normalized verbatim
 * excerpt of the stored Evidence text so the UI can quote real Evidence instead of inventing it.
 * Hermes candidate snippets are never used as an excerpt (a snippet is not Evidence).
 */
export const MISSION_EVIDENCE_SCHEMA_VERSION = 'efesto.mission-evidence.v1';
export const MAX_MISSION_EVIDENCE_RECORDS = 20;
export const MAX_EVIDENCE_EXCERPT_CHARS = 280;
const EXCERPT_LEAD_CHARS = 60;
const MIN_ANCHOR_TERM_CHARS = 4;
const MAX_ANCHOR_TERMS = 24;

export class MissionEvidenceReader {
  constructor(store) {
    if (!store || typeof store.read !== 'function') throw new TypeError('MissionEvidenceReader requires a readable store');
    this.store = store;
  }

  async list(missionId) {
    if (typeof missionId !== 'string' || !missionId.trim() || missionId.length > 200) {
      throw new InboxError('INVALID_MISSION_ID', 'Mission id is invalid', 400);
    }
    const data = await this.store.read();
    const missions = Array.isArray(data?.agentMissions) ? data.agentMissions : [];
    const mission = missions.find((item) => item?.id === missionId);
    if (!mission) throw new InboxError('AGENT_MISSION_NOT_FOUND', 'Agent mission was not found', 404);
    const evidenceById = new Map();
    for (const item of Array.isArray(data?.evidence) ? data.evidence : []) {
      if (item && typeof item.id === 'string') evidenceById.set(item.id, item);
    }
    const goal = (Array.isArray(data?.goals) ? data.goals : []).find((item) => item?.id === mission.goalId);
    const terms = anchorTerms(goal, mission);
    // Current attempt first, then the attempts kept by "Buscar más" (marked priorAttempt).
    const current = Array.isArray(mission.verificationResults) ? mission.verificationResults : [];
    const prior = (Array.isArray(mission.priorAttempts) ? mission.priorAttempts : [])
      .slice().reverse()
      .flatMap((attempt) => (Array.isArray(attempt?.verificationResults) ? attempt.verificationResults : []).map((result) => ({ result, prior: true })));
    const results = [...current.map((result) => ({ result, prior: false })), ...prior];
    const records = [];
    const seen = new Set();
    for (const { result, prior: fromPriorAttempt } of results) {
      if (records.length >= MAX_MISSION_EVIDENCE_RECORDS) break;
      if (!result || result.status !== 'verified' || typeof result.evidenceId !== 'string') continue;
      if (seen.has(result.evidenceId)) continue;
      const evidence = evidenceById.get(result.evidenceId);
      // Fail closed: only Evidence the Kernel linked to this Mission is projected.
      if (!evidence || evidence.missionId !== mission.id) continue;
      seen.add(result.evidenceId);
      const record = projectEvidence(evidence, result, terms);
      records.push(fromPriorAttempt ? { ...record, priorAttempt: true } : record);
    }
    return {
      schemaVersion: MISSION_EVIDENCE_SCHEMA_VERSION,
      sourceOfTruth: 'kernel',
      missionId: mission.id,
      evidence: records,
      limits: { maxRecords: MAX_MISSION_EVIDENCE_RECORDS, maxExcerptChars: MAX_EVIDENCE_EXCERPT_CHARS },
    };
  }
}

function projectEvidence(evidence, result, terms) {
  const record = {
    id: evidence.id,
    candidateId: safeText(typeof evidence.candidateId === 'string' ? evidence.candidateId : result.candidateId, 200),
    ...(typeof evidence.caseId === 'string' ? { caseId: evidence.caseId } : {}),
    sourceUrl: safeText(evidence.sourceUrl, 2048),
    title: safeText(evidence.summary, 240),
    capturedAt: safeText(evidence.capturedAt, 40),
    ...(typeof evidence.contentHash === 'string' ? { contentHash: safeText(evidence.contentHash, 128) } : {}),
    ...(typeof evidence.extractionMethod === 'string' ? { extractionMethod: safeText(evidence.extractionMethod, 80) } : {}),
    supported: result.supported === true,
    ...(typeof result.supportReason === 'string' ? { supportReason: safeText(result.supportReason, 80) } : {}),
    excerpt: excerptFrom(typeof evidence.rawText === 'string' ? evidence.rawText : '', terms, { title: evidence.summary }),
  };
  return record;
}

/**
 * Verbatim excerpt (whitespace collapsed, control characters removed) or null when no text was stored.
 * Picks the sentence that covers the most distinct goal terms, preferring prose-sized sentences over
 * long navigation/boilerplate runs, then extends to following sentences up to the size limit.
 * It never rewrites or summarises the stored text.
 */
export function excerptFrom(rawText, terms = [], options = {}) {
  const text = String(rawText ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || !looksReadable(text)) return null;
  const sentences = splitSentences(text);
  const pageTitle = typeof options.title === 'string' && options.title.trim().length >= 8 ? fold(options.title.replace(/\s+/g, ' ').trim()) : '';
  let best;
  for (const sentence of sentences) {
    const folded = fold(sentence.text);
    let distinct = 0;
    let firstHit = -1;
    for (const term of terms) {
      const index = folded.indexOf(term);
      if (index < 0) continue;
      distinct += 1;
      if (firstHit < 0 || index < firstHit) firstHit = index;
    }
    if (distinct === 0) continue;
    const length = sentence.text.length;
    const tokens = sentence.text.split(' ');
    // Menus and page chrome read as long runs of Capitalised Words; real prose rarely does.
    // The page <title> repeated in the text marks the header/navigation block, not content.
    const boilerplate = maxCapitalisedRun(tokens) >= 4 || (pageTitle !== '' && folded.includes(pageTitle));
    const prose = !boilerplate && length >= 40 && length <= 360 && tokens.length >= 6 ? 2 : 0;
    const declarative = /[.!]$/.test(sentence.text) ? 1 : 0;
    const score = distinct * (boilerplate ? 2 : 4) + prose + declarative;
    if (!best || score > best.score) best = { ...sentence, score, firstHit };
  }
  let start = 0;
  // Short Evidence fits whole: quote it all instead of cutting into it.
  if (best && text.length > MAX_EVIDENCE_EXCERPT_CHARS) {
    start = best.start;
    if (best.text.length > MAX_EVIDENCE_EXCERPT_CHARS && best.firstHit > EXCERPT_LEAD_CHARS) {
      // Long run: keep the first goal term in view, cut on a word boundary.
      start = best.start + best.firstHit - EXCERPT_LEAD_CHARS;
      const space = text.indexOf(' ', start);
      if (space >= 0 && space < best.start + best.firstHit) start = space + 1;
    }
  }
  let end = Math.min(text.length, start + MAX_EVIDENCE_EXCERPT_CHARS);
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    if (space > start + MAX_EVIDENCE_EXCERPT_CHARS / 2) end = space;
  }
  return {
    text: text.slice(start, end).trim(),
    anchor: best ? 'goal_term' : 'start',
    truncatedStart: start > 0,
    truncatedEnd: end < text.length,
  };
}

function maxCapitalisedRun(tokens) {
  let run = 0;
  let max = 0;
  for (const token of tokens) {
    if (/^\p{Lu}/u.test(token)) { run += 1; if (run > max) max = run; } else run = 0;
  }
  return max;
}

/** Undecoded binary (e.g. a compressed body stored as text) must never be quoted as Evidence. */
function looksReadable(text) {
  const sample = text.slice(0, 4000);
  let bad = 0;
  for (const char of sample) if (char === '\ufffd') bad += 1;
  return bad / Math.max(1, sample.length) < 0.02;
}

function splitSentences(text) {
  const sentences = [];
  const pattern = /[^.!?]*(?:[.!?]+|$)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match[0].length === 0) { pattern.lastIndex += 1; continue; }
    const raw = match[0];
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed) sentences.push({ start: match.index + lead, text: trimmed });
    if (sentences.length >= 400) break;
  }
  return sentences;
}

function anchorTerms(goal, mission) {
  const sources = [];
  if (Array.isArray(goal?.keywords)) sources.push(...goal.keywords);
  if (Array.isArray(mission?.scope?.keywords)) sources.push(...mission.scope.keywords);
  sources.push(goal?.title, mission?.goalTitle);
  const terms = [];
  const seen = new Set();
  for (const value of sources) {
    if (typeof value !== 'string') continue;
    for (const token of fold(value).match(/[a-z0-9]+/g) ?? []) {
      if (token.length < MIN_ANCHOR_TERM_CHARS || seen.has(token)) continue;
      seen.add(token);
      terms.push(token);
      if (terms.length >= MAX_ANCHOR_TERMS) return terms;
    }
  }
  return terms;
}

function fold(value) {
  return String(value).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function safeText(value, max) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '';
}
