import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DASHBOARD_PORT, KERNEL_PORT, MODEL, kernelEnv, parseEnvFile, renderWorkerEnv, stackPlan, windowsStackPaths, workerEnvEntries, writeConfig,
} from './efesto-windows-stack.mjs';

const winEnv = { LOCALAPPDATA: 'C:\\Users\\Usuario\\AppData\\Local', EFESTO_PLATFORM: 'win32' };
const repo = 'C:\\Users\\Usuario\\efesto';
const root = new URL('../../', import.meta.url);
const text = (rel) => readFileSync(new URL(rel, root), 'utf8');

describe('Windows one-click stack configuration', () => {
  it('puts everything under %LOCALAPPDATA% and uses the standard Hermes venv the launcher already detects', () => {
    const p = windowsStackPaths(winEnv, repo);
    expect(p.base).toContain('AppData');
    expect(p.base.endsWith('Efesto')).toBe(true);
    expect(p.tokenFile).toMatch(/kernel-data.kernel-api-token$/);
    expect(p.hermesExecutable.replaceAll('/', '\\')).toMatch(/hermes\\hermes-agent\\venv\\Scripts\\hermes\.exe$/);
  });

  it('generates the same worker environment as the box example (no secrets) plus the Windows locations', () => {
    const p = windowsStackPaths(winEnv, repo);
    const env = parseEnvFile(renderWorkerEnv(p));
    const example = parseEnvFile(text('scripts/live-box/hermes-worker-env.example'));
    for (const key of Object.keys(example).filter((k) => k !== 'HEPHAESTUS_HERMES_EXECUTABLE')) expect(env[key]).toBe(example[key]);
    expect(env.HERMES_INFERENCE_MODEL).toBe(MODEL);
    expect(env.HEPHAESTUS_SELECTION_BACKEND).toBe('ollama-structured');
    expect(env.EFESTO_KERNEL_URL).toBe(`http://127.0.0.1:${KERNEL_PORT}`);
    expect(env.EFESTO_KERNEL_TOKEN_FILE).toBe(p.tokenFile);
    expect(env.EFESTO_REPO_ROOT).toBe(repo);
    expect(renderWorkerEnv(p)).not.toMatch(/TOKEN=(?!.*kernel-api-token)/);
    expect(workerEnvEntries(p).every(([, v]) => !/198\.18\./.test(v))).toBe(true);
  });

  it('pins the Kernel to 4310 with a private data dir and plans the five steps in order', () => {
    const p = windowsStackPaths(winEnv, repo);
    const env = kernelEnv(p, {});
    expect(env.HEPHAESTUS_PORT).toBe('4310');
    expect(env.HEPHAESTUS_DATA_DIR).toBe(p.dataDir);
    expect(stackPlan(p).map((s) => s.id)).toEqual(['config', 'ollama', 'kernel', 'dashboard', 'worker']);
    expect(stackPlan(p).find((s) => s.id === 'dashboard').label).toContain(String(DASHBOARD_PORT));
  });

  it('writes the config idempotently (second run changes nothing)', async () => {
    const home = await mkdtemp(join(tmpdir(), 'efesto-stack-'));
    const p = windowsStackPaths({ EFESTO_HOME: home }, repo);
    expect((await writeConfig(p)).changed).toBe(true);
    expect((await writeConfig(p)).changed).toBe(false);
    expect(parseEnvFile(await readFile(p.workerEnvFile, 'utf8')).HERMES_INFERENCE_MODEL).toBe(MODEL);
  });

  it('plan is a dry run that prints the steps without starting anything', async () => {
    const home = await mkdtemp(join(tmpdir(), 'efesto-plan-'));
    const out = execFileSync(process.execPath, [new URL('./efesto-windows-stack.mjs', import.meta.url).pathname, 'plan'], { env: { ...process.env, EFESTO_HOME: home }, encoding: 'utf8' });
    const plan = JSON.parse(out);
    expect(plan.steps).toHaveLength(5);
    expect(plan.workerEnv.HEPHAESTUS_HERMES_ONESHOT_TIMEOUT_MS).toBe('240000');
  });
});

describe('Windows one-click entry points', () => {
  const installer = text('scripts/windows/install-efesto-windows.ps1');
  it('installs missing prerequisites with winget and the pinned Hermes + model', () => {
    for (const id of ['Git.Git', 'OpenJS.NodeJS.LTS', 'Python.Python.3.13', 'Ollama.Ollama']) expect(installer).toContain(`'${id}'`);
    expect(installer).toContain("$Model = 'qwen3.5:2b'");
    expect(installer).toMatch(/\$HermesRevision = '[0-9a-f]{7,40}'/);
    expect(installer).toContain('[ddgs]');
    expect(installer).toContain('install-efesto.ps1');
    expect(installer).toContain('[switch]$DryRun');
  });
  it('speaks Spanish to the user and never touches the private-network exception or launch approval', () => {
    expect(installer).toContain('Paso $($script:StepNumber) de');
    expect(installer).toContain('Efesto necesita atención');
    for (const f of ['scripts/windows/install-efesto-windows.ps1', 'scripts/windows/efesto-windows-stack.mjs', 'Instalar Efesto.cmd', 'Iniciar Efesto.cmd', 'Detener Efesto.cmd']) {
      const t = text(f);
      expect(t).not.toMatch(/198\.18/);
      expect(t).not.toMatch(/publicLaunchApproved/);
    }
  });
  it('the three .cmd files are CRLF batch files that call the right scripts', () => {
    const start = text('Iniciar Efesto.cmd'); const stop = text('Detener Efesto.cmd'); const install = text('Instalar Efesto.cmd');
    for (const t of [start, stop, install]) { expect(t.startsWith('@echo off\r\n')).toBe(true); expect(t.replaceAll('\r\n', '')).not.toContain('\n'); }
    expect(start).toContain('efesto-windows-stack.mjs" start');
    expect(start).toContain('copy-token');
    expect(start).toContain('install-efesto-windows.ps1');
    expect(stop).toContain('efesto-windows-stack.mjs" stop');
    expect(install).toContain('install-efesto-windows.ps1');
  });
  it('the queue worker reads its locations from the generated env (no hard-coded box paths required)', () => {
    const w = text('scripts/live-box/queue-worker.mjs');
    for (const k of ['EFESTO_REPO_ROOT', 'EFESTO_KERNEL_URL', 'EFESTO_KERNEL_TOKEN_FILE', 'EFESTO_WORKER_PAUSE_FILE', 'EFESTO_WORKER_RUNS_FILE']) expect(w).toContain(`process.env.${k}`);
    expect(w).toContain('pathToFileURL');
  });
});

describe('Windows PowerShell 5.1 compatibility', () => {
  // PS 5.1 reads a BOM-less .ps1 as the ANSI code page, which garbles Spanish accents (seen on Lewis's PC).
  it('saves the installer scripts with non-ASCII text as UTF-8 with BOM', () => {
    for (const file of ['scripts/windows/install-efesto-windows.ps1', 'scripts/install-efesto.ps1']) {
      const bytes = readFileSync(join(process.cwd(), file));
      expect([bytes[0], bytes[1], bytes[2]], file).toEqual([0xef, 0xbb, 0xbf]);
    }
  });
  it('accepts any installed Python 3.11–3.14 (Hermes Agent requires-python >=3.11,<3.15) before installing one', () => {
    const installer = readFileSync(join(process.cwd(), 'scripts/windows/install-efesto-windows.ps1'), 'utf8');
    expect(installer).toContain('$PythonMinor = @(14, 13, 12, 11)');
    expect(installer).not.toContain('Python.Python.3.14');
    expect(installer).toMatch(/if \(\$foundPython\)[^\n]*else \{ Install-WithWinget 'Python\.Python\.3\.13'/);
  });
});

describe('installer native calls under Windows PowerShell 5.1', () => {
  const installer = readFileSync(join(process.cwd(), 'scripts/windows/install-efesto-windows.ps1'), 'utf8').replace(/^\uFEFF/, '');
  const code = installer.split('\n').filter((line) => !line.trim().startsWith('#'));
  it('runs every native command through Invoke-Native (stderr never becomes a terminating error)', () => {
    const helperStart = code.findIndex((line) => line.startsWith('function Invoke-Native'));
    const helperEnd = code.findIndex((line, i) => i > helperStart && line === '}');
    const outside = code.filter((_, i) => i < helperStart || i > helperEnd);
    expect(outside.filter((line) => /(^|[\s(;])&\s/.test(line))).toEqual([]);
    expect(installer).not.toContain('2>$null');
    const helper = code.slice(helperStart, helperEnd + 1).join('\n');
    expect(helper).toContain("$ErrorActionPreference = 'Continue'");
    expect(helper).toContain('2>&1');
    expect(helper).toMatch(/finally \{\s*\$ErrorActionPreference = \$previous/);
  });
  it('judges Invoke-Checked only by the exit code', () => {
    expect(installer).toMatch(/function Invoke-Checked[\s\S]*?\$r = Invoke-Native \$Exe \$Arguments\s*\n\s*if \(\$r\.Code -ne 0\)/);
    expect(installer).not.toContain('$LASTEXITCODE -ne 0) { throw');
  });
  it('keeps an existing Hermes at its own revision and only adds ddgs', () => {
    const block = installer.slice(installer.indexOf('if (Test-Path $HermesExe) {'), installer.indexOf('if (Test-Path $HermesRoot) {'));
    expect(block).toContain("'rev-parse'");
    expect(block).not.toContain("'checkout'");
    expect(block).toContain("'ddgs==9.16.0'");
    expect(block).toContain("Invoke-Native $venvPython @('-c', 'import ddgs') -Quiet");
  });
});
