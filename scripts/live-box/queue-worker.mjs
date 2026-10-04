// Box-local Hermes queue worker for the live Kernel (127.0.0.1:4310).
// Claims ONLY Missions already confirmed in the dashboard (authorization approved by an interactive
// user), one at a time, FIFO by queue time. Same attempt loop as one-click-kernel runMissionUntilTerminal:
// up to the Kernel's 3 bounded attempts, then Kernel web.read verification. Warms the local model first.
// Pause between Missions: touch /tmp/hermes-worker.pause (the current Mission always finishes).
import { readFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
const repo = '/workspace/ibos-forge-live';
const { runHermesMissionWorker } = await import(`${repo}/apps/local-kernel/hermes-mission-worker.mjs`);
const { requestMissionCandidateVerification } = await import(`${repo}/apps/local-kernel/automatic-mission-verification-client.mjs`);
const baseUrl = 'http://127.0.0.1:4310';
const ollama = `http://${process.env.OLLAMA_HOST ?? '127.0.0.1:11434'}`;
const model = process.env.HERMES_INFERENCE_MODEL ?? 'qwen3.5:2b';
const apiToken = (await readFile('/tmp/forge-kernel-token', 'utf8')).trim();
const PAUSE = '/tmp/hermes-worker.pause';
const RUNS = '/tmp/hermes-worker-runs.jsonl';
const log = (m) => console.log(`${new Date().toISOString()} ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const confirmedInDashboard = (m) => m?.agent === 'hermes' && m.status === 'queued'
  && m.authorization?.decision === 'approved' && m.authorization?.actorType === 'interactive_user';

async function missions() {
  const res = await fetch(`${baseUrl}/api/agent-missions`, { headers: { 'x-hephaestus-token': apiToken }, signal: AbortSignal.timeout(20_000) });
  const body = await res.json();
  if (!res.ok || !Array.isArray(body.missions)) throw new Error(`missions list HTTP ${res.status}`);
  return body.missions;
}

async function warm() {
  const t0 = Date.now();
  const res = await fetch(`${ollama}/api/generate`, { method: 'POST', body: JSON.stringify({ model, prompt: 'ok', stream: false, think: false, keep_alive: '30m', options: { num_predict: 1 } }), signal: AbortSignal.timeout(180_000) });
  await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`model warm-up HTTP ${res.status}`);
  return Date.now() - t0;
}

async function runMission(mission) {
  const run = { missionId: mission.id, goalId: mission.goalId, goalTitle: mission.goalTitle, queuedAt: mission.createdAt, startedAt: new Date().toISOString(), attempts: [] };
  try { run.warmMs = await warm(); log(`model ${model} warm in ${run.warmMs} ms`); } catch (e) { run.warmError = e.message; log(`warm-up failed: ${e.message}`); }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const a0 = Date.now();
    log(`«${mission.goalTitle}» attempt ${attempt}: claiming ${mission.id}`);
    const result = await runHermesMissionWorker({ baseUrl, apiToken, missionId: mission.id, command: process.execPath, args: [`${repo}/scripts/hermes-efesto-adapter.mjs`] });
    const entry = { attempt, ms: Date.now() - a0, status: result.status, ...(result.reason ? { reason: result.reason } : {}) };
    run.attempts.push(entry);
    log(`worker result: ${JSON.stringify(entry)}`);
    if (result.status === 'verifying') {
      const v0 = Date.now();
      const v = await requestMissionCandidateVerification({ baseUrl, apiToken, missionId: mission.id });
      run.verifyMs = Date.now() - v0;
      run.verification = { status: v.status, phase: v.executionPhase, resultSummary: v.resultSummary, limitation: v.limitation };
      log(`kernel verification (${run.verifyMs} ms): ${v.status}/${v.executionPhase} ${JSON.stringify(v.resultSummary ?? {})} ${v.limitation ?? ''}`);
      break;
    }
    if (result.status !== 'failed') break;
    if (attempt < 3) try { await warm(); } catch {}
  }
  run.endedAt = new Date().toISOString();
  await appendFile(RUNS, JSON.stringify(run) + '\n');
}

// Honest presence: this loop is really polling, so tell the Kernel (token, no browser Origin) about once a minute.
let lastPing = 0;
async function ping() {
  if (Date.now() - lastPing < 60_000) return;
  lastPing = Date.now();
  try { await fetch(`${baseUrl}/api/agents/hermes/ping`, { method: 'POST', headers: { 'x-hephaestus-token': apiToken }, signal: AbortSignal.timeout(10_000) }); } catch {}
}

log(`queue worker started (pid ${process.pid}, model ${model})`);
let lastIdle = '';
const verifyTried = new Set();
for (;;) {
  try {
    if (existsSync(PAUSE)) {
      if (lastIdle !== 'paused') { log('paused (remove /tmp/hermes-worker.pause to resume)'); lastIdle = 'paused'; }
    } else {
      await ping();
      const all = await missions();
      // A candidate batch the Kernel never verified (e.g. it restarted between results and web.read):
      // ask the Kernel to verify it once. Kernel-owned; nothing here decides SUPPORT.
      for (const m of all.filter((x) => x.status === 'running' && x.executionPhase === 'verifying' && Array.isArray(x.searchCandidates) && x.searchCandidates.length && !(x.verificationResults ?? []).length && !x.verificationBlock && !verifyTried.has(x.id))) {
        verifyTried.add(m.id);
        try { const v = await requestMissionCandidateVerification({ baseUrl, apiToken, missionId: m.id }); log(`recovered verification for «${m.goalTitle}»: ${v.status}/${v.executionPhase}`); } catch (e) { log(`recover verification failed for ${m.id}: ${e.message}`); }
      }
      const next = all.filter(confirmedInDashboard).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0];
      if (next) { lastIdle = ''; await runMission(next); continue; }
      const unconfirmed = all.filter((m) => m.status === 'queued' && !confirmedInDashboard(m)).length;
      const idle = `idle (queued without dashboard confirmation: ${unconfirmed})`;
      if (idle !== lastIdle) { log(idle); lastIdle = idle; }
    }
  } catch (e) { log(`poll error: ${e.message}`); }
  await sleep(10_000);
}
