import { mkdtemp, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { evidenceSupportsGoal } from '../../packages/kernel/src/evidence/support.ts';
import {
  DatasetError,
  JEV_QUESTIONS,
  brierScore,
  buildJevRequest,
  callJev,
  computeMetrics,
  confusion,
  expectedCalibrationError,
  jevRunDecision,
  latencySummary,
  loadDataset,
  loadProductRankingModules,
  parseJevResponse,
  parseJsonl,
  precisionRecallAtK,
  preflightJevCase,
  resolveJevConfig,
  rocAuc,
  scoreFindPipeline,
  scoreKernelSupport,
  validateCase,
} from './jev-ranking-bench-lib.mjs';
import { main } from './jev-ranking-bench.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DATASET = fileURLToPath(new URL('./fixtures/ranking-labelled-cases.jsonl', import.meta.url));
const FAKE_KEY = 'jv_test_not_a_real_key_0123456789';

function baseCase(overrides = {}) {
  return {
    schemaVersion: 'efesto.eval.ranking-case.v1',
    id: 'unit-case-1',
    goal: { title: 'Find a drill offer', keywords: ['drill'] },
    goalMode: 'raw',
    page: { title: 'Quality drill', url: 'https://shop.example/drill', text: 'Quality cordless drill offer.' },
    label: { relevant: true, graded: null },
    labelSource: 'repo-test-assertion',
    circular: false,
    provenance: [{ file: 'x', test: 'y', assertion: 'z' }],
    ...overrides,
  };
}

/** Documented TypeSafe System One / Jev response shape (docs.typesafe.ai/api). */
function documentedJevBody({ noul = 0.91, score = 3.2 } = {}) {
  return {
    model: 'jev-1.13.0',
    answers: {
      relevant: { type: 'noul', noul },
      relevance: {
        type: 'score', score, confidence: 0.8,
        legend: { 0: 'a', 1: 'b', 2: 'c', 3: 'd', 4: 'e' },
        probabilities: { 0: 0, 1: 0, 2: 0.1, 3: 0.6, 4: 0.3 },
      },
    },
    usage: { input_tokens: 400, output_tokens: 20, cost_usd: 0.0000168 },
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('metrics', () => {
  it('precision@k / recall@k on a strict ranking', () => {
    const items = [{ score: 0.9, label: 1 }, { score: 0.8, label: 0 }, { score: 0.7, label: 1 }, { score: 0.1, label: 0 }];
    expect(precisionRecallAtK(items, 1)).toEqual({ k: 1, precision: 1, recall: 0.5 });
    expect(precisionRecallAtK(items, 2)).toEqual({ k: 2, precision: 0.5, recall: 0.5 });
    expect(precisionRecallAtK(items, 3).precision).toBeCloseTo(2 / 3);
    expect(precisionRecallAtK(items, 10)).toEqual({ k: 10, precision: 0.5, recall: 1 });
  });

  it('precision@k uses expected value under random tie-breaking (order independent)', () => {
    const tied = [{ score: 1, label: 1 }, { score: 1, label: 0 }, { score: 0, label: 0 }];
    expect(precisionRecallAtK(tied, 1).precision).toBeCloseTo(0.5);
    expect(precisionRecallAtK([...tied].reverse(), 1).precision).toBeCloseTo(0.5);
    expect(precisionRecallAtK(tied, 2).precision).toBeCloseTo(0.5);
  });

  it('ROC-AUC handles perfect, inverted, tied and single-class inputs', () => {
    expect(rocAuc([{ score: 1, label: 1 }, { score: 0, label: 0 }])).toBe(1);
    expect(rocAuc([{ score: 0, label: 1 }, { score: 1, label: 0 }])).toBe(0);
    expect(rocAuc([{ score: 0.5, label: 1 }, { score: 0.5, label: 0 }])).toBe(0.5);
    expect(rocAuc([{ score: 0.3, label: 1 }, { score: 0.9, label: 1 }])).toBeNull();
  });

  it('Brier, ECE, confusion and latency summaries', () => {
    const items = [
      { probability: 1, label: 1, decision: true },
      { probability: 0, label: 0, decision: false },
      { probability: 0.8, label: 0, decision: true },
      { probability: 0.2, label: 1, decision: false },
    ];
    expect(brierScore(items)).toBeCloseTo((0 + 0 + 0.64 + 0.64) / 4);
    expect(brierScore([])).toBeNull();
    expect(expectedCalibrationError([{ probability: 1, label: 1 }, { probability: 0, label: 0 }])).toBe(0);
    expect(expectedCalibrationError([{ probability: 0.9, label: 0 }])).toBeCloseTo(0.9);
    expect(confusion(items)).toMatchObject({ tp: 1, fp: 1, tn: 1, fn: 1, precision: 0.5, recall: 0.5, f1: 0.5, accuracy: 0.5 });
    expect(confusion([{ decision: false, label: 0 }]).precision).toBeNull();
    expect(latencySummary([3, 1, 2, 10])).toMatchObject({ n: 4, p50Ms: 2, p95Ms: 10, maxMs: 10, meanMs: 4 });
    expect(latencySummary([])).toMatchObject({ n: 0, meanMs: null });
  });

  it('computeMetrics aggregates without inventing cost', () => {
    const metrics = computeMetrics([
      { caseId: 'a', label: 1, score: 0.9, probability: 0.9, decision: true, latencyMs: 1, costUsd: 0.001 },
      { caseId: 'b', label: 0, score: 0.2, probability: 0.2, decision: false, latencyMs: 2, costUsd: null },
    ], { kValues: [1] });
    expect(metrics).toMatchObject({ n: 2, positives: 1, negatives: 1, rocAuc: 1, atK: [{ k: 1, precision: 1, recall: 1 }] });
    expect(metrics.cost).toEqual({ knownCases: 1, totalUsd: 0.001, perCaseUsd: 0.001 });
  });
});

describe('labelled dataset', () => {
  it('loads the repo fixture: 14 labelled cases, balanced, with provenance', async () => {
    const cases = await loadDataset([DATASET]);
    expect(cases).toHaveLength(14);
    expect(cases.filter((item) => item.label.relevant)).toHaveLength(7);
    expect(cases.filter((item) => !item.circular).map((item) => item.id)).toEqual(['golden-drill-18-25-eur-in-budget']);
    expect(cases.every((item) => item.labelSource === 'repo-test-assertion')).toBe(true);
  });

  it('every provenance snippet still appears verbatim in its source test (no invented fixtures)', async () => {
    const cases = await loadDataset([DATASET]);
    for (const item of cases) {
      for (const entry of item.provenance) {
        const path = join(repoRoot, entry.file);
        expect(existsSync(path), `${item.id}: ${entry.file} missing`).toBe(true);
        const source = await readFile(path, 'utf8');
        expect(source.includes(entry.test), `${item.id}: test title not found in ${entry.file}`).toBe(true);
        for (const snippet of entry.snippets ?? []) {
          expect(source.includes(snippet), `${item.id}: snippet not found in ${entry.file}: ${snippet}`).toBe(true);
        }
      }
    }
  });

  it('rejects unlabeled, unsourced or anonymous human cases', () => {
    expect(() => validateCase(baseCase({ label: {} }))).toThrow(DatasetError);
    expect(() => validateCase(baseCase({ provenance: [] }))).toThrow(DatasetError);
    expect(() => validateCase(baseCase({ labelSource: 'model' }))).toThrow(DatasetError);
    expect(() => validateCase(baseCase({ labelSource: 'human' }))).toThrow(/labeledBy/);
    expect(validateCase(baseCase({ labelSource: 'human', labeledBy: 'lewis' })).id).toBe('unit-case-1');
    expect(() => parseJsonl(`${JSON.stringify(baseCase())}\n${JSON.stringify(baseCase())}`)).toThrow(/duplicate/);
  });
});

describe('current rankers (read-only use of product code)', () => {
  it('kernel-support is exactly evidenceSupportsGoal; find-pipeline only scores Kernel-supported Finds', async () => {
    const modules = await loadProductRankingModules();
    const cases = await loadDataset([DATASET]);
    for (const item of cases) {
      const support = scoreKernelSupport(item, { evidenceSupportsGoal, modules });
      expect([0, 1]).toContain(support.score);
      const find = scoreFindPipeline(item, { evidenceSupportsGoal, modules });
      expect(find.score).toBeGreaterThanOrEqual(0);
      expect(find.score).toBeLessThanOrEqual(99);
      if (!support.decision) expect(find).toMatchObject({ score: 0, decision: false });
    }
    const direct = evidenceSupportsGoal({ title: 'Find a drill offer', keywords: ['drill'] }, { title: 'chat', excerpt: 'Hermes said Completado', text: 'The assistant marked the Goal done.' });
    const viaHarness = scoreKernelSupport(cases.find((item) => item.id === 'support-c6-chat-text-not-evidence'), { evidenceSupportsGoal, modules });
    expect(viaHarness.decision).toBe(direct.supported);
  });
});

describe('Jev config and gating', () => {
  it('defaults to the official TypeSafe endpoint with a pinned model; base URL and key are env-configurable', () => {
    expect(resolveJevConfig({})).toMatchObject({ route: 'typesafe-official', url: 'https://api.typesafe.ai/v1/systemone', model: 'jev-1.13.0', hasKey: false, pricePerMTokUsd: null });
    expect(resolveJevConfig({ JEV_BASE_URL: 'https://ai-gateway.vercel.sh/typesafe/' })).toMatchObject({ route: 'vercel-ai-gateway', url: 'https://ai-gateway.vercel.sh/typesafe/v1/systemone', model: 'typesafe-ai/jev', pricePerMTokUsd: 0.042 });
    const reseller = resolveJevConfig({ JEV_BASE_URL: 'https://jevtypesafeai.com/api', JEV_API_KEY: ` ${FAKE_KEY} ` });
    expect(reseller).toMatchObject({ route: 'jevtypesafeai-reseller', url: 'https://jevtypesafeai.com/api/v1/decide', hasKey: true, apiKey: FAKE_KEY });
    expect(reseller.resellerWarning).toMatch(/not TypeSafe's official API/);
    expect(resolveJevConfig({ JEV_MODEL: 'jev-latest', JEV_PRICE_PER_MTOK_USD: '0.5' })).toMatchObject({ model: 'jev-latest', pricePerMTokUsd: 0.5 });
  });

  it('requires BOTH a key and --allow-network', () => {
    expect(jevRunDecision({ allowNetwork: false, hasKey: false })).toMatchObject({ run: false, reason: 'no key' });
    expect(jevRunDecision({ allowNetwork: true, hasKey: false })).toMatchObject({ run: false, reason: 'no key' });
    expect(jevRunDecision({ allowNetwork: false, hasKey: true })).toMatchObject({ run: false, reason: '--allow-network not given' });
    expect(jevRunDecision({ allowNetwork: true, hasKey: true })).toMatchObject({ run: true });
  });

  it('request carries only the pinned model, fixture state and the two typed questions', () => {
    const request = buildJevRequest(baseCase(), resolveJevConfig({}));
    expect(Object.keys(request).sort()).toEqual(['model', 'questions', 'state']);
    expect(request.model).toBe('jev-1.13.0');
    expect(Object.keys(request.state).sort()).toEqual(['goal', 'page']);
    expect(request.questions.relevant).toEqual({ type: 'noul', instructions: 'This page provides evidence relevant to the Goal' });
    expect(request.questions.relevance.type).toBe('score');
    expect(request.questions.relevance.criteria).toHaveLength(5);
  });

  it('preflight refuses states with secrets or over the token budget', () => {
    const config = resolveJevConfig({ JEV_API_KEY: FAKE_KEY });
    expect(preflightJevCase(baseCase(), config).ok).toBe(true);
    expect(preflightJevCase(baseCase({ page: { text: `leaked ${FAKE_KEY}` } }), config)).toMatchObject({ ok: false, reason: 'state_contains_api_key' });
    expect(preflightJevCase(baseCase({ page: { text: 'authorization: Bearer abcdefghijklmnopqrstuvwxyz' } }), config).reason).toMatch(/^sensitive_data_scan/);
    expect(preflightJevCase(baseCase({ page: { text: 'y'.repeat(200_000) } }), config)).toMatchObject({ ok: false, reason: 'state_exceeds_token_budget' });
  });
});

describe('Jev response parsing (mocked fetch only)', () => {
  it('parses the documented response shape and reported cost', async () => {
    const config = resolveJevConfig({ JEV_API_KEY: FAKE_KEY });
    const fetchImpl = vi.fn(async () => jsonResponse(documentedJevBody()));
    const outcome = await callJev(baseCase(), config, { fetchImpl });
    expect(outcome.ok).toBe(true);
    expect(outcome.answer).toMatchObject({ model: 'jev-1.13.0', noul: 0.91, scoreIndex: 3.2, inputTokens: 400, costUsd: 0.0000168, costSource: 'reported:usage.cost_usd' });
    expect(outcome.answer.score1to5).toBeCloseTo(4.2);
    expect(outcome.answer.scoreProbability).toBeCloseTo(0.8);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(JSON.parse(init.body)).toMatchObject({ model: 'jev-1.13.0', questions: { relevant: { type: 'noul' }, relevance: { type: 'score' } } });
  });

  it('reads AI Gateway cost metadata and falls back to token x list price', () => {
    const gateway = resolveJevConfig({ JEV_BASE_URL: 'https://ai-gateway.vercel.sh/typesafe' });
    const body = documentedJevBody();
    delete body.usage.cost_usd;
    expect(parseJevResponse({ ...body, provider_metadata: { gateway: { cost: '0.00001155' } } }, gateway)).toMatchObject({ costUsd: 0.00001155, costSource: 'reported:provider_metadata.gateway.cost' });
    expect(parseJevResponse(body, gateway).costSource).toMatch(/^estimated:/);
    expect(parseJevResponse(body, resolveJevConfig({})).costUsd).toBeNull();
  });

  it('never fabricates answers from malformed or failed responses', async () => {
    expect(() => parseJevResponse({ answers: { relevant: { type: 'noul', noul: 1.4 }, relevance: documentedJevBody().answers.relevance } })).toThrow();
    expect(() => parseJevResponse({ answers: { relevant: { type: 'noul', noul: 0.5 } } })).toThrow();
    expect(() => parseJevResponse({ answers: { relevant: { type: 'noul', noul: 0.5 }, relevance: { type: 'score', score: JEV_QUESTIONS.relevance.criteria.length } } })).toThrow();
    const config = resolveJevConfig({ JEV_API_KEY: FAKE_KEY });
    const malformed = await callJev(baseCase(), config, { fetchImpl: async () => jsonResponse({ answers: {} }) });
    expect(malformed).toMatchObject({ ok: false, error: { kind: 'malformed_response' } });
    expect(malformed.answer).toBeUndefined();
    const sleep = vi.fn(async () => {});
    const unauthorized = await callJev(baseCase(), config, { fetchImpl: async () => jsonResponse({ error: 'bad key' }, 401), sleep });
    expect(unauthorized).toMatchObject({ ok: false, attempts: 1, error: { kind: 'http_error', status: 401 } });
    const flaky = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'upstream' }, 502))
      .mockResolvedValueOnce(jsonResponse(documentedJevBody()));
    const retried = await callJev(baseCase(), config, { fetchImpl: flaky, sleep });
    expect(retried).toMatchObject({ ok: true, attempts: 2 });
  });
});

describe('CLI end-to-end (no network)', () => {
  it('runs the current rankers and SKIPS Jev cleanly without a key', async () => {
    const out = await mkdtemp(join(tmpdir(), 'efesto-jev-bench-'));
    const fetchImpl = vi.fn();
    const lines = [];
    const { exitCode, report, jsonPath } = await main(['--out', out], { env: {}, log: (line) => lines.push(line), fetchImpl });
    expect(exitCode).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(lines).toContain('jev: not run, no key');
    expect(report).toMatchObject({ productIntegration: 'none', publicLaunchApproved: false, jev: { status: 'not_run', reason: 'no key', answered: 0 } });
    expect(report.dataset).toMatchObject({ total: 14, positives: 7, negatives: 7, nonCircular: 1 });
    const jevRankers = report.rankers.filter((ranker) => ranker.kind === 'jev');
    expect(jevRankers).toHaveLength(2);
    for (const ranker of jevRankers) expect(ranker).toMatchObject({ status: 'not_run', results: [], subsets: { all: null, nonCircular: null } });
    const current = report.rankers.filter((ranker) => ranker.kind === 'current');
    expect(current.map((ranker) => ranker.subsets.all.n)).toEqual([14, 14]);
    const written = JSON.parse(await readFile(jsonPath, 'utf8'));
    expect(written.jev.status).toBe('not_run');
    expect(await readFile(join(out, 'latest.md'), 'utf8')).toContain('jev: not run, no key');
  });

  it('a key alone is not enough: no --allow-network means no request', async () => {
    const out = await mkdtemp(join(tmpdir(), 'efesto-jev-bench-'));
    const fetchImpl = vi.fn();
    const { report } = await main(['--out', out, '--quiet'], { env: { JEV_API_KEY: FAKE_KEY }, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(report.jev).toMatchObject({ status: 'not_run', reason: '--allow-network not given' });
    expect(JSON.stringify(report)).not.toContain(FAKE_KEY);
  });

  it('with --allow-network and a key, scores only real (mocked) answers and never writes the key', async () => {
    const out = await mkdtemp(join(tmpdir(), 'efesto-jev-bench-'));
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return calls === 1 ? jsonResponse({ answers: {} }) : jsonResponse(documentedJevBody({ noul: calls % 2 ? 0.8 : 0.2, score: calls % 2 ? 3 : 1 }));
    });
    const lines = [];
    const { report } = await main(['--out', out, '--allow-network'], { env: { JEV_API_KEY: FAKE_KEY }, log: (line) => lines.push(line), fetchImpl });
    expect(lines.some((line) => line.startsWith('WARNING (privacy)'))).toBe(true);
    expect(report.jev.status).toBe('run');
    expect(report.jev.failures).toHaveLength(1);
    expect(report.jev.answered).toBe(13);
    const noul = report.rankers.find((ranker) => ranker.name === 'jev:noul');
    expect(noul.results).toHaveLength(13);
    expect(noul.results.find((row) => row.caseId === report.jev.failures[0].caseId)).toBeUndefined();
    for (const [, init] of fetchImpl.mock.calls) {
      const body = JSON.parse(init.body);
      expect(Object.keys(body.state).sort()).toEqual(['goal', 'page']);
    }
    const written = await readFile(join(out, 'latest.json'), 'utf8');
    expect(written).not.toContain(FAKE_KEY);
  });
});
