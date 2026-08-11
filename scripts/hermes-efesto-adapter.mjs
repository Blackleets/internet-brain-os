import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_INPUT_BYTES = 128 * 1024;
const MAX_OUTPUT_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 12 * 60_000;
const MAX_TIMEOUT_MS = 25 * 60_000;
const FORCE_KILL_DELAY_MS = 500;
const MAX_AGENT_TURNS = 8;
const DEFAULT_AGENT_TURNS = 8;

export function buildHermesPrompt(payload) {
  if (!payload || payload.schemaVersion !== 'efesto.hermes-mission.v1' || !payload.mission) {
    throw new Error('Expected one efesto.hermes-mission.v1 mission object');
  }
  const mission = payload.mission;
  const scope = mission.scope ?? {};
  return [
    '/no_think',
    'You are executing one bounded public-source discovery mission for Efesto.',
    'Use only public web search. The returned snippets are candidates, not verified Evidence.',
    'Do not access local files, private networks, credentials, messaging history, private sessions, browser automation or computer-use.',
    'Do not perform purchases, submissions, logins, outreach, downloads or destructive actions.',
    'Prefer canonical, directly readable public pages with substantive content; avoid login walls, paywalls, redirectors, search-result pages and JavaScript-only shells.',
    'Use no more than two public search calls before returning the final JSON.',
    'Return 3 to 5 relevant findings when public search supports them, using diverse source hosts where practical.',
    'Return ONLY one valid JSON object with this exact top-level shape: {"findings":[...]}.',
    'Each finding may contain only url, title, text, summary, and discoveredAt. Keep every string on one line, escape it as JSON, and do not use trailing commas.',
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
  return ['--ignore-rules', '--toolsets', 'search', '-z', prompt];
}

export function buildHermesEnvironment(baseEnv, hermesHome) {
  if (typeof hermesHome !== 'string' || !hermesHome.trim()) throw new Error('An isolated Hermes home is required');
  const env = {
    ...baseEnv,
    HERMES_HOME: hermesHome,
    HERMES_ALLOW_PRIVATE_URLS: 'false',
    HERMES_IGNORE_RULES: '1',
  };
  delete env.HERMES_SAFE_MODE;
  delete env.HERMES_ENABLE_PROJECT_PLUGINS;
  return env;
}

export async function prepareHermesHome(hermesHome, maxTurns = DEFAULT_AGENT_TURNS) {
  if (typeof hermesHome !== 'string' || !hermesHome.trim()) throw new Error('An isolated Hermes home is required');
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > MAX_AGENT_TURNS) throw new Error(`Hermes max turns must be an integer between 1 and ${MAX_AGENT_TURNS}`);
  const configPath = join(hermesHome, 'config.yaml');
  const config = { agent: { max_turns: maxTurns } };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  return configPath;
}

export function normalizeHermesExecutable(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Hermes executable is required');
  const executable = value.trim();
  return isAbsolute(executable) || executable.includes('/') || executable.includes('\\')
    ? resolve(executable)
    : executable;
}

export function parseHermesFindings(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Hermes returned empty output');
  const trimmed = text.trim();
  const withoutThinking = trimmed.replace(/^(?:<think>[\s\S]*?<\/think>\s*)+/i, '');
  const candidate = withoutThinking.startsWith('```')
    ? withoutThinking.replace(/^```\s*(?:json\s*)?/i, '').replace(/\s*```$/, '')
    : withoutThinking;
  let parsed;
  try { parsed = JSON.parse(candidate); }
  catch {
    const shape = `chars=${trimmed.length} think=${trimmed.startsWith('<think>')} fence=${withoutThinking.startsWith('```')} findings=${/\{\s*"findings"\s*:/.test(candidate)}`;
    throw new Error(`Hermes did not return valid JSON (${shape})`);
  }
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

function configuredTimeout(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 60_000 || parsed > MAX_TIMEOUT_MS) {
    throw new Error('HEPHAESTUS_HERMES_ONESHOT_TIMEOUT_MS must be between 60000 and 1500000');
  }
  return parsed;
}

export async function runHermesOneShot(payload, options = {}) {
  const executable = normalizeHermesExecutable(options.executable ?? process.env.HEPHAESTUS_HERMES_EXECUTABLE ?? 'hermes');
  const prompt = buildHermesPrompt(payload);
  const args = buildHermesArgs(prompt);
  const timeoutMs = options.timeoutMs ?? configuredTimeout(process.env.HEPHAESTUS_HERMES_ONESHOT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const ownsHermesHome = options.hermesHome === undefined;
  const hermesHome = options.hermesHome ?? await mkdtemp(join(tmpdir(), 'efesto-hermes-'));
  const baseEnv = options.env ?? process.env;
  const maxTurns = configuredMaxTurns(options.maxTurns ?? baseEnv.HEPHAESTUS_HERMES_MAX_TURNS);
  try {
    await prepareHermesHome(hermesHome, maxTurns);
    return await runHermesProcess({
      executable,
      args,
      timeoutMs,
      env: buildHermesEnvironment(baseEnv, hermesHome),
      cwd: hermesHome,
    });
  } finally {
    if (ownsHermesHome) {
      await rm(hermesHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  }
}

function configuredMaxTurns(value) {
  if (value === undefined || value === '') return DEFAULT_AGENT_TURNS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_AGENT_TURNS) {
    throw new Error(`HEPHAESTUS_HERMES_MAX_TURNS must be an integer between 1 and ${MAX_AGENT_TURNS}`);
  }
  return parsed;
}

export function runHermesProcess({ executable, args, timeoutMs, env, cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
      cwd,
    });
    let stdout = ''; let stderr = ''; let bytes = 0; let settled = false; let pendingError; let forceKillTimer;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceKillTimer);
      error ? reject(error) : resolve(value);
    };
    const requestStop = (error) => {
      if (settled || pendingError) return;
      pendingError = error;
      child.kill();
      forceKillTimer = setTimeout(() => { if (!settled) child.kill('SIGKILL'); }, FORCE_KILL_DELAY_MS);
    };
    const timer = setTimeout(() => requestStop(new Error('Hermes one-shot timed out')), timeoutMs);
    const collect = (chunk, target) => {
      if (pendingError) return;
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT_BYTES) { requestStop(new Error('Hermes output exceeded the limit')); return; }
      if (target === 'stdout') stdout += chunk; else stderr += chunk;
    };
    child.stdout.on('data', (chunk) => collect(chunk, 'stdout'));
    child.stderr.on('data', (chunk) => collect(chunk, 'stderr'));
    child.on('error', (error) => finish(pendingError ?? error));
    child.on('close', (code) => {
      if (pendingError) return finish(pendingError);
      if (code !== 0) return finish(new Error(processFailure('Hermes', code, stderr)));
      try { finish(undefined, parseHermesFindings(stdout)); }
      catch (error) { finish(error); }
    });
  });
}

function processFailure(label, code, stderr) {
  const diagnostic = String(stderr ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/((?:authorization|[a-z0-9_-]*api[_-]?key|[a-z0-9_-]*token)\s*[:=]\s*)(?:bearer\s+)?[^\s,"']+/gi, '$1<redacted-secret>')
    .replace(/\b(?:sk|pk|ghp|gho|xox[abps])[-_][A-Za-z0-9._-]{8,}/gi, '<redacted-secret>')
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, '<redacted-secret>')
    .replace(/[A-Za-z]:\\[^\s"']+/g, '<redacted-path>')
    .replace(/\/(?:home|Users)\/[^\s"']+/g, '<redacted-path>')
    .trim()
    .slice(0, 400);
  return `${label} exited with code ${code}${diagnostic ? `: ${diagnostic}` : ''}`;
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
