import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = () => readFileSync(resolve('.github/workflows/hermes-live-public-web-acceptance.yml'), 'utf8');

describe('authentic Hermes public-web workflow contract', () => {
  it('is explicit, read-only and pinned to the reviewed Hermes runtime', () => {
    const source = workflow();
    expect(source).toContain('workflow_dispatch:');
    expect(source).toContain('pull_request:');
    expect(source).toContain('push:');
    expect(source).toContain('branches:\n      - main');
    expect(source).toContain('paths:\n      - .github/workflows/hermes-live-public-web-acceptance.yml');
    expect(source).not.toContain('branches:\n      - master');
    expect(source).toContain("if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository");
    expect(source).toContain('permissions:\n  contents: read');
    expect(source).toContain('ee4bb75b532e932a1055d9a710802a7435163b6a');
    expect(source).toContain('repository: NousResearch/hermes-agent');
    expect(source).toContain('persist-credentials: false');
    expect(source).toContain('uv sync --locked --python 3.11');
    expect(source).toContain('uv pip install ddgs==9.14.4');

    const uses = [...source.matchAll(/^\s*(?:- )?uses: ([^\s]+)$/gm)].map((match) => match[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) expect(action).toMatch(/@[0-9a-f]{40}$/);
  });

  it('uses one verified loopback model and publishes only the sanitized report', () => {
    const source = workflow();
    expect(source).toContain('OLLAMA_VERSION: 0.32.8');
    expect(source).toContain('OLLAMA_ARCHIVE_SHA256: c10b76c39cb72908cc92dff314e80e32736c03f1287efb4b39e0b70fd600cc64');
    expect(source).toContain('ollama-linux-amd64.tar.zst');
    expect(source).not.toContain('install.sh');
    expect(source).toContain('OLLAMA_MODEL: qwen3:1.7b');
    expect(source).toContain('OLLAMA_MODEL_ID: 8f68893c685c');
    expect(source).toContain('actual_model_id');
    expect(source).toContain('HERMES_INFERENCE_PROVIDER: custom');
    expect(source).toContain('CUSTOM_BASE_URL: http://127.0.0.1:11434/v1');
    expect(source).toContain('HEPHAESTUS_HERMES_ONESHOT_TIMEOUT_MS: 1500000');
    expect(source).toContain('HEPHAESTUS_HERMES_WORKER_TIMEOUT_MS: 1560000');
    expect(source).toContain('HEPHAESTUS_ACCEPTANCE_TERMINAL_TIMEOUT_MS: 1620000');
    expect(source).toContain('HEPHAESTUS_HERMES_MAX_TURNS: 4');
    expect(source).toContain('HEPHAESTUS_AUTOMATIC_MISSION_ATTEMPTS: 1');
    expect(source).toContain('timeout-minutes: 60');
    expect(source).toContain('HEPHAESTUS_HERMES_EXECUTABLE:');
    expect(source).toContain('HERMES_INFERENCE_MODEL: ${{ env.OLLAMA_MODEL }}');
    expect(source).toContain('pnpm hermes:acceptance:live');
    expect(source).toContain('path: .hephaestus/live-acceptance-report.json');
    expect(source).not.toContain('secrets.');
    expect(source).not.toContain('OPENROUTER_API_KEY');
    expect(source).not.toContain('HERMES_ENABLE_PROJECT_PLUGINS');
    expect(source).not.toContain('--safe-mode');
  });
});
