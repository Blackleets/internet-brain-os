#!/usr/bin/env node
// pnpm eval:jev [--allow-network] [--dataset path.jsonl]... [--out dir] [--k 1,3,5] [--quiet]
//
// OFFLINE bench: current Efesto candidate ranking vs Jev (TypeSafe AI).
// Runs the current rankers locally on labelled repo fixtures. Jev is SKIPPED
// unless BOTH --allow-network is passed AND JEV_API_KEY is set. No product
// code imports this; it writes only to the git-ignored .hephaestus/eval/.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_K_VALUES,
  computeMetrics,
  jevRunDecision,
  loadDataset,
  loadEvidenceSupportsGoal,
  loadProductRankingModules,
  preflightJevCase,
  renderMarkdown,
  resolveJevConfig,
  runJev,
  runLocalRanker,
  scoreFindPipeline,
  scoreKernelSupport,
  summarizeDataset,
} from './jev-ranking-bench-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const DEFAULT_DATASET = join(here, 'fixtures', 'ranking-labelled-cases.jsonl');
const DEFAULT_OUT = join(repoRoot, '.hephaestus', 'eval');

export function parseArgs(argv) {
  const args = { allowNetwork: false, datasets: [], out: DEFAULT_OUT, kValues: [...DEFAULT_K_VALUES], quiet: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') continue;
    if (arg === '--allow-network') args.allowNetwork = true;
    else if (arg === '--quiet') args.quiet = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--dataset') args.datasets.push(resolve(argv[++index] ?? ''));
    else if (arg === '--out') args.out = resolve(argv[++index] ?? '');
    else if (arg === '--k') args.kValues = String(argv[++index] ?? '').split(',').map(Number).filter((k) => Number.isInteger(k) && k > 0);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.datasets.length) args.datasets.push(DEFAULT_DATASET);
  if (!args.kValues.length) args.kValues = [...DEFAULT_K_VALUES];
  return args;
}

function gitInfo() {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    return { commit, branch };
  } catch { return { commit: null, branch: null }; }
}

function subsets(results, cases, options) {
  const nonCircularIds = new Set(cases.filter((item) => !item.circular).map((item) => item.id));
  const nonCircular = results.filter((item) => nonCircularIds.has(item.caseId));
  return {
    all: results.length ? computeMetrics(results, options) : null,
    nonCircular: nonCircular.length ? computeMetrics(nonCircular, options) : null,
  };
}

export async function main(argv = process.argv.slice(2), { env = process.env, log = console.log, fetchImpl } = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    log('Usage: pnpm eval:jev [--allow-network] [--dataset cases.jsonl]... [--out dir] [--k 1,3,5] [--quiet]');
    log('Jev runs only with --allow-network AND JEV_API_KEY. Optional env: JEV_BASE_URL, JEV_DECIDE_PATH, JEV_MODEL, JEV_PRICE_PER_MTOK_USD.');
    return { exitCode: 0 };
  }
  const say = args.quiet ? () => {} : log;
  const cases = await loadDataset(args.datasets);
  const datasetHash = createHash('sha256');
  for (const path of args.datasets) datasetHash.update(await readFile(path));
  const dataset = summarizeDataset(cases);
  say(`eval:jev — ${dataset.total} labelled cases (${dataset.positives} relevant / ${dataset.negatives} not), ${dataset.circular} circular`);

  const evidenceSupportsGoal = await loadEvidenceSupportsGoal();
  const modules = await loadProductRankingModules();
  const deps = { evidenceSupportsGoal, modules };
  const metricOptions = { kValues: args.kValues };

  const kernelSupport = runLocalRanker('current:kernel-support', cases, scoreKernelSupport, deps);
  const findPipeline = runLocalRanker('current:find-pipeline', cases, scoreFindPipeline, deps);
  const rankers = [
    { ...kernelSupport, kind: 'current', calibrated: true, description: 'evidenceSupportsGoal (packages/kernel/src/evidence/support.ts), binary 1/0', subsets: subsets(kernelSupport.results, cases, { ...metricOptions, calibrated: true }) },
    { ...findPipeline, kind: 'current', calibrated: false, description: 'SUPPORT gate -> classifyOpportunity -> scope -> rankOpportunity score/99 (0 when no Find)', subsets: subsets(findPipeline.results, cases, { ...metricOptions, calibrated: false }) },
  ];

  const config = resolveJevConfig(env);
  const decision = jevRunDecision({ allowNetwork: args.allowNetwork, hasKey: config.hasKey });
  const jev = { status: decision.status, reason: decision.reason, route: config.route, host: config.host, endpoint: config.url, requestedModel: config.model, model: null, answered: 0, failures: [] };
  if (!decision.run) {
    say(`jev: not run, ${decision.reason}`);
    rankers.push({ name: 'jev:noul', kind: 'jev', status: 'not_run', reason: decision.reason, results: [], subsets: { all: null, nonCircular: null } });
    rankers.push({ name: 'jev:score', kind: 'jev', status: 'not_run', reason: decision.reason, results: [], subsets: { all: null, nonCircular: null } });
  } else {
    const estTokens = cases.reduce((sum, item) => sum + (preflightJevCase(item, config).estTokens ?? 0), 0);
    const estCost = Number.isFinite(config.pricePerMTokUsd) ? (estTokens / 1_000_000) * config.pricePerMTokUsd : null;
    say('');
    say('WARNING (privacy): --allow-network given. This will POST fixture text ONLY');
    say(`  (Goal title/keywords + fixture page title/url/excerpt/text from ${args.datasets.length} dataset file(s), ${cases.length} cases)`);
    say(`  to ${config.url} [${config.route}] with model ${config.model}.`);
    say('  No Kernel store, Evidence, browsing history or user data is read or sent. Each state is scanned for secrets first.');
    say(`  Estimated input: ~${estTokens} tokens; estimated cost: ${estCost === null ? 'unknown (set JEV_PRICE_PER_MTOK_USD)' : `$${estCost.toFixed(6)}`}.`);
    if (config.resellerWarning) say(`  NOTE: ${config.resellerWarning}.`);
    say('');
    const outcome = await runJev(cases, config, { log: say, ...(fetchImpl ? { fetchImpl } : {}) });
    jev.model = outcome.model;
    jev.answered = outcome.noulResults.length;
    jev.failures = outcome.failures;
    jev.estimatedInputTokens = estTokens;
    const status = outcome.noulResults.length ? 'run' : 'failed';
    if (!outcome.noulResults.length) { jev.status = 'failed'; jev.reason = 'no Jev answers received'; }
    rankers.push({ name: 'jev:noul', kind: 'jev', status, calibrated: true, description: 'noul "This page provides evidence relevant to the Goal" (decision: >= 0.5)', results: outcome.noulResults, subsets: subsets(outcome.noulResults, cases, { ...metricOptions, calibrated: true }) });
    rankers.push({ name: 'jev:score', kind: 'jev', status, calibrated: false, description: 'score 1-5 relevance, normalised (score-1)/4 (decision: >= 4); same call as jev:noul', results: outcome.scoreResults, subsets: subsets(outcome.scoreResults, cases, { ...metricOptions, calibrated: false }) });
    say(`jev: ${jev.answered}/${cases.length} answered, ${outcome.failures.length} failed/skipped (never imputed)`);
  }

  const generatedAt = new Date().toISOString();
  const report = {
    schemaVersion: 'efesto.eval.jev-ranking-bench.report.v1',
    generatedAt,
    git: gitInfo(),
    node: process.version,
    productIntegration: 'none',
    publicLaunchApproved: false,
    datasetFiles: args.datasets.map((path) => path.startsWith(repoRoot) ? path.slice(repoRoot.length + 1) : path),
    datasetSha256: datasetHash.digest('hex'),
    dataset,
    jev,
    rankers,
    cases: cases.map((item) => ({ id: item.id, relevant: item.label.relevant, circular: item.circular, labelSource: item.labelSource, provenance: item.provenance.map((entry) => `${entry.file} :: ${entry.test}`) })),
    notes: [
      'Labels come only from existing repo test assertions (see scripts/eval/README.md for provenance); no labels were invented.',
      'current:kernel-support emits hard 0/1, so its Brier/ECE equal its error rate and P@k uses expected value under random tie-breaking.',
      'current:find-pipeline score is rankOpportunity score/99 (not a calibrated probability); a page that would not become a Kernel-supported Find scores 0.',
      'jev:noul and jev:score are two questions in the same /decide call; their latency and cost are the same shared call, not additive.',
      'Local ranker latency is in-process wall time per case (no network); Jev latency includes the network round trip.',
      `Per-case table shows raw scores (find-pipeline: rankOpportunity 0-99). ${findPipeline.results.filter((item) => item.decision && item.score >= 99).length} of ${findPipeline.results.filter((item) => item.decision).length} Finds hit the 99 cap, so the current ranking cannot order those Finds among themselves.`,
      `With only ${dataset.total} cases (${dataset.nonCircular} non-circular), all metrics have very wide uncertainty; add human-labelled cases per scripts/eval/README.md.`,
    ],
  };
  // Never let the key reach disk.
  const serialized = JSON.stringify(report, null, 2);
  if (config.apiKey && serialized.includes(config.apiKey)) throw new Error('refusing to write a report containing the API key');
  await mkdir(args.out, { recursive: true });
  const stamp = generatedAt.replace(/[:.]/g, '-');
  const jsonPath = join(args.out, `jev-ranking-bench-${stamp}.json`);
  const mdPath = join(args.out, `jev-ranking-bench-${stamp}.md`);
  const markdown = renderMarkdown(report);
  await writeFile(jsonPath, `${serialized}\n`);
  await writeFile(mdPath, markdown);
  await writeFile(join(args.out, 'latest.json'), `${serialized}\n`);
  await writeFile(join(args.out, 'latest.md'), markdown);
  say('');
  for (const ranker of rankers) {
    const all = ranker.subsets?.all;
    if (!all) { say(`${ranker.name}: not run (${ranker.reason})`); continue; }
    say(`${ranker.name}: n=${all.n} P@1=${all.atK[0]?.precision} P@3=${all.atK[1]?.precision ?? 'n/a'} precision=${all.decision.precision} recall=${all.decision.recall} AUC=${all.rocAuc} Brier=${all.brier}${ranker.calibrated ? '' : ' (uncalibrated)'} p50=${all.latency.p50Ms}ms cost=$${all.cost.totalUsd ?? 'unknown'}`);
  }
  say(`report: ${jsonPath}`);
  say(`report: ${mdPath}`);
  return { exitCode: 0, report, jsonPath, mdPath };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().then(({ exitCode }) => { process.exitCode = exitCode; }).catch((error) => {
    console.error(`eval:jev failed: ${error.message}`);
    process.exitCode = 1;
  });
}
