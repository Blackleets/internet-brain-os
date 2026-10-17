// OFFLINE evaluation harness: current Efesto candidate ranking vs Jev (TypeSafe AI).
//
// This module is NOT product code. It must never be imported by apps/** or
// packages/** (enforced by scripts/eval/eval-isolation-guard.test.mjs). It only
// READS product modules to score labelled fixture cases; it never writes to the
// Kernel store, never touches packages/kernel/src/evidence/support.ts, and never
// sends anything over the network unless the CLI is given --allow-network AND a
// JEV_API_KEY. Jev numbers are only ever taken from real HTTP responses: a
// skipped, failed or malformed call is reported as such, never filled in.

import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { scanHermesSensitiveData } from '../hermes-sensitive-data-scan-core.mjs';

export const DATASET_SCHEMA_VERSION = 'efesto.eval.ranking-case.v1';
export const DEFAULT_CAPTURED_AT = '2026-08-09T22:19:00.000Z';
export const DEFAULT_K_VALUES = Object.freeze([1, 3, 5]);
export const GOAL_MODES = Object.freeze(['raw', 'goal-manager', 'stored']);
export const LABEL_SOURCES = Object.freeze(['repo-test-assertion', 'human']);

// ---------------------------------------------------------------------------
// Jev endpoint configuration (env driven; nothing is hard-wired to a reseller)
// ---------------------------------------------------------------------------

/** Official TypeSafe System One endpoint (docs.typesafe.ai/api). */
export const DEFAULT_JEV_BASE_URL = 'https://api.typesafe.ai';
export const DEFAULT_JEV_MODEL = 'jev-1.13.0';
export const GATEWAY_JEV_MODEL = 'typesafe-ai/jev';
/** Rough budget guard: Jev allows 32k tokens for state + longest question. */
export const JEV_STATE_TOKEN_BUDGET = 30_000;

export const JEV_QUESTIONS = Object.freeze({
  relevant: Object.freeze({
    type: 'noul',
    instructions: 'This page provides evidence relevant to the Goal',
  }),
  relevance: Object.freeze({
    type: 'score',
    instructions: 'Rate from 1 to 5 how relevant this page is as evidence for the Goal.',
    criteria: Object.freeze([
      '1 - unrelated to the Goal',
      '2 - same broad topic, but no evidence for the Goal',
      '3 - partially relevant; weak or indirect evidence for the Goal',
      '4 - relevant evidence for the Goal',
      '5 - directly provides evidence that answers or satisfies the Goal',
    ]),
  }),
});

/**
 * Resolve where/how Jev would be called. Returns no secret material except
 * `apiKey`, which callers must never log or write to a report.
 */
export function resolveJevConfig(env = process.env) {
  const baseUrl = String(env.JEV_BASE_URL || DEFAULT_JEV_BASE_URL).replace(/\/+$/, '');
  let host = '';
  try { host = new URL(baseUrl).host; } catch { host = ''; }
  const route = host === 'ai-gateway.vercel.sh'
    ? 'vercel-ai-gateway'
    : host === 'api.typesafe.ai'
      ? 'typesafe-official'
      : /(^|\.)jevtypesafeai\.com$/.test(host)
        ? 'jevtypesafeai-reseller'
        : 'custom';
  const path = env.JEV_DECIDE_PATH || (route === 'jevtypesafeai-reseller' ? '/v1/decide' : '/v1/systemone');
  const model = env.JEV_MODEL || (route === 'vercel-ai-gateway' ? GATEWAY_JEV_MODEL : DEFAULT_JEV_MODEL);
  const envPrice = env.JEV_PRICE_PER_MTOK_USD === undefined || env.JEV_PRICE_PER_MTOK_USD === ''
    ? undefined : Number(env.JEV_PRICE_PER_MTOK_USD);
  // Only published list prices are defaulted; anything else stays null (unknown).
  const pricePerMTokUsd = Number.isFinite(envPrice)
    ? envPrice
    : route === 'vercel-ai-gateway' ? 0.042 : null;
  const priceSource = Number.isFinite(envPrice)
    ? 'env:JEV_PRICE_PER_MTOK_USD'
    : route === 'vercel-ai-gateway' ? 'vercel.com/ai-gateway/models/jev list price' : 'unknown (set JEV_PRICE_PER_MTOK_USD)';
  const apiKey = typeof env.JEV_API_KEY === 'string' && env.JEV_API_KEY.trim() ? env.JEV_API_KEY.trim() : '';
  return {
    baseUrl, host, route, path, url: `${baseUrl}${path}`, model,
    pricePerMTokUsd, priceSource,
    hasKey: Boolean(apiKey), apiKey,
    resellerWarning: route === 'jevtypesafeai-reseller'
      ? 'jevtypesafeai.com describes itself as a hosted self-serve route, not TypeSafe\'s official API'
      : undefined,
  };
}

/**
 * Decide whether Jev may run. Both an explicit --allow-network flag and a key
 * are required. Returns a human readable reason when skipped.
 */
export function jevRunDecision({ allowNetwork, hasKey }) {
  if (!hasKey) return { run: false, status: 'not_run', reason: 'no key' };
  if (!allowNetwork) return { run: false, status: 'not_run', reason: '--allow-network not given' };
  return { run: true, status: 'run', reason: 'key present and --allow-network given' };
}

// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------

export class DatasetError extends Error {}

export function parseJsonl(text, source = '<memory>') {
  const cases = [];
  const lines = String(text).split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) return;
    let parsed;
    try { parsed = JSON.parse(trimmed); } catch (error) {
      throw new DatasetError(`${source}:${index + 1}: invalid JSON (${error.message})`);
    }
    cases.push(validateCase(parsed, `${source}:${index + 1}`));
  });
  const seen = new Set();
  for (const item of cases) {
    if (seen.has(item.id)) throw new DatasetError(`${source}: duplicate case id ${item.id}`);
    seen.add(item.id);
  }
  return cases;
}

export async function loadDataset(paths) {
  const all = [];
  for (const path of paths) {
    all.push(...parseJsonl(await readFile(path, 'utf8'), path));
  }
  const seen = new Set();
  for (const item of all) {
    if (seen.has(item.id)) throw new DatasetError(`duplicate case id across datasets: ${item.id}`);
    seen.add(item.id);
  }
  return all;
}

function isStringArray(value) { return Array.isArray(value) && value.every((item) => typeof item === 'string'); }

export function validateCase(value, where = '<case>') {
  const fail = (message) => { throw new DatasetError(`${where}: ${message}`); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('case must be an object');
  if (value.schemaVersion !== DATASET_SCHEMA_VERSION) fail(`schemaVersion must be ${DATASET_SCHEMA_VERSION}`);
  if (typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,120}$/.test(value.id)) fail('id must be a lowercase slug');
  const goal = value.goal;
  if (!goal || typeof goal !== 'object' || typeof goal.title !== 'string' || !goal.title.trim()) fail('goal.title is required');
  if (goal.keywords !== undefined && !isStringArray(goal.keywords)) fail('goal.keywords must be string[]');
  if (goal.categories !== undefined && !isStringArray(goal.categories)) fail('goal.categories must be string[]');
  if (!GOAL_MODES.includes(value.goalMode)) fail(`goalMode must be one of ${GOAL_MODES.join(', ')}`);
  const page = value.page;
  if (!page || typeof page !== 'object' || Array.isArray(page)) fail('page must be an object (may be empty for "no evidence" cases)');
  for (const field of ['title', 'excerpt', 'url', 'text', 'fetchedAt']) {
    if (page[field] !== undefined && typeof page[field] !== 'string') fail(`page.${field} must be a string`);
  }
  if (page.paddingSuffix !== undefined) {
    const pad = page.paddingSuffix;
    if (!pad || typeof pad.char !== 'string' || pad.char.length !== 1 || !Number.isInteger(pad.count) || pad.count < 1 || pad.count > 100_000) {
      fail('page.paddingSuffix must be {char: 1 char, count: 1..100000, separator?: string}');
    }
  }
  if (!value.label || typeof value.label.relevant !== 'boolean') fail('label.relevant must be a boolean (no unlabeled cases)');
  if (value.label.graded !== undefined && value.label.graded !== null
    && !(Number.isInteger(value.label.graded) && value.label.graded >= 1 && value.label.graded <= 5)) {
    fail('label.graded must be null or an integer 1-5');
  }
  if (!LABEL_SOURCES.includes(value.labelSource)) fail(`labelSource must be one of ${LABEL_SOURCES.join(', ')}`);
  if (typeof value.circular !== 'boolean') fail('circular must be a boolean (true when the label is an assertion on the current ranker\'s own output)');
  if (!Array.isArray(value.provenance) || !value.provenance.length) fail('provenance must list at least one source');
  for (const [index, entry] of value.provenance.entries()) {
    if (!entry || typeof entry.file !== 'string' || !entry.file.trim()) fail(`provenance[${index}].file is required`);
    if (typeof entry.test !== 'string' || !entry.test.trim()) fail(`provenance[${index}].test is required`);
    if (typeof entry.assertion !== 'string' || !entry.assertion.trim()) fail(`provenance[${index}].assertion is required`);
    if (entry.snippets !== undefined && !isStringArray(entry.snippets)) fail(`provenance[${index}].snippets must be string[]`);
  }
  if (value.labelSource === 'human' && (typeof value.labeledBy !== 'string' || !value.labeledBy.trim())) {
    fail('human labels require labeledBy');
  }
  return value;
}

/** Materialise the page exactly as the fixture constructs it. */
export function materializePage(page) {
  const text = page.paddingSuffix
    ? `${page.text ?? ''}${page.paddingSuffix.separator ?? '\n'}${page.paddingSuffix.char.repeat(page.paddingSuffix.count)}`
    : page.text;
  const result = {};
  for (const field of ['title', 'excerpt', 'url']) if (page[field] !== undefined) result[field] = page[field];
  if (text !== undefined) result.text = text;
  return result;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

function round(value, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Expected precision@k / recall@k under uniformly random tie-breaking, so a
 * binary ranker is not flattered (or punished) by input order.
 * items: [{ score: number, label: 0|1 }]
 */
export function precisionRecallAtK(items, k) {
  const n = items.length;
  const positives = items.filter((item) => item.label === 1).length;
  if (!n || k < 1) return { k, precision: null, recall: null };
  const groups = new Map();
  for (const item of items) {
    const key = item.score;
    const group = groups.get(key) ?? { size: 0, positives: 0 };
    group.size += 1;
    group.positives += item.label === 1 ? 1 : 0;
    groups.set(key, group);
  }
  const ordered = [...groups.entries()].sort((left, right) => right[0] - left[0]).map(([, group]) => group);
  const depth = Math.min(k, n);
  let remaining = depth;
  let expectedHits = 0;
  for (const group of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(group.size, remaining);
    expectedHits += take * (group.positives / group.size);
    remaining -= take;
  }
  return {
    k,
    precision: expectedHits / depth,
    recall: positives ? expectedHits / positives : null,
  };
}

/** ROC-AUC via Mann-Whitney U with ties counted as 0.5. null if one class is absent. */
export function rocAuc(items) {
  const pos = items.filter((item) => item.label === 1).map((item) => item.score);
  const neg = items.filter((item) => item.label === 0).map((item) => item.score);
  if (!pos.length || !neg.length) return null;
  let wins = 0;
  for (const p of pos) {
    for (const q of neg) {
      if (p > q) wins += 1;
      else if (p === q) wins += 0.5;
    }
  }
  return wins / (pos.length * neg.length);
}

/** Brier score over probabilities in [0,1]. */
export function brierScore(items) {
  if (!items.length) return null;
  return items.reduce((sum, item) => sum + ((item.probability - item.label) ** 2), 0) / items.length;
}

/** Expected calibration error with equal-width bins over [0,1]. */
export function expectedCalibrationError(items, bins = 5) {
  if (!items.length) return null;
  const buckets = Array.from({ length: bins }, () => ({ count: 0, confidence: 0, positives: 0 }));
  for (const item of items) {
    const index = Math.min(bins - 1, Math.max(0, Math.floor(item.probability * bins)));
    buckets[index].count += 1;
    buckets[index].confidence += item.probability;
    buckets[index].positives += item.label;
  }
  let ece = 0;
  for (const bucket of buckets) {
    if (!bucket.count) continue;
    ece += (bucket.count / items.length) * Math.abs(bucket.confidence / bucket.count - bucket.positives / bucket.count);
  }
  return ece;
}

export function confusion(items) {
  let tp = 0; let fp = 0; let tn = 0; let fn = 0;
  for (const item of items) {
    if (item.decision && item.label === 1) tp += 1;
    else if (item.decision && item.label === 0) fp += 1;
    else if (!item.decision && item.label === 0) tn += 1;
    else fn += 1;
  }
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  const f1 = precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : null;
  const total = tp + fp + tn + fn;
  return { tp, fp, tn, fn, precision, recall, f1, accuracy: total ? (tp + tn) / total : null };
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export function latencySummary(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return { n: 0, meanMs: null, p50Ms: null, p95Ms: null, maxMs: null };
  return {
    n: sorted.length,
    meanMs: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length, 3),
    p50Ms: round(percentile(sorted, 50), 3),
    p95Ms: round(percentile(sorted, 95), 3),
    maxMs: round(sorted[sorted.length - 1], 3),
  };
}

/**
 * results: [{ caseId, label: 0|1, score, probability, decision, latencyMs, costUsd }]
 * Only answered cases are passed in; callers report coverage separately.
 */
export function computeMetrics(results, { kValues = DEFAULT_K_VALUES, calibrated = true } = {}) {
  const items = results.map((item) => ({ ...item, label: item.label ? 1 : 0 }));
  const positives = items.filter((item) => item.label === 1).length;
  const atK = kValues.map((k) => {
    const value = precisionRecallAtK(items, k);
    return { k, precision: round(value.precision), recall: round(value.recall) };
  });
  const decision = confusion(items);
  const costs = items.map((item) => item.costUsd).filter((value) => Number.isFinite(value));
  return {
    n: items.length,
    positives,
    negatives: items.length - positives,
    atK,
    decision: {
      ...decision,
      precision: round(decision.precision),
      recall: round(decision.recall),
      f1: round(decision.f1),
      accuracy: round(decision.accuracy),
    },
    rocAuc: round(rocAuc(items)),
    brier: round(brierScore(items)),
    ece5: round(expectedCalibrationError(items, 5)),
    probabilitiesCalibrated: calibrated,
    latency: latencySummary(items.map((item) => item.latencyMs)),
    cost: {
      knownCases: costs.length,
      totalUsd: costs.length ? round(costs.reduce((sum, value) => sum + value, 0), 8) : null,
      perCaseUsd: costs.length ? round(costs.reduce((sum, value) => sum + value, 0) / costs.length, 10) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Current rankers (read-only use of product modules)
// ---------------------------------------------------------------------------

/**
 * Load the real Kernel SUPPORT gate from packages/kernel/src/evidence/support.ts
 * without modifying or building it: transpile the file in memory with the
 * repo's TypeScript and import it as a data: module. support.ts has no imports.
 */
export async function loadEvidenceSupportsGoal(supportUrl = new URL('../../packages/kernel/src/evidence/support.ts', import.meta.url)) {
  const source = await readFile(supportUrl, 'utf8');
  if (/^\s*import\s/m.test(source)) throw new Error('support.ts gained imports; update the eval loader');
  const ts = (await import('typescript')).default;
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: 'support.ts',
  }).outputText;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
  if (typeof mod.evidenceSupportsGoal !== 'function') throw new Error('support.ts no longer exports evidenceSupportsGoal');
  return mod.evidenceSupportsGoal;
}

export async function loadProductRankingModules() {
  const [classifier, goals, ranking, enrichment, inbox] = await Promise.all([
    import('../../apps/local-kernel/opportunity-classifier.mjs'),
    import('../../apps/local-kernel/goals.mjs'),
    import('../../apps/local-kernel/opportunity-ranking.mjs'),
    import('../../apps/local-kernel/goal-intent-enrichment.mjs'),
    import('../../apps/local-kernel/page-context-inbox.mjs'),
  ]);
  return {
    classifyOpportunity: classifier.classifyOpportunity,
    matchOpportunityToGoals: goals.matchOpportunityToGoals,
    rankOpportunity: ranking.rankOpportunity,
    enrichGoalIntent: enrichment.enrichGoalIntent,
    maxVisibleText: inbox.MAX_PAGE_CONTEXT_VISIBLE_TEXT,
  };
}

/** Goal as handed to evidenceSupportsGoal for this case (mirrors the fixture). */
export function supportGoalFor(testCase, modules) {
  const { goal } = testCase;
  if (testCase.goalMode === 'goal-manager') {
    const intent = modules.enrichGoalIntent({ title: goal.title, categories: goal.categories ?? [], keywords: goal.keywords ?? [], keywordLimit: 12 });
    return { title: goal.title, keywords: intent.keywords };
  }
  return { title: goal.title, keywords: goal.keywords ?? [] };
}

/** Goal as stored in the Kernel and used by matchOpportunityToGoals / mission scope. */
export function rankingGoalFor(testCase, modules) {
  const { goal } = testCase;
  if (testCase.goalMode === 'stored') {
    return {
      id: `goal:eval:${testCase.id}`, title: goal.title, categories: goal.categories ?? [], keywords: goal.keywords ?? [],
      location: goal.location, priority: goal.priority ?? 2, status: 'active',
    };
  }
  const intent = modules.enrichGoalIntent({ title: goal.title, categories: goal.categories ?? [], keywords: goal.keywords ?? [], keywordLimit: 12 });
  return {
    id: `goal:eval:${testCase.id}`, title: goal.title, categories: intent.categories, keywords: intent.keywords,
    location: goal.location, priority: goal.priority ?? 2, status: 'active',
  };
}

/** Ranker 1: Kernel SUPPORT gate (binary). */
export function scoreKernelSupport(testCase, { evidenceSupportsGoal, modules }) {
  const page = materializePage(testCase.page);
  const result = evidenceSupportsGoal(supportGoalFor(testCase, modules), page);
  return {
    score: result.supported ? 1 : 0,
    probability: result.supported ? 1 : 0,
    decision: result.supported === true,
    detail: { reason: result.reason },
  };
}

/**
 * Ranker 2: the full current Find pipeline, mirroring
 * MissionSearchCandidateVerifier#projectVerified -> projectVerifiedDocument ->
 * OpportunityProjector.list: SUPPORT gate, regex classification, mission scope
 * check, then rankOpportunity(personalizedRelevance). A page that would not
 * become a Kernel-supported Find scores 0. Score/99 is NOT a calibrated
 * probability; Brier/ECE for this ranker are reported as uncalibrated.
 */
export function scoreFindPipeline(testCase, { evidenceSupportsGoal, modules }) {
  const page = materializePage(testCase.page);
  const support = evidenceSupportsGoal(supportGoalFor(testCase, modules), page);
  if (!support.supported) {
    return { score: 0, probability: 0, decision: false, detail: { stage: 'support_gate', reason: support.reason } };
  }
  const capturedAt = testCase.page.fetchedAt ?? DEFAULT_CAPTURED_AT;
  const text = String(page.text ?? '').trim();
  const projectionText = text.length <= modules.maxVisibleText ? text : `${text.slice(0, modules.maxVisibleText - 1)}…`;
  const fetchedTitle = String(page.title ?? '').trim().slice(0, 240);
  const description = (projectionText || fetchedTitle).slice(0, 500) || undefined;
  const context = {
    schemaVersion: 'hephaestus.page-context.v1',
    url: page.url,
    canonicalUrl: page.url,
    title: fetchedTitle || projectionText.slice(0, 240),
    visibleText: projectionText,
    ...(description ? { description } : {}),
    capturedAt,
  };
  let classified;
  try {
    classified = modules.classifyOpportunity(context, { caseId: `case:eval:${testCase.id}`, evidenceId: `evidence:eval:${testCase.id}` });
  } catch (error) {
    return { score: 0, probability: 0, decision: false, detail: { stage: 'classifier_rejected_input', reason: String(error?.code ?? error?.message ?? error) } };
  }
  if (classified.status !== 'opportunity') {
    return { score: 0, probability: 0, decision: false, detail: { stage: 'not_an_opportunity', classifierScore: classified.score } };
  }
  const goal = rankingGoalFor(testCase, modules);
  if (goal.categories.length && !goal.categories.includes(classified.opportunity.category)) {
    return { score: 0, probability: 0, decision: false, detail: { stage: 'outside_mission_scope', category: classified.opportunity.category } };
  }
  const opportunity = { ...classified.opportunity, supported: true, supportReason: support.reason };
  const goalMatches = modules.matchOpportunityToGoals(opportunity, [goal]);
  const now = new Date(Date.parse(capturedAt) + 60_000).toISOString();
  const ranking = modules.rankOpportunity(opportunity, { goalMatches, learnedAdjustment: 0, now, missions: [] });
  return {
    score: ranking.score,
    probability: Math.max(0, Math.min(1, ranking.score / 99)),
    decision: true,
    detail: { stage: 'find', category: opportunity.category, relevance: opportunity.relevance, goalFit: ranking.components.goalFit, rankingScore: ranking.score },
  };
}

export function runLocalRanker(name, cases, scorer, deps) {
  const results = [];
  for (const testCase of cases) {
    const started = performance.now();
    const outcome = scorer(testCase, deps);
    const latencyMs = performance.now() - started;
    results.push({ caseId: testCase.id, label: testCase.label.relevant ? 1 : 0, latencyMs, costUsd: 0, ...outcome });
  }
  return { name, status: 'run', results };
}

// ---------------------------------------------------------------------------
// Jev client (only used when explicitly allowed)
// ---------------------------------------------------------------------------

export class JevResponseError extends Error {
  constructor(message, details = {}) { super(message); this.details = details; }
}

export function buildJevState(testCase) {
  const page = materializePage(testCase.page);
  const goal = { title: testCase.goal.title };
  if (testCase.goal.keywords?.length) goal.keywords = testCase.goal.keywords;
  return { goal, page };
}

export function buildJevRequest(testCase, config) {
  return { model: config.model, state: buildJevState(testCase), questions: JEV_QUESTIONS };
}

export function estimateTokens(value) {
  return Math.ceil(JSON.stringify(value).length / 4);
}

/**
 * Strictly parse a Jev / TypeSafe System One response. Throws on anything that
 * does not carry real typed answers; never substitutes defaults.
 */
export function parseJevResponse(body, config = {}) {
  if (!body || typeof body !== 'object' || !body.answers || typeof body.answers !== 'object') {
    throw new JevResponseError('response has no answers map');
  }
  const relevant = body.answers.relevant;
  if (!relevant || relevant.type !== 'noul' || typeof relevant.noul !== 'number' || !Number.isFinite(relevant.noul) || relevant.noul < 0 || relevant.noul > 1) {
    throw new JevResponseError('answers.relevant is not a valid noul answer');
  }
  const relevance = body.answers.relevance;
  const levels = JEV_QUESTIONS.relevance.criteria.length;
  if (!relevance || relevance.type !== 'score' || typeof relevance.score !== 'number' || !Number.isFinite(relevance.score)
    || relevance.score < 0 || relevance.score > levels - 1) {
    throw new JevResponseError('answers.relevance is not a valid 0-indexed score answer');
  }
  const usage = body.usage && typeof body.usage === 'object' ? body.usage : {};
  const inputTokens = Number.isFinite(usage.input_tokens) ? usage.input_tokens : null;
  const outputTokens = Number.isFinite(usage.output_tokens) ? usage.output_tokens : null;
  let costUsd = null;
  let costSource = 'unknown';
  if (Number.isFinite(usage.cost_usd)) {
    costUsd = usage.cost_usd; costSource = 'reported:usage.cost_usd';
  } else if (body.provider_metadata?.gateway?.cost !== undefined && Number.isFinite(Number(body.provider_metadata.gateway.cost))) {
    costUsd = Number(body.provider_metadata.gateway.cost); costSource = 'reported:provider_metadata.gateway.cost';
  } else if (inputTokens !== null && Number.isFinite(config.pricePerMTokUsd)) {
    costUsd = (inputTokens / 1_000_000) * config.pricePerMTokUsd; costSource = `estimated:${config.priceSource ?? 'price'}`;
  }
  return {
    model: typeof body.model === 'string' ? body.model : null,
    noul: relevant.noul,
    scoreIndex: relevance.score,
    score1to5: relevance.score + 1,
    scoreProbability: relevance.score / (levels - 1),
    scoreConfidence: Number.isFinite(relevance.confidence) ? relevance.confidence : null,
    inputTokens, outputTokens, costUsd, costSource,
  };
}

const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);

export async function callJev(testCase, config, { fetchImpl = globalThis.fetch, maxRetries = 2, timeoutMs = 30_000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  if (!config.apiKey) throw new Error('callJev requires an API key');
  const request = buildJevRequest(testCase, config);
  const serialized = JSON.stringify(request);
  let attempt = 0;
  let lastError;
  while (attempt <= maxRetries) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = performance.now();
    try {
      const response = await fetchImpl(config.url, {
        method: 'POST',
        headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
        body: serialized,
        signal: controller.signal,
      });
      const latencyMs = performance.now() - started;
      const raw = await response.text();
      if (!response.ok) {
        lastError = { kind: 'http_error', status: response.status, body: raw.slice(0, 300) };
        if (RETRYABLE.has(response.status) && attempt <= maxRetries) { await sleep(500 * (2 ** (attempt - 1))); continue; }
        return { ok: false, attempts: attempt, latencyMs, error: lastError };
      }
      let body;
      try { body = JSON.parse(raw); } catch { return { ok: false, attempts: attempt, latencyMs, error: { kind: 'invalid_json' } }; }
      try {
        return { ok: true, attempts: attempt, latencyMs, answer: parseJevResponse(body, config) };
      } catch (error) {
        return { ok: false, attempts: attempt, latencyMs, error: { kind: 'malformed_response', message: error.message } };
      }
    } catch (error) {
      lastError = { kind: error?.name === 'AbortError' ? 'timeout' : 'network_error', message: String(error?.message ?? error).slice(0, 200) };
      if (attempt <= maxRetries) { await sleep(500 * (2 ** (attempt - 1))); continue; }
      return { ok: false, attempts: attempt, latencyMs: null, error: lastError };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, attempts: attempt, latencyMs: null, error: lastError };
}

/** Pre-send checks: budget + sensitive-data scan + key never inside the state. */
export function preflightJevCase(testCase, config) {
  const request = buildJevRequest(testCase, config);
  const stateTokens = estimateTokens(request.state) + estimateTokens(JEV_QUESTIONS.relevance);
  if (stateTokens > JEV_STATE_TOKEN_BUDGET) return { ok: false, reason: 'state_exceeds_token_budget', estTokens: stateTokens };
  const serializedState = JSON.stringify(request.state);
  if (config.apiKey && serializedState.includes(config.apiKey)) return { ok: false, reason: 'state_contains_api_key', estTokens: stateTokens };
  const findings = scanHermesSensitiveData(serializedState);
  if (findings.length) return { ok: false, reason: `sensitive_data_scan:${[...new Set(findings.map((item) => item.code))].join(',')}`, estTokens: stateTokens };
  return { ok: true, estTokens: estimateTokens(request) };
}

export async function runJev(cases, config, options = {}) {
  const log = options.log ?? (() => {});
  const noulResults = [];
  const scoreResults = [];
  const failures = [];
  let model = null;
  for (const testCase of cases) {
    const preflight = preflightJevCase(testCase, config);
    if (!preflight.ok) { failures.push({ caseId: testCase.id, stage: 'preflight', reason: preflight.reason }); continue; }
    const outcome = await callJev(testCase, config, options);
    if (!outcome.ok) {
      failures.push({ caseId: testCase.id, stage: 'call', attempts: outcome.attempts, error: outcome.error });
      log(`  jev ${testCase.id}: FAILED (${outcome.error?.kind}${outcome.error?.status ? ` ${outcome.error.status}` : ''})`);
      continue;
    }
    const { answer } = outcome;
    model = model ?? answer.model;
    const label = testCase.label.relevant ? 1 : 0;
    const common = { caseId: testCase.id, label, latencyMs: outcome.latencyMs, costUsd: answer.costUsd };
    noulResults.push({ ...common, score: answer.noul, probability: answer.noul, decision: answer.noul >= 0.5, detail: { model: answer.model, costSource: answer.costSource, inputTokens: answer.inputTokens } });
    // Both questions ride in ONE call: latency/cost below are the same shared call, not additive.
    scoreResults.push({ ...common, score: answer.scoreProbability, probability: answer.scoreProbability, decision: answer.score1to5 >= 4, detail: { score1to5: answer.score1to5, confidence: answer.scoreConfidence } });
    log(`  jev ${testCase.id}: noul=${answer.noul.toFixed(3)} score=${answer.score1to5.toFixed(2)}/5`);
  }
  return { model, noulResults, scoreResults, failures };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export function summarizeDataset(cases) {
  const positives = cases.filter((item) => item.label.relevant).length;
  const circular = cases.filter((item) => item.circular).length;
  return {
    total: cases.length,
    positives,
    negatives: cases.length - positives,
    circular,
    nonCircular: cases.length - circular,
    labelSources: Object.fromEntries(LABEL_SOURCES.map((source) => [source, cases.filter((item) => item.labelSource === source).length])),
    provenanceFiles: [...new Set(cases.flatMap((item) => item.provenance.map((entry) => entry.file)))].sort(),
  };
}

function fmt(value, digits = 3) {
  if (value === null || value === undefined) return 'n/a';
  return typeof value === 'number' ? value.toFixed(digits) : String(value);
}

export function renderMarkdown(report) {
  const lines = [];
  lines.push('# Jev ranking bench (offline)');
  lines.push('');
  lines.push(`- generatedAt: ${report.generatedAt}`);
  lines.push(`- commit: ${report.git?.commit ?? 'unknown'}`);
  lines.push(`- dataset: ${report.dataset.total} labelled cases (${report.dataset.positives} relevant / ${report.dataset.negatives} not relevant); ${report.dataset.circular} circular, ${report.dataset.nonCircular} non-circular`);
  lines.push(`- jev: ${report.jev.status === 'run' ? `run (${report.jev.route}, model ${report.jev.model ?? 'unknown'}, ${report.jev.answered}/${report.dataset.total} answered)` : `${report.jev.status.replace('_', ' ')}, ${report.jev.reason}`}`);
  lines.push('- productIntegration: none (offline harness only)');
  lines.push('');
  lines.push('> Circular cases carry labels that are assertions on the current Kernel SUPPORT gate\'s own output in repo tests; the current ranker scoring well on them is a consistency check, not independent accuracy.');
  lines.push('');
  const rankers = report.rankers;
  const kValues = rankers[0]?.subsets?.all?.atK?.map((item) => item.k) ?? [];
  for (const subset of ['all', 'nonCircular']) {
    lines.push(`## Metrics — ${subset === 'all' ? 'all cases' : 'non-circular cases only'}`);
    lines.push('');
    lines.push(`| ranker | status | n | ${kValues.map((k) => `P@${k}`).join(' | ')} | precision | recall | F1 | ROC-AUC | Brier | ECE(5) | calibrated | p50 ms | p95 ms | cost USD |`);
    lines.push(`|---|---|---|${kValues.map(() => '---').join('|')}|---|---|---|---|---|---|---|---|---|---|`);
    for (const ranker of rankers) {
      const metrics = ranker.subsets?.[subset];
      if (!metrics) {
        lines.push(`| ${ranker.name} | ${ranker.status}${ranker.reason ? ` (${ranker.reason})` : ''} | 0 | ${kValues.map(() => 'n/a').join(' | ')} | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`);
        continue;
      }
      lines.push(`| ${ranker.name} | ${ranker.status} | ${metrics.n} | ${metrics.atK.map((item) => fmt(item.precision)).join(' | ')} | ${fmt(metrics.decision.precision)} | ${fmt(metrics.decision.recall)} | ${fmt(metrics.decision.f1)} | ${fmt(metrics.rocAuc)} | ${fmt(metrics.brier)} | ${fmt(metrics.ece5)} | ${metrics.probabilitiesCalibrated ? 'yes' : 'no'} | ${fmt(metrics.latency.p50Ms, 4)} | ${fmt(metrics.latency.p95Ms, 4)} | ${metrics.cost.totalUsd === null ? 'unknown' : fmt(metrics.cost.totalUsd, 8)} |`);
    }
    lines.push('');
  }
  lines.push('## Per-case scores');
  lines.push('');
  lines.push(`| case | label | circular | ${rankers.map((ranker) => ranker.name).join(' | ')} |`);
  lines.push(`|---|---|---|${rankers.map(() => '---').join('|')}|`);
  for (const testCase of report.cases) {
    const cells = rankers.map((ranker) => {
      const row = ranker.results?.find((item) => item.caseId === testCase.id);
      if (!row) return ranker.status === 'run' ? 'no answer' : 'not run';
      return `${fmt(row.score, 3)}${row.decision ? ' ✓' : ''}`;
    });
    lines.push(`| ${testCase.id} | ${testCase.relevant ? 'relevant' : 'not relevant'} | ${testCase.circular ? 'yes' : 'no'} | ${cells.join(' | ')} |`);
  }
  lines.push('');
  if (report.jev.failures?.length) {
    lines.push('## Jev failures (not scored, never imputed)');
    lines.push('');
    for (const failure of report.jev.failures) lines.push(`- ${failure.caseId}: ${failure.stage} ${failure.reason ?? failure.error?.kind ?? ''}`);
    lines.push('');
  }
  lines.push('## Notes');
  lines.push('');
  for (const note of report.notes) lines.push(`- ${note}`);
  lines.push('');
  return lines.join('\n');
}
