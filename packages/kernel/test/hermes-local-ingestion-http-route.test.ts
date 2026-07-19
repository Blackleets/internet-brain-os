import { describe, expect, it } from 'vitest';
import type { CognitivePipelineRecord } from '../src/storage';
import {
  HermesLocalIngestionHttpRoute,
  signHermesLocalIngestionRequest,
  type HermesExecutionIngestionRunner,
  type HermesLocalIngestionHttpRequest,
} from '../src/orchestration';

const now = new Date('2026-07-19T22:20:00.000Z');
const secret = 'local-hermes-secret';

function record(): CognitivePipelineRecord {
  return {
    id: 'pipeline-1',
    execution: {
      missionId: 'mission-1',
      plan: { summary: 'plan', successCriteria: [], stopConditions: [], tasks: [] },
      tasks: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    taskResult: {
      id: 'result-1',
      missionId: 'mission-1',
      taskId: 'task-1',
      summary: 'done',
      evidenceIds: ['evidence-1'],
      claimProposals: [],
      createdAt: now.toISOString(),
    },
    validation: {
      proposal: {
        id: 'proposal-1',
        missionId: 'mission-1',
        taskId: 'task-1',
        statement: 'Hermes claim',
        confidence: 0.91,
        evidenceIds: ['evidence-1'],
        status: 'proposed',
        createdAt: now.toISOString(),
      },
      decision: 'accepted',
      candidate: {
        id: 'candidate-1',
        proposalId: 'proposal-1',
        missionId: 'mission-1',
        statement: 'Hermes claim',
        confidence: 0.91,
        evidenceIds: ['evidence-1'],
        createdAt: now.toISOString(),
      },
      evaluatedAt: now.toISOString(),
      reasons: [],
    },
    recordedAt: now.toISOString(),
  };
}

function makeRoute(ingestion: HermesExecutionIngestionRunner = { ingest: async () => record() }) {
  return new HermesLocalIngestionHttpRoute(ingestion, {
    secret,
    maxPayloadBytes: 4096,
    freshnessWindowMs: 60_000,
    now: () => now,
    loadExistingClaims: async () => [],
  });
}

function body(): string {
  return JSON.stringify({
    idempotencyKey: 'key-1',
    recordId: 'pipeline-1',
    resultId: 'result-1',
    events: [
      { type: 'run_started', missionId: 'mission-1', taskId: 'task-1', at: now.toISOString() },
      { type: 'evidence_recorded', evidenceId: 'evidence-1', requirementKey: 'source', verified: true, at: now.toISOString() },
      { type: 'claim_proposed', proposalId: 'proposal-1', statement: 'Hermes claim', confidence: 0.91, evidenceIds: ['evidence-1'], at: now.toISOString() },
      { type: 'run_completed', summary: 'done', at: now.toISOString() },
    ],
  });
}

function signedRequest(overrides: Partial<HermesLocalIngestionHttpRequest> = {}): HermesLocalIngestionHttpRequest {
  const rawBody = overrides.rawBody ?? body();
  const timestamp = now.toISOString();
  const idempotencyKey = 'key-1';
  return {
    method: 'POST',
    url: '/hermes/ingestions',
    remoteAddress: '127.0.0.1',
    rawBody,
    headers: {
      'content-type': 'application/json',
      'x-ibos-idempotency-key': idempotencyKey,
      'x-ibos-timestamp': timestamp,
      'x-ibos-signature': signHermesLocalIngestionRequest({ secret, idempotencyKey, timestamp, rawBody }),
    },
    ...overrides,
  };
}

describe('HermesLocalIngestionHttpRoute', () => {
  it('accepts a signed local Hermes ingestion request', async () => {
    const response = await makeRoute().handle(signedRequest());

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      ok: true,
      recordId: 'pipeline-1',
      missionId: 'mission-1',
      taskResultId: 'result-1',
      validationDecision: 'accepted',
      recordedAt: now.toISOString(),
    });
  });

  it('rejects the wrong route without executing ingestion', async () => {
    let calls = 0;
    const response = await makeRoute({ ingest: async () => { calls += 1; return record(); } }).handle(
      signedRequest({ url: '/wrong' }),
    );

    expect(response.status).toBe(404);
    expect(calls).toBe(0);
  });

  it('rejects non-POST methods', async () => {
    const response = await makeRoute().handle(signedRequest({ method: 'GET' }));

    expect(response.status).toBe(405);
  });

  it('rejects unsupported content types', async () => {
    const request = signedRequest();
    const response = await makeRoute().handle({
      ...request,
      headers: { ...request.headers, 'content-type': 'text/plain' },
    });

    expect(response.status).toBe(415);
  });

  it('maps boundary validation failures to 400 responses', async () => {
    const response = await makeRoute().handle(signedRequest({ remoteAddress: '10.0.0.9' }));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ ok: false, code: 'HERMES_INGESTION_REJECTED' });
  });
});
