import { describe, expect, test } from 'vitest';
import type { CognitivePipelineRecord, MissionId, TaskResultId } from '../src';
import {
  HermesLocalIngestionBoundary,
  InvalidHermesLocalIngestionRequestError,
  signHermesLocalIngestionRequest,
} from '../src';
import type {
  HermesExecutionIngestionContext,
  IngestHermesExecutionIdempotentlyInput,
} from '../src';

const now = '2026-07-19T22:00:00.000Z';
const secret = 'local-dev-secret';

function makePayload(): Omit<IngestHermesExecutionIdempotentlyInput, 'idempotencyKey' | 'receivedAt'> {
  return {
    recordId: 'pipeline-hermes-local-1' as CognitivePipelineRecord['id'],
    resultId: 'result-hermes-local-1' as TaskResultId,
    events: [
      {
        type: 'run_started',
        missionId: 'mission-hermes-local-1' as MissionId,
        taskId: 'task-hermes-local-1',
        at: '2026-07-19T21:59:00.000Z',
      },
      {
        type: 'evidence_recorded',
        evidenceId: 'evidence-hermes-local-1',
        requirementKey: 'source-check',
        verified: true,
        at: '2026-07-19T21:59:10.000Z',
      },
      {
        type: 'claim_proposed',
        proposalId: 'proposal-hermes-local-1',
        statement: 'Hermes local boundary only accepts authenticated local execution payloads.',
        confidence: 0.91,
        evidenceIds: ['evidence-hermes-local-1'],
        at: '2026-07-19T21:59:20.000Z',
      },
      {
        type: 'run_completed',
        summary: 'Hermes local execution completed.',
        at: '2026-07-19T21:59:30.000Z',
      },
    ],
  };
}

function makeRecord(): CognitivePipelineRecord {
  const payload = makePayload();
  return {
    id: payload.recordId,
    execution: {
      missionId: 'mission-hermes-local-1' as MissionId,
      plan: {
        summary: 'test plan',
        successCriteria: [],
        stopConditions: [],
        tasks: [],
      },
      tasks: [],
      createdAt: now,
      updatedAt: now,
    },
    taskResult: {
      id: payload.resultId,
      missionId: 'mission-hermes-local-1' as MissionId,
      taskId: 'task-hermes-local-1',
      summary: 'done',
      evidenceIds: [],
      claimProposals: [],
      createdAt: now,
    },
    validation: {
      proposal: {
        id: 'proposal-hermes-local-1',
        missionId: 'mission-hermes-local-1' as MissionId,
        taskId: 'task-hermes-local-1',
        statement: 'test',
        confidence: 0.9,
        evidenceIds: [],
        status: 'proposed',
        createdAt: now,
      },
      decision: 'rejected',
      reasons: ['test'],
      evidence: [],
      evaluatedAt: now,
    },
    recordedAt: now,
  };
}

function makeBoundary(calls: IngestHermesExecutionIdempotentlyInput[] = []): HermesLocalIngestionBoundary {
  return new HermesLocalIngestionBoundary(
    {
      async ingest(input: IngestHermesExecutionIdempotentlyInput, _context: HermesExecutionIngestionContext) {
        calls.push(input);
        return makeRecord();
      },
    },
    {
      secret,
      maxPayloadBytes: 4096,
      freshnessWindowMs: 60_000,
      now: () => new Date(now),
    },
  );
}

function signedRequest(rawBody: string, overrides: Partial<Parameters<HermesLocalIngestionBoundary['handle']>[0]> = {}) {
  const idempotencyKey = 'hermes-local-key-1';
  const timestamp = now;
  return {
    remoteAddress: '127.0.0.1',
    rawBody,
    receivedAt: now,
    headers: {
      idempotencyKey,
      timestamp,
      signature: signHermesLocalIngestionRequest({ secret, idempotencyKey, timestamp, rawBody }),
    },
    ...overrides,
  };
}

describe('HermesLocalIngestionBoundary', () => {
  test('accepts signed local Hermes ingestion payloads', async () => {
    const calls: IngestHermesExecutionIdempotentlyInput[] = [];
    const boundary = makeBoundary(calls);
    const rawBody = JSON.stringify(makePayload());

    const record = await boundary.handle(signedRequest(rawBody), { existingClaims: [] });

    expect(record.id).toBe('pipeline-hermes-local-1');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.idempotencyKey).toBe('hermes-local-key-1');
    expect(calls[0]?.receivedAt).toBe(now);
  });

  test('rejects non-local requests before ingestion', async () => {
    const calls: IngestHermesExecutionIdempotentlyInput[] = [];
    const boundary = makeBoundary(calls);
    const rawBody = JSON.stringify(makePayload());

    await expect(boundary.handle(
      signedRequest(rawBody, { remoteAddress: '203.0.113.9' }),
      { existingClaims: [] },
    )).rejects.toThrow(InvalidHermesLocalIngestionRequestError);
    expect(calls).toHaveLength(0);
  });

  test('rejects payloads over the configured size limit', async () => {
    const boundary = new HermesLocalIngestionBoundary(
      { async ingest() { return makeRecord(); } },
      { secret, maxPayloadBytes: 8, freshnessWindowMs: 60_000, now: () => new Date(now) },
    );
    const rawBody = JSON.stringify(makePayload());

    await expect(boundary.handle(signedRequest(rawBody), { existingClaims: [] }))
      .rejects.toThrow(InvalidHermesLocalIngestionRequestError);
  });

  test('rejects stale timestamps', async () => {
    const boundary = makeBoundary();
    const rawBody = JSON.stringify(makePayload());
    const timestamp = '2026-07-19T21:00:00.000Z';
    const idempotencyKey = 'hermes-local-key-1';

    await expect(boundary.handle({
      remoteAddress: '127.0.0.1',
      rawBody,
      receivedAt: now,
      headers: {
        idempotencyKey,
        timestamp,
        signature: signHermesLocalIngestionRequest({ secret, idempotencyKey, timestamp, rawBody }),
      },
    }, { existingClaims: [] })).rejects.toThrow(InvalidHermesLocalIngestionRequestError);
  });

  test('rejects invalid signatures', async () => {
    const calls: IngestHermesExecutionIdempotentlyInput[] = [];
    const boundary = makeBoundary(calls);
    const rawBody = JSON.stringify(makePayload());

    await expect(boundary.handle(
      signedRequest(rawBody, { headers: { idempotencyKey: 'hermes-local-key-1', timestamp: now, signature: 'bad-signature' } }),
      { existingClaims: [] },
    )).rejects.toThrow(InvalidHermesLocalIngestionRequestError);
    expect(calls).toHaveLength(0);
  });

  test('rejects payload and header idempotency mismatch', async () => {
    const boundary = makeBoundary();
    const rawBody = JSON.stringify({ ...makePayload(), idempotencyKey: 'payload-key' });

    await expect(boundary.handle(signedRequest(rawBody), { existingClaims: [] }))
      .rejects.toThrow(InvalidHermesLocalIngestionRequestError);
  });
});
