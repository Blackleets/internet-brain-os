import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const MAX_OUTPUT_BYTES = 512 * 1024;

export async function runHermesMissionWorker(options = {}) {
  const baseUrl = normalizeLoopback(options.baseUrl ?? process.env.HEPHAESTUS_KERNEL_URL ?? 'http://127.0.0.1:4000');
  const apiToken = requireValue(options.apiToken ?? process.env.HEPHAESTUS_API_TOKEN, 'HEPHAESTUS_API_TOKEN');
  const command = requireValue(options.command ?? process.env.HEPHAESTUS_HERMES_COMMAND, 'HEPHAESTUS_HERMES_COMMAND');
  const args = options.args ?? parseArgs(process.env.HEPHAESTUS_HERMES_ARGS_JSON);
  const fetchImpl = options.fetchImpl ?? fetch;
  const execute = options.execute ?? executeAdapter;
  const claimed = await request(fetchImpl, `${baseUrl}/api/agent-missions/claim`, apiToken, { method: 'POST' }, true);
  if (!claimed) return { status: 'idle' };
  const mission = claimed.mission;
  try {
    const result = await execute(command, args, mission, { timeoutMs: options.timeoutMs ?? 4 * 60_000 });
    const findings = validateAdapterResult(result);
    const completed = await request(fetchImpl, `${baseUrl}/api/agent-missions/${encodeURIComponent(mission.id)}/results`, apiToken, {
      method: 'POST', body: JSON.stringify({ leaseId: mission.leaseId, findings }),
    });
    return { status: 'completed', mission: completed.mission };
  } catch (error) {
    const reason = sanitizeFailure(error);
    await request(fetchImpl, `${baseUrl}/api/agent-missions/${encodeURIComponent(mission.id)}/failures`, apiToken, {
      method: 'POST', body: JSON.stringify({ leaseId: mission.leaseId, reason }),
    });
    return { status: 'failed', missionId: mission.id, reason };
  }
}

function executeAdapter(command, args, mission, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = ''; let stderr = ''; let size = 0; let settled = false;
    const timer = setTimeout(() => { child.kill(); finish(new Error('Hermes adapter timed out')); }, options.timeoutMs);
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
    const collect = (chunk, target) => {
      size += chunk.length;
      if (size > MAX_OUTPUT_BYTES) { child.kill(); finish(new Error('Hermes adapter output exceeded the limit')); return; }
      if (target === 'stdout') stdout += chunk; else stderr += chunk;
    };
    child.stdout.on('data', (chunk) => collect(chunk, 'stdout'));
    child.stderr.on('data', (chunk) => collect(chunk, 'stderr'));
    child.on('error', finish);
    child.on('close', (code) => {
      if (code !== 0) return finish(new Error(`Hermes adapter exited with code ${code}${stderr ? `: ${stderr}` : ''}`));
      try { finish(undefined, JSON.parse(stdout)); } catch { finish(new Error('Hermes adapter did not return valid JSON')); }
    });
    child.stdin.end(JSON.stringify({ schemaVersion: 'efesto.hermes-mission.v1', mission }));
  });
}

async function request(fetchImpl, url, token, init, allowEmpty = false) {
  const response = await fetchImpl(url, { ...init, headers: { 'x-hephaestus-token': token, ...(init.body ? { 'content-type': 'application/json' } : {}) } });
  if (allowEmpty && response.status === 204) return undefined;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Kernel request failed with HTTP ${response.status}`);
  return body;
}

function validateAdapterResult(value) {
  if (!value || !Array.isArray(value.findings) || value.findings.length > 20) throw new Error('Hermes adapter must return { findings: [...] } with at most 20 items');
  return value.findings;
}
function parseArgs(value) {
  if (!value) return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) throw new Error('HEPHAESTUS_HERMES_ARGS_JSON must be a JSON string array');
  return parsed;
}
function normalizeLoopback(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Kernel URL must be loopback HTTP');
  return url.href.replace(/\/$/, '');
}
function requireValue(value, name) { if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`); return value.trim(); }
function sanitizeFailure(error) { return String(error instanceof Error ? error.message : error).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500); }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runHermesMissionWorker();
  console.log(JSON.stringify(result));
}
