// Per-Goal report for the queue run: Kernel records (read-only) + worker timings (/tmp/hermes-worker-runs.jsonl).
import { readFileSync, existsSync } from 'node:fs';
const token = readFileSync('/tmp/forge-kernel-token', 'utf8').trim();
const base = 'http://127.0.0.1:4310';
const get = async (p) => (await fetch(base + p, { headers: { 'x-hephaestus-token': token } })).json();
const titles = process.argv.slice(2);
const runs = existsSync('/tmp/hermes-worker-runs.jsonl') ? readFileSync('/tmp/hermes-worker-runs.jsonl', 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const { missions } = await get('/api/agent-missions');
const opps = (await get('/api/opportunities')).opportunities ?? [];
const out = [];
for (const m of missions.filter((x) => titles.includes(x.goalTitle))) {
  const t = m.searchTelemetry ?? {};
  const results = m.verificationResults ?? [];
  const supportedIds = results.filter((r) => r.supported === true).map((r) => r.evidenceId);
  const finds = opps.filter((o) => supportedIds.includes(o.evidenceId)).map((o) => ({ title: o.title, url: o.sourceUrl }));
  const run = runs.filter((r) => r.missionId === m.id).at(-1);
  out.push({
    goal: m.goalTitle, status: `${m.status}/${m.executionPhase ?? '-'}`, attempt: m.attempt,
    plannedQueries: t.plannedQueries, sent: (t.searches ?? []).map((s) => ({ q: s.query, results: s.resultCount, matchesPlan: s.matchesPlan })),
    funnel: t.funnel, candidates: (m.searchCandidates ?? []).length,
    read: results.filter((r) => r.status === 'verified').length, readFailed: results.filter((r) => r.status === 'verification_failed').map((r) => r.reason),
    unsupported: results.filter((r) => r.status === 'verified' && r.supported !== true).map((r) => r.supportReason),
    evidenceCreated: m.resultSummary?.evidenceCreated, support: supportedIds.length, finds,
    lastFailure: m.lastFailure, limitation: m.limitation,
    timing: run ? { queuedAt: run.queuedAt, startedAt: run.startedAt, endedAt: run.endedAt, warmMs: run.warmMs, attempts: run.attempts, verifyMs: run.verifyMs } : undefined,
  });
}
console.log(JSON.stringify(out, null, 1));
