import type { IsoDateTime } from '@internet-brain-os/shared';
import type { HermesExecutionEvent } from './hermes-execution-mapper';

export interface HermesAgentEvidenceOutput {
  readonly id: string;
  readonly requirementKey: string;
  readonly verified: boolean;
  readonly recordedAt: IsoDateTime;
}

export interface HermesAgentClaimOutput {
  readonly id: string;
  readonly statement: string;
  readonly confidence: number;
  readonly evidenceIds: readonly string[];
  readonly proposedAt: IsoDateTime;
}

export interface HermesAgentRunOutput {
  readonly runId: string;
  readonly missionId: string;
  readonly taskId: string;
  readonly startedAt: IsoDateTime;
  readonly completedAt: IsoDateTime;
  readonly summary: string;
  readonly evidence: readonly HermesAgentEvidenceOutput[];
  readonly claim: HermesAgentClaimOutput;
}

export class InvalidHermesAgentOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidHermesAgentOutputError';
  }
}

const FORBIDDEN_KERNEL_AUTHORITY_FIELDS = [
  'candidate',
  'validation',
  'contradiction',
  'admission',
  'claimValidation',
  'durableClaim',
  'knowledgeAdmission',
] as const;

/**
 * Converts an explicit Hermes Agent run export into the narrow event contract
 * accepted by the Kernel ingestion path. This adapter is intentionally dumb:
 * it normalizes operational output into events but never accepts Kernel-owned
 * validation, contradiction, admission, or durable knowledge fields.
 */
export class HermesAgentOutputAdapter {
  toExecutionEvents(output: HermesAgentRunOutput): readonly HermesExecutionEvent[] {
    this.assertNoAuthorityFields(output);
    this.validate(output);

    return [
      {
        type: 'run_started',
        missionId: output.missionId,
        taskId: output.taskId,
        at: output.startedAt,
      },
      ...output.evidence.map((item): HermesExecutionEvent => ({
        type: 'evidence_recorded',
        evidenceId: item.id,
        requirementKey: item.requirementKey,
        verified: item.verified,
        at: item.recordedAt,
      })),
      {
        type: 'claim_proposed',
        proposalId: output.claim.id,
        statement: output.claim.statement,
        confidence: output.claim.confidence,
        evidenceIds: [...output.claim.evidenceIds],
        at: output.claim.proposedAt,
      },
      {
        type: 'run_completed',
        summary: output.summary,
        at: output.completedAt,
      },
    ];
  }

  private assertNoAuthorityFields(value: unknown, path = 'output'): void {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if ((FORBIDDEN_KERNEL_AUTHORITY_FIELDS as readonly string[]).includes(key)) {
        throw new InvalidHermesAgentOutputError(`Hermes Agent output cannot include Kernel authority field: ${path}.${key}`);
      }
      if (item && typeof item === 'object') this.assertNoAuthorityFields(item, `${path}.${key}`);
    }
  }

  private validate(output: HermesAgentRunOutput): void {
    if (!isNonEmptyString(output.runId)) throw new InvalidHermesAgentOutputError('runId is required.');
    if (!isNonEmptyString(output.missionId)) throw new InvalidHermesAgentOutputError('missionId is required.');
    if (!isNonEmptyString(output.taskId)) throw new InvalidHermesAgentOutputError('taskId is required.');
    if (!isNonEmptyString(output.summary)) throw new InvalidHermesAgentOutputError('summary is required.');
    assertIso(output.startedAt, 'startedAt');
    assertIso(output.completedAt, 'completedAt');
    if (new Date(output.completedAt).getTime() < new Date(output.startedAt).getTime()) {
      throw new InvalidHermesAgentOutputError('completedAt cannot precede startedAt.');
    }
    if (!Array.isArray(output.evidence) || output.evidence.length === 0) {
      throw new InvalidHermesAgentOutputError('At least one evidence item is required.');
    }

    const evidenceIds = new Set<string>();
    for (const item of output.evidence) {
      if (!isNonEmptyString(item.id) || evidenceIds.has(item.id)) {
        throw new InvalidHermesAgentOutputError(`Duplicate or empty evidence id: ${item.id}`);
      }
      evidenceIds.add(item.id);
      if (!isNonEmptyString(item.requirementKey)) throw new InvalidHermesAgentOutputError(`Evidence ${item.id} missing requirementKey.`);
      if (typeof item.verified !== 'boolean') throw new InvalidHermesAgentOutputError(`Evidence ${item.id} verified must be boolean.`);
      assertIso(item.recordedAt, `evidence.${item.id}.recordedAt`);
    }

    const claim = output.claim;
    if (!claim || typeof claim !== 'object') throw new InvalidHermesAgentOutputError('claim is required.');
    if (!isNonEmptyString(claim.id)) throw new InvalidHermesAgentOutputError('claim.id is required.');
    if (!isNonEmptyString(claim.statement)) throw new InvalidHermesAgentOutputError('claim.statement is required.');
    if (!Number.isFinite(claim.confidence) || claim.confidence < 0 || claim.confidence > 1) {
      throw new InvalidHermesAgentOutputError('claim.confidence must be between 0 and 1.');
    }
    assertIso(claim.proposedAt, 'claim.proposedAt');
    if (!Array.isArray(claim.evidenceIds) || claim.evidenceIds.length === 0) {
      throw new InvalidHermesAgentOutputError('claim.evidenceIds must not be empty.');
    }
    for (const evidenceId of claim.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        throw new InvalidHermesAgentOutputError(`claim references unknown evidence: ${evidenceId}`);
      }
    }
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertIso(value: unknown, field: string): void {
  if (!isNonEmptyString(value) || !Number.isFinite(new Date(value).getTime())) {
    throw new InvalidHermesAgentOutputError(`${field} must be a valid ISO timestamp.`);
  }
}
