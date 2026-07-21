import type { EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import type {
  ClaimEvidenceAssessment,
  ClaimProposal,
  ClaimProposalId,
  MissionExecutionState,
  MissionId,
  MissionTaskId,
  TaskResult,
  TaskResultId,
} from '../mission';
import type { CognitivePipelineRecordId } from '../storage/cognitive-pipeline-types';
import type { HermesCognitiveSubmission } from './hermes-cognitive-adapter';

export type HermesExecutionEvent =
  | { readonly type: 'run_started'; readonly missionId: string; readonly taskId: string; readonly at: IsoDateTime }
  | { readonly type: 'evidence_recorded'; readonly evidenceId: string; readonly requirementKey: string; readonly verified: boolean; readonly at: IsoDateTime }
  | { readonly type: 'claim_proposed'; readonly proposalId: string; readonly statement: string; readonly confidence: number; readonly evidenceIds: readonly string[]; readonly at: IsoDateTime }
  | { readonly type: 'run_completed'; readonly summary: string; readonly at: IsoDateTime };

export interface MapHermesExecutionInput {
  readonly recordId: CognitivePipelineRecordId;
  readonly resultId: TaskResultId;
  readonly events: readonly HermesExecutionEvent[];
}

export class InvalidHermesExecutionEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidHermesExecutionEventError';
  }
}

export class HermesExecutionMapper {
  map(input: MapHermesExecutionInput): HermesCognitiveSubmission {
    const events = input.events.map((event) => structuredClone(event));
    if (events.length === 0) throw new InvalidHermesExecutionEventError('Hermes event stream is empty.');

    const started = events.filter((event) => event.type === 'run_started');
    const completed = events.filter((event) => event.type === 'run_completed');
    const proposals = events.filter((event) => event.type === 'claim_proposed');
    const evidenceEvents = events.filter((event) => event.type === 'evidence_recorded');

    if (started.length !== 1) throw new InvalidHermesExecutionEventError('Exactly one run_started event is required.');
    if (completed.length !== 1) throw new InvalidHermesExecutionEventError('Exactly one run_completed event is required.');
    if (proposals.length !== 1) throw new InvalidHermesExecutionEventError('Exactly one claim_proposed event is required.');

    const start = started[0]!;
    const end = completed[0]!;
    const proposalEvent = proposals[0]!;
    if (new Date(end.at).getTime() < new Date(start.at).getTime()) {
      throw new InvalidHermesExecutionEventError('run_completed precedes run_started.');
    }

    const seenEvidence = new Set<string>();
    for (const event of evidenceEvents) {
      if (!event.evidenceId.trim() || seenEvidence.has(event.evidenceId)) {
        throw new InvalidHermesExecutionEventError(`Duplicate or empty evidence ID: ${event.evidenceId}`);
      }
      seenEvidence.add(event.evidenceId);
    }
    for (const evidenceId of proposalEvent.evidenceIds) {
      if (!seenEvidence.has(evidenceId)) {
        throw new InvalidHermesExecutionEventError(`Claim references unknown evidence: ${evidenceId}`);
      }
    }
    if (!Number.isFinite(proposalEvent.confidence) || proposalEvent.confidence < 0 || proposalEvent.confidence > 1) {
      throw new InvalidHermesExecutionEventError('Claim confidence must be between 0 and 1.');
    }

    const missionId = start.missionId as MissionId;
    const taskId = start.taskId as MissionTaskId;
    const evidenceIds = proposalEvent.evidenceIds as readonly EvidenceId[];
    const claim: ClaimProposal = {
      id: proposalEvent.proposalId as ClaimProposalId,
      missionId,
      taskId,
      statement: proposalEvent.statement,
      confidence: proposalEvent.confidence,
      evidenceIds: [...evidenceIds],
      status: 'proposed',
      createdAt: proposalEvent.at,
    };

    const execution: MissionExecutionState = {
      missionId,
      plan: {
        summary: 'Hermes imported execution',
        successCriteria: ['Hermes run completed'],
        stopConditions: [],
        tasks: [{
          id: taskId,
          title: 'Hermes task',
          objective: 'Import completed Hermes research task',
          status: 'ready',
          dependsOn: [],
          evidenceRequirements: evidenceEvents.map((event) => ({
            key: event.requirementKey,
            description: `Hermes evidence requirement: ${event.requirementKey}`,
            required: true,
          })),
        }],
      },
      tasks: [{
        taskId,
        status: 'completed',
        evidence: evidenceEvents.map((event) => ({
          requirementKey: event.requirementKey,
          evidenceId: event.evidenceId as EvidenceId,
          recordedAt: event.at,
        })),
        startedAt: start.at,
        completedAt: end.at,
      }],
      createdAt: start.at,
      updatedAt: end.at,
    };

    const taskResult: TaskResult = {
      id: input.resultId,
      missionId,
      taskId,
      summary: end.summary,
      evidenceIds: [...evidenceIds],
      claimProposals: [claim],
      createdAt: end.at,
    };

    const evidence: ClaimEvidenceAssessment[] = evidenceEvents.map((event) => ({
      evidenceId: event.evidenceId as EvidenceId,
      exists: true,
      verified: event.verified,
    }));

    return {
      recordId: input.recordId,
      execution,
      taskResult,
      proposalId: claim.id,
      evidence,
      comparisons: [],
      submittedAt: end.at,
    };
  }
}
