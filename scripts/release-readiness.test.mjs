import { describe, expect, it } from 'vitest';

import {
  evaluateProductionAudit,
  executeProductionAudit,
  main,
  parseAuditReport,
} from './release-readiness.mjs';

function auditJson({ info = 0, low = 0, moderate = 0, high = 0, critical = 0, totalDependencies = 80 } = {}) {
  return JSON.stringify({
    advisories: {},
    metadata: {
      vulnerabilities: { info, low, moderate, high, critical },
      dependencies: 21,
      devDependencies: 0,
      optionalDependencies: 59,
      totalDependencies,
    },
  });
}

function fakeRunCommand(result) {
  const calls = [];
  return {
    calls,
    runCommand: async (command, args, options) => {
      calls.push({ command, args, options });
      return result;
    },
  };
}

describe('release readiness production audit parsing', () => {
  it('parses a clean pnpm audit report', () => {
    const report = parseAuditReport(auditJson());
    expect(report.total).toBe(0);
    expect(report.bySeverity).toEqual({ critical: 0, high: 0, moderate: 0, low: 0, info: 0 });
    expect(report.dependencies).toBe(80);
  });

  it('parses per-severity vulnerability counts', () => {
    const report = parseAuditReport(auditJson({ critical: 1, high: 2, low: 1 }));
    expect(report.total).toBe(4);
    expect(report.bySeverity.critical).toBe(1);
    expect(report.bySeverity.high).toBe(2);
  });

  it('rejects unparseable or shapeless output instead of treating it as clean', () => {
    expect(parseAuditReport('not json')).toBeNull();
    expect(parseAuditReport('')).toBeNull();
    expect(parseAuditReport('{"metadata":{}}')).toBeNull();
  });
});

describe('release readiness production audit evaluation', () => {
  it('is green only when the executed audit exits 0 with zero vulnerabilities', async () => {
    const { calls, runCommand } = fakeRunCommand({ exitCode: 0, stdout: auditJson(), stderr: '' });
    const audit = await executeProductionAudit({ runCommand });
    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe('pnpm');
    expect(calls[0].args).toEqual(['audit', '--prod', '--json']);
    expect(audit.status).toBe('green');
    expect(audit.evidence).toContain('0 vulnerabilities');
  });

  it('is red when the executed audit reports vulnerabilities, even on exit 1', async () => {
    const { runCommand } = fakeRunCommand({
      exitCode: 1,
      stdout: auditJson({ critical: 1, high: 2, moderate: 3 }),
      stderr: '',
    });
    const audit = await executeProductionAudit({ runCommand });
    expect(audit.status).toBe('red');
    expect(audit.evidence).toContain('6 vulnerabilities');
    expect(audit.evidence).toContain('critical: 1');
    expect(audit.evidence).toContain('high: 2');
    expect(audit.evidence).toContain('moderate: 3');
  });

  it('is unverified — never green — when the audit cannot be executed', async () => {
    const { runCommand } = fakeRunCommand({
      exitCode: null,
      stdout: '',
      stderr: '',
      error: 'spawn pnpm ENOENT',
    });
    const audit = await executeProductionAudit({ runCommand });
    expect(audit.status).toBe('unverified');
    expect(audit.evidence).toContain('could not be executed');
  });

  it('is unverified when the audit times out', async () => {
    const { runCommand } = fakeRunCommand({ exitCode: null, stdout: '', stderr: '', timedOut: true });
    const audit = await executeProductionAudit({ runCommand, timeoutMs: 5000 });
    expect(audit.status).toBe('unverified');
    expect(audit.evidence).toContain('5000ms');
  });

  it('is unverified when the audit output cannot be parsed', () => {
    const audit = evaluateProductionAudit({ exitCode: 0, stdout: 'pnpm exploded', stderr: '' });
    expect(audit.status).toBe('unverified');
  });

  it('is unverified when the audit reports zero vulnerabilities but exits non-zero', () => {
    const audit = evaluateProductionAudit({ exitCode: 2, stdout: auditJson(), stderr: '' });
    expect(audit.status).toBe('unverified');
  });

  it('is unverified when the command runner itself throws', async () => {
    const audit = await executeProductionAudit({
      runCommand: async () => {
        throw new Error('runner unavailable');
      },
    });
    expect(audit.status).toBe('unverified');
    expect(audit.evidence).toContain('runner unavailable');
  });
});

describe('release readiness verdict', () => {
  function captureLog() {
    const lines = [];
    return { lines, log: (...args) => lines.push(args.join(' ')) };
  }

  it('prints GREEN and the executed-audit evidence when the audit is clean', async () => {
    const { lines, log } = captureLog();
    const { runCommand } = fakeRunCommand({ exitCode: 0, stdout: auditJson(), stderr: '' });
    await main({ runCommand, log });
    expect(lines[0]).toBe('Efesto MVP release readiness: GREEN');
    expect(lines).toContain('strict-supply-chain-audit: green');
    expect(lines.some((line) => line.startsWith('strict-supply-chain-audit-evidence: pnpm audit --prod executed: 0 vulnerabilities'))).toBe(true);
  });

  it('blocks the verdict when the executed audit finds vulnerabilities', async () => {
    const { lines, log } = captureLog();
    const { runCommand } = fakeRunCommand({
      exitCode: 1,
      stdout: auditJson({ critical: 2 }),
      stderr: '',
    });
    await expect(main({ runCommand, log })).rejects.toThrow(/strict-supply-chain-audit is red/);
    expect(lines[0]).toBe('Efesto MVP release readiness: BLOCKED');
    expect(lines).toContain('strict-supply-chain-audit: red');
    expect(lines).not.toContain('strict-supply-chain-audit: green');
  });

  it('blocks the verdict and never prints green when the audit is unverified', async () => {
    const { lines, log } = captureLog();
    const { runCommand } = fakeRunCommand({
      exitCode: null,
      stdout: '',
      stderr: '',
      error: 'spawn pnpm ENOENT',
    });
    await expect(main({ runCommand, log })).rejects.toThrow(/strict-supply-chain-audit is unverified/);
    expect(lines[0]).toBe('Efesto MVP release readiness: BLOCKED');
    expect(lines).toContain('strict-supply-chain-audit: unverified');
    expect(lines).not.toContain('strict-supply-chain-audit: green');
  });
});
