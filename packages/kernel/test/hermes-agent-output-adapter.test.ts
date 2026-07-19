import { describe, expect, it } from 'vitest';
import {
  HermesAgentOutputAdapter,
  InvalidHermesAgentOutputError,
  type HermesAgentRunOutput,
} from '../src';

const baseRun: HermesAgentRunOutput = {
  runId: 'hermes-run-1',
  missionId: 'mission-hermes-real-1',
  taskId: 'task-hermes-real-1',
  startedAt: '2026-07-19T22:00:00.000Z',
  completedAt: '2026-07-19T22:01:00.000Z',
  summary: 'Hermes real output adapter sample completed.',
  evidence: [
    {
      id: 'evidence-hermes-real-1',
      requirementKey: 'source',
      verified: true,
      recordedAt: '2026-07-19T22:00:30.000Z',
    },
  ],
  claim: {
    id: 'proposal-hermes-real-1',
    statement: 'Hermes produced a bounded output that can be imported as Kernel evidence and claim proposal.',
    confidence: 0.82,
    evidenceIds: ['evidence-hermes-real-1'],
    proposedAt: '2026-07-19T22:00:45.000Z',
  },
};

describe('HermesAgentOutputAdapter', () => {
  it('maps a bounded Hermes Agent run export into Kernel execution events', () => {
    const events = new HermesAgentOutputAdapter().toExecutionEvents(baseRun);

    expect(events).toEqual([
      {
        type: 'run_started',
        missionId: 'mission-hermes-real-1',
        taskId: 'task-hermes-real-1',
        at: '2026-07-19T22:00:00.000Z',
      },
      {
        type: 'evidence_recorded',
        evidenceId: 'evidence-hermes-real-1',
        requirementKey: 'source',
        verified: true,
        at: '2026-07-19T22:00:30.000Z',
      },
      {
        type: 'claim_proposed',
        proposalId: 'proposal-hermes-real-1',
        statement: 'Hermes produced a bounded output that can be imported as Kernel evidence and claim proposal.',
        confidence: 0.82,
        evidenceIds: ['evidence-hermes-real-1'],
        at: '2026-07-19T22:00:45.000Z',
      },
      {
        type: 'run_completed',
        summary: 'Hermes real output adapter sample completed.',
        at: '2026-07-19T22:01:00.000Z',
      },
    ]);
  });

  it('rejects Kernel authority fields embedded in Hermes output', () => {
    const poisoned = {
      ...baseRun,
      validation: { decision: 'accepted' },
    } as unknown as HermesAgentRunOutput;

    expect(() => new HermesAgentOutputAdapter().toExecutionEvents(poisoned))
      .toThrow(InvalidHermesAgentOutputError);
  });

  it('rejects claims that cite unknown evidence', () => {
    const invalid = {
      ...baseRun,
      claim: {
        ...baseRun.claim,
        evidenceIds: ['missing-evidence'],
      },
    };

    expect(() => new HermesAgentOutputAdapter().toExecutionEvents(invalid))
      .toThrow('claim references unknown evidence: missing-evidence');
  });
});
