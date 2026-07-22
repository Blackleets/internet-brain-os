import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const MAX_INPUT_BYTES = 128 * 1024;
const MAX_OUTPUT_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 3 * 60_000;

export function buildHermesPrompt(payload) {
  if (!payload || payload.schemaVersion !== 'efesto.hermes-mission.v1' || !payload.mission) {
    throw new Error('Expected one efesto.hermes-mission.v1 mission object');
  }
  const mission = payload.mission;
  const scope = mission.scope ?? {};
  return [
    'You are executing one bounded public-source research mission for Efesto.',
    'Use only public web sources. Do not access local files, private networks, credentials, messaging history, or private sessions.',
    'Do not perform purchases, submissions, logins, outreach, downloads, or destructive actions.',
    'Return ONLY one valid JSON object with this exact top-level shape: {"findings":[...]}.',
    'Each finding may contain only url, title, text, summary, and discoveredAt.',
    'Use at most 20 findings. URLs must be public http or https. Do not include markdown fences or commentary.',
    '',
    `Mission id: ${String(mission.id ?? '').slice(0, 160)}`,
    `Goal: ${String(mission.goalTitle ?? '').slice(0, 500)}`,
    `Categories: ${JSON.stringify(Array.isArray(scope.categories) ? scope.categories.slice(0, 20) : [])}`,
    `Keywords: ${JSON.stringify(Array.isArray(scope.keywords) ? scope.keywords.slice(0, 40) : [])}`,
    `Location: ${String(scope.location ?? '').slice(0, 240)}`,
    `Cadence: ${String(mission.cadence ?? '').slice(0, 80)}`,
  ].join('\n');
}

export function buildHermesArgs(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('Hermes prompt is required');
  return ['-z', prompt];
}

export function parseHermesFindings(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Hermes returned empty output');
  const trimmed = text.trim();
  const candidate = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;
  let parsed;
  try { parsed = JSON.parse(candidate); }
  catch { throw new Error('Hermes did not return valid JSON'); }
  if (!parsed || !Array.isArray(parsed.findings) || parsed.findings.length > 20) {
    throw new Error('Hermes must return { findings: [...] } with at most 20 findings');
  }
  return { findings: parsed.findings.map((finding, index) => normalizeFinding(finding, index)) };
}

function normalizeFinding(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`finding ${index} must be an object`);
  const allowed = new Set(['url', 'title', 'text', 'summary', 'discoveredAt']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`finding ${index} contains unsupported field ${key}`);
  return {
    url: bounded(value.url, 2048, `finding ${index} url`),
    title: bounded(value.title, 240, `finding ${index} title`),
    text: bounded(value.text, 20_000, `finding ${index} text`),
    ...(value.summary === undefined ? {} : { summary: bounded(value.summary, 500, `finding ${index} summary`) }),
    ...(value.discoveredAt === undefined ? {} : { discoveredAt: bounded(value.discoveredAt, 40, `finding ${index} discoveredAt`) }),
  };
}

function bounded(value, max, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  const result = value.trim();
  if (!result || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) throw new Error(`${label} is invalid`);
  return result;
}

export async function runHermesOneShot(payload, options = {}) {
  const executable = options.executable ?? process.env.HEPHAESTUS_HERMES_EXECUTABLE ?? 'hermes';
  const prompt = buildHermesPrompt(payload);
  const args = buildHermesArgs(prompt);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let bytes = 0; let settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => { child.kill(); finish(new Error('Hermes one-shot timed out')); }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const collect = (chunk, target) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT_BYTES) { child.kill(); finish(new Error('Hermes output exceeded the limit')); return; }
      if (target === 'stdout') stdout += chunk; else stderr += chunk;
    };
    child.stdout.on('data', (chunk) => collect(chunk, 'stdout'));
    child.stderr.on('data', (chunk) => collect(chunk, 'stderr'));
    child.on('error', finish);
    child.on('close', (code) => {
      if (code !== 0) return finish(new Error(`Hermes exited with code ${code}${stderr ? `: ${stderr.slice(0, 500)}` : ''}`));
      try { finish(undefined, parseHermesFindings(stdout)); }
      catch (error) { finish(error); }
    });
  });
}

async function readStdin() {
  const chunks = []; let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > MAX_INPUT_BYTES) throw new Error('Adapter input exceeded the limit');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const payload = await readStdin();
    const result = await runHermesOneShot(payload);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${String(error instanceof Error ? error.message : error).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500)}\n`);
    process.exitCode = 1;
  }
}
