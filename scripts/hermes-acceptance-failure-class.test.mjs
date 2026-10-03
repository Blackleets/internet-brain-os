import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifyAcceptanceFailure, summarizeLiveVerification } from './hermes-live-journey-assessment.mjs';

const ids = ['P1', 'P2', 'P4', 'P5', 'P3', 'H1', 'H2', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];
const live = (failing, extra = {}) => ({
  mode: 'live-authentic-runtime',
  ok: failing.length === 0 && !extra.blocked,
  checks: ids.map((id) => ({ id, passed: !failing.includes(id) })),
  ...extra,
});

describe('live acceptance failure class (reporting only)', () => {
  it('is undefined when acceptance passed', () => {
    expect(classifyAcceptanceFailure(live([]))).toBeUndefined();
  });

  it('names the live zero-SUPPORT-Find outcome distinctly when only L5/L6 failed', () => {
    const result = classifyAcceptanceFailure(live(['L5', 'L6']));
    expect(result.class).toBe('live-no-supported-find');
    expect(result.failedChecks).toEqual(['L5', 'L6']);
    expect(result.summary).toMatch(/SUPPORT/);
  });

  it('never classifies a pipeline failure as the live zero-Find outcome', () => {
    for (const failing of [['L4', 'L5', 'L6'], ['L5', 'L6', 'L7'], ['L1', 'L5', 'L6'], ['L5'], ['P3'], ['H1']]) {
      expect(classifyAcceptanceFailure(live(failing)).class, failing.join(',')).toBe('pipeline');
    }
    expect(classifyAcceptanceFailure(live(['L5', 'L6'], { blocked: 'Kernel did not become healthy' })).class).toBe('blocked');
    expect(classifyAcceptanceFailure({ ...live(['L5', 'L6']), mode: 'boundary-authority' }).class).toBe('pipeline');
  });

  it('flags SUPPORT-passed-but-no-Find as a pipeline bug, never as honest live variance', () => {
    // Live runs 36410493201 / 37126313645: phase=forged (SUPPORT passed) yet L5/L6=0 were labelled
    // live-no-supported-find while the lead classifier was dropping the SUPPORT Finds.
    const dropped = classifyAcceptanceFailure(live(['L5', 'L6'], { verification: [{ supported: true }, { supported: false }] }));
    expect(dropped.class).toBe('live-supported-find-dropped');
    expect(dropped.summary).toMatch(/1 fetched page/);
    const honest = classifyAcceptanceFailure(live(['L5', 'L6'], { verification: [{ supported: false, reason: 'insufficient_term_coverage' }] }));
    expect(honest.class).toBe('live-no-supported-find');
    expect(honest.summary).toMatch(/1 fetched page\(s\), 0 SUPPORT/);
  });

  it('summarizes per-candidate verification without query strings, text or snippets', () => {
    const summary = summarizeLiveVerification({
      searchCandidates: [{ id: 'c1', url: 'https://git-scm.com/doc?session=abc#top', text: 'UNTRUSTED SNIPPET' }, { id: 'c2', url: 'https://example.com/' }],
      verificationResults: [
        { candidateId: 'c1', status: 'verified', sourceUrl: 'https://git-scm.com/doc?session=abc#top', supported: true, supportReason: 'supported' },
        { candidateId: 'c2', status: 'verification_failed', reason: 'fetch_failed' },
      ],
    });
    expect(summary).toEqual([
      { status: 'verified', source: 'git-scm.com/doc', supported: true, reason: 'supported' },
      { status: 'verification_failed', source: 'example.com/', supported: false, reason: 'fetch_failed' },
    ]);
    expect(JSON.stringify(summary)).not.toMatch(/UNTRUSTED|session=/);
    expect(summarizeLiveVerification(undefined)).toEqual([]);
  });

  it('does not change pass criteria: the runner still exits on report.ok alone', () => {
    const runner = readFileSync(new URL('./hermes-acceptance-runner.mjs', import.meta.url), 'utf8');
    expect(runner).toContain('ok: !blocked && all.every((check) => check.passed),');
    expect(runner).toContain('process.exitCode = report.ok ? 0 : 1;');
    expect(runner).toContain('report.failureClass = classifyAcceptanceFailure(');
  });
});
