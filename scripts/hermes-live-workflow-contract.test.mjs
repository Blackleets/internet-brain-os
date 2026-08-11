import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = () => readFileSync(resolve('.github/workflows/hermes-live-public-web-acceptance.yml'), 'utf8');

describe('authentic Hermes public-web workflow contract', () => {
  it('is explicit, read-only and pinned to the reviewed Hermes runtime', () => {
    const source = workflow();
    expect(source).toContain('workflow_dispatch:');
    expect(source).not.toContain('pull_request:');
    expect(source).not.toContain('push:');
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

  it('fails closed without the provider secret and publishes only the sanitized report', () => {
    const source = workflow();
    expect(source).toContain('secrets.HEPHAESTUS_LIVE_OPENROUTER_API_KEY');
    expect(source).toContain('if [ -z "${OPENROUTER_API_KEY:-}" ]');
    expect(source).toContain('HEPHAESTUS_HERMES_EXECUTABLE:');
    expect(source).toContain('HERMES_INFERENCE_MODEL: ${{ inputs.model }}');
    expect(source).toContain('pnpm hermes:acceptance:live');
    expect(source).toContain('path: .hephaestus/live-acceptance-report.json');
    expect(source).not.toContain('HERMES_ENABLE_PROJECT_PLUGINS');
    expect(source).not.toContain('--safe-mode');
  });
});
