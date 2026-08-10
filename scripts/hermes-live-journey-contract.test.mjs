import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runner = readFileSync(new URL('./hermes-acceptance-runner.mjs', import.meta.url), 'utf8');
const assessment = readFileSync(new URL('./hermes-live-journey-assessment.mjs', import.meta.url), 'utf8');

describe('G5.3 authentic public-web acceptance contract', () => {
  it('extends the existing live runner instead of creating a second executor path', () => {
    expect(runner).toContain("import { assessLivePublicWebJourney } from './hermes-live-journey-assessment.mjs';");
    expect(runner).toContain('const journey = await readLiveJourney(baseUrl, token, goalId, outcome);');
    expect(runner).toContain('checks.push(...assessLivePublicWebJourney(journey));');
  });

  it('keeps the deterministic boundary mode separate from live Internet evidence collection', () => {
    expect(runner).toContain('if (live) {');
    expect(runner).toContain("mode: live ? 'live-authentic-runtime' : 'boundary-authority'");
    expect(runner).toContain('const goalInput = live ? LIVE_VALUE_GOAL : BOUNDARY_GOAL;');
    expect(runner).not.toContain('process.env.HEPHAESTUS_ACCEPTANCE_LIVE');
  });

  it('collects journey evidence only through authenticated Kernel APIs', () => {
    expect(runner).toContain("api(baseUrl, token, '/api/opportunities')");
    expect(runner).toContain('`/api/browser/case/${encodeURIComponent(caseId)}`');
    expect(runner).toContain('`/api/goal-surfaces/${encodeURIComponent(goalId)}`');
    expect(runner).not.toContain("readFile(dataDir");
  });

  it('proves the epistemic boundary with Kernel web.read provenance rather than text inequality', () => {
    expect(assessment).toContain("record.extractionMethod === 'kernel-web-read-v1'");
    expect(assessment).toContain("record.sourceReceiptId.startsWith('web-read:')");
    expect(assessment).toContain('record.missionId === mission?.id');
    expect(assessment).toContain('candidateIds.has(record.candidateId)');
    expect(assessment).not.toContain('record.rawText !==');
  });
});
