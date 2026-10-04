// Re-runs a real Mission's planned queries through Hermes's own ddgs worker (the #246 adapter code),
// read-only: no Kernel writes, no model. Output: the per-search display items the new telemetry would carry.
import { readFileSync, writeFileSync } from 'node:fs';
const { resolveSearchWorker, runPlannedSearches } = await import('/workspace/ibos-multi-query/scripts/hermes-efesto-adapter.mjs');
const token = readFileSync('/tmp/forge-kernel-token', 'utf8').trim();
const [missionTitle, out] = process.argv.slice(2);
const { missions } = await (await fetch('http://127.0.0.1:4310/api/agent-missions', { headers: { 'x-hephaestus-token': token } })).json();
const mission = missions.find((m) => m.goalTitle === missionTitle);
const planned = mission.searchTelemetry.plannedQueries;
const worker = resolveSearchWorker('/tmp/efesto-live/hermes-agent/.venv/bin/hermes', {});
const { searches } = await runPlannedSearches(planned, worker, { env: process.env });
writeFileSync(out, JSON.stringify({ missionId: mission.id, goalTitle: mission.goalTitle, rerunAt: new Date().toISOString(), searches }, null, 1));
console.log(searches.map((s) => `${s.query}: ${s.resultCount} results, ${s.results?.length ?? 0} shown`).join('\n'));
