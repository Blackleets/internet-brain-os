import type { CognitivePipelineRecord } from '../storage/cognitive-pipeline-types';
import type { ExistingClaimSnapshot } from '../mission';
import {
  HermesLocalIngestionBoundary,
  InvalidHermesLocalIngestionRequestError,
  type HermesIdempotentIngestionHandler,
} from './hermes-local-ingestion-boundary';

export interface HermesLocalIngestionHttpRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly remoteAddress: string;
  readonly rawBody: string;
}

export interface HermesLocalIngestionHttpResponse {
  readonly status: number;
  readonly body?: unknown;
}

export interface HermesLocalIngestionHttpRouteConfig {
  readonly path?: string;
  readonly secret: string;
  readonly maxPayloadBytes: number;
  readonly freshnessWindowMs: number;
  readonly now: () => Date;
  readonly loadExistingClaims: () => Promise<readonly ExistingClaimSnapshot[]>;
}

/**
 * Framework-neutral HTTP route wrapper for the authenticated local Hermes boundary.
 * It owns only transport concerns and delegates cognitive authority to the existing
 * idempotent ingestion path through `HermesLocalIngestionBoundary`.
 */
export class HermesLocalIngestionHttpRoute {
  private readonly path: string;
  private readonly boundary: HermesLocalIngestionBoundary;

  constructor(
    ingestion: HermesIdempotentIngestionHandler,
    private readonly config: HermesLocalIngestionHttpRouteConfig,
  ) {
    this.path = config.path ?? '/hermes/ingestions';
    this.boundary = new HermesLocalIngestionBoundary(ingestion, {
      secret: config.secret,
      maxPayloadBytes: config.maxPayloadBytes,
      freshnessWindowMs: config.freshnessWindowMs,
      now: config.now,
    });
  }

  async handle(request: HermesLocalIngestionHttpRequest): Promise<HermesLocalIngestionHttpResponse> {
    if (request.url !== this.path) return { status: 404, body: { ok: false, code: 'NOT_FOUND' } };
    if (request.method !== 'POST') return { status: 405, body: { ok: false, code: 'METHOD_NOT_ALLOWED' } };
    if (!headerValue(request.headers, 'content-type')?.toLowerCase().startsWith('application/json')) {
      return { status: 415, body: { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' } };
    }

    try {
      const record = await this.boundary.handle(
        {
          remoteAddress: request.remoteAddress,
          rawBody: request.rawBody,
          receivedAt: this.config.now().toISOString(),
          headers: {
            idempotencyKey: headerValue(request.headers, 'x-ibos-idempotency-key'),
            timestamp: headerValue(request.headers, 'x-ibos-timestamp'),
            signature: headerValue(request.headers, 'x-ibos-signature'),
          },
        },
        { existingClaims: await this.config.loadExistingClaims() },
      );
      return { status: 202, body: successBody(record) };
    } catch (error) {
      if (error instanceof InvalidHermesLocalIngestionRequestError) {
        return { status: 400, body: { ok: false, code: 'HERMES_INGESTION_REJECTED', error: error.message } };
      }
      return { status: 500, body: { ok: false, code: 'HERMES_INGESTION_FAILED' } };
    }
  }
}

function headerValue(
  headers: Readonly<Record<string, string | readonly string[] | undefined>>,
  name: string,
): string | undefined {
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0];
  return direct;
}

function successBody(record: CognitivePipelineRecord): unknown {
  return {
    ok: true,
    recordId: record.id,
    missionId: record.execution.missionId,
    taskResultId: record.taskResult.id,
    validationDecision: record.validation.decision,
    contradictionAction: record.contradiction?.action,
    admissionDecision: record.admission?.decision,
    recordedAt: record.recordedAt,
  };
}
