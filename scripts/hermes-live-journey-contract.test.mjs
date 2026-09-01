import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIVE_VALUE_GOAL, isObservableMissionOutcome, liveTerminalDetail, resolveLiveTimeoutBudget } from './hermes-acceptance-runner.mjs';

const runner = readFileSync(new URL('./hermes-acceptance-runner.mjs', import.meta.url), 'utf8');
const assessment = readFileSync(new URL('./hermes-live-journey-assessment.mjs', import.meta.url), 'utf8');

describe('G5.3 authentic public-web acceptance contract', () => {
  it('extends the existing live runner instead of creating a second executor path', () => {
    expect(runner).toContain("import { assessLivePublicWebJourney, isHonestBlockedMissionOutcome } from './hermes-live-journey-assessment.mjs';");
    expect(runner).toContain('const journey = await readLiveJourney(baseUrl, token, goalId, outcome);');
    expect(runner).toContain('checks.push(...assessLivePublicWebJourney(journey));');
  });

  it('keeps the deterministic boundary mode separate from live Internet evidence collection', () => {
    expect(runner).toContain('if (live) {');
    expect(runner).toContain("mode: live ? 'live-authentic-runtime' : 'boundary-authority'");
    expect(runner).toContain('const goalInput = live ? LIVE_VALUE_GOAL : BOUNDARY_GOAL;');
    expect(runner).not.toContain('process.env.HEPHAESTUS_ACCEPTANCE_LIVE');
  });

  it('uses a durable public-page goal whose fetched body can independently satisfy the tool classifier', () => {
    expect(LIVE_VALUE_GOAL).toEqual({
      title: 'Find the official documentation for the Git version control system',
      categories: ['tool'],
      keywords: ['Git', 'documentation', 'installation', 'license', 'API', 'open source', 'version control'],
      priority: 2,
    });
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

  it('keeps the adapter, worker and acceptance deadlines strictly nested', () => {
    expect(resolveLiveTimeoutBudget({})).toEqual({
      adapterMs: 12 * 60_000,
      workerMs: 15 * 60_000,
      terminalMs: 16 * 60_000,
    });
    expect(resolveLiveTimeoutBudget({
      HEPHAESTUS_HERMES_ONESHOT_TIMEOUT_MS: '1500000',
      HEPHAESTUS_HERMES_WORKER_TIMEOUT_MS: '1560000',
      HEPHAESTUS_ACCEPTANCE_TERMINAL_TIMEOUT_MS: '1920000',
    })).toEqual({ adapterMs: 1_500_000, workerMs: 1_560_000, terminalMs: 1_920_000 });
    expect(() => resolveLiveTimeoutBudget({
      HEPHAESTUS_HERMES_ONESHOT_TIMEOUT_MS: '1200000',
      HEPHAESTUS_HERMES_WORKER_TIMEOUT_MS: '900000',
      HEPHAESTUS_ACCEPTANCE_TERMINAL_TIMEOUT_MS: '900000',
    })).toThrow('adapter < mission worker < acceptance');
  });

  it('stops observing after an explicitly recorded bounded-attempt failure', () => {
    expect(isObservableMissionOutcome({ status: 'queued', attempt: 1 })).toBe(false);
    expect(isObservableMissionOutcome({ status: 'queued', attempt: 1, lastFailure: { reason: 'adapter timeout' } })).toBe(true);
    expect(isObservableMissionOutcome({ status: 'completed' })).toBe(true);
    expect(isObservableMissionOutcome({ status: 'failed' })).toBe(true);
  });

  it('admits an honest blocked Kernel investigation without requiring Completado', () => {
    expect(isObservableMissionOutcome({
      status: 'running',
      executionPhase: 'verifying',
      verificationResults: [{ candidateId: 'search-candidate:a', status: 'verified', supported: false }],
      resultSummary: { evidenceCreated: 1 },
    })).toBe(true);
    expect(isObservableMissionOutcome({
      status: 'running',
      executionPhase: 'verifying',
    })).toBe(false);
    expect(isObservableMissionOutcome({
      status: 'running',
      executionPhase: 'verifying',
      verificationResults: [],
      resultSummary: { evidenceCreated: 1 },
    })).toBe(false);
    expect(isObservableMissionOutcome({
      status: 'running',
      executionPhase: 'verifying',
      verificationResults: [{ candidateId: 'search-candidate:a', status: 'verification_failed' }],
      resultSummary: { evidenceCreated: 0 },
    })).toBe(false);
    expect(runner).toContain("passed: outcome.status === 'completed' || isHonestBlockedMissionOutcome(outcome)");
    expect(assessment).toContain("surface?.mission?.workState === 'forged'");
    expect(assessment).toContain("surface?.mission?.workState === 'verifying' && isHonestBlockedMissionOutcome(mission)");
  });

  it('carries the bounded failure reason into the sanitizable live report detail', () => {
    expect(liveTerminalDetail({
      status: 'queued', executionPhase: 'queued', attempt: 1, lastFailure: { reason: 'provider rejected model' },
    })).toContain('failure="provider rejected model"');
  });
});
