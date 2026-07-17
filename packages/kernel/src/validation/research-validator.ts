import type { Evidence, Report } from '@internet-brain-os/shared';

export interface ValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

export function validateResearchOutput(evidence: readonly Evidence[], report: Report): ValidationResult {
  const issues: ValidationIssue[] = [];
  const evidenceIds = new Set(evidence.map((item) => item.id));

  for (const section of report.sections) {
    for (const evidenceId of section.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        issues.push({ code: 'MISSING_EVIDENCE', message: `Report references missing evidence: ${evidenceId}`, severity: 'error' });
      }
    }
  }

  if (evidence.length === 0) {
    issues.push({ code: 'NO_EVIDENCE', message: 'Report was generated without collected evidence.', severity: 'warning' });
  }

  if (report.limitations.length === 0) {
    issues.push({ code: 'NO_LIMITATIONS', message: 'Report does not declare limitations.', severity: 'warning' });
  }

  return { valid: !issues.some((issue) => issue.severity === 'error'), issues };
}
