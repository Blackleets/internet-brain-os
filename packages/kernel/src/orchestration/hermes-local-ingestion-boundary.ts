import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IsoDateTime } from '@internet-brain-os/shared';
import type { CognitivePipelineRecord } from '../storage/cognitive-pipeline-types';
import type {
  HermesExecutionIngestionContext,
} from './hermes-execution-ingestion-service';
import type {
  IngestHermesExecutionIdempotentlyInput,
} from './idempotent-hermes-execution-ingestion-service';

export interface HermesLocalIngestionHeaders {
  readonly idempotencyKey?: string;
  readonly timestamp?: IsoDateTime;
  readonly signature?: string;
}

export interface HermesLocalIngestionRequest {
  readonly remoteAddress: string;
  readonly headers: HermesLocalIngestionHeaders;
  readonly rawBody: string;
  readonly receivedAt: IsoDateTime;
}

export interface HermesLocalIngestionBoundaryConfig {
  readonly secret: string;
  readonly maxPayloadBytes: number;
  readonly freshnessWindowMs: number;
  readonly now: () => Date;
  readonly isLocalAddress?: (address: string) => boolean;
}

export interface HermesIdempotentIngestionHandler {
  ingest(
    input: IngestHermesExecutionIdempotentlyInput,
    context: HermesExecutionIngestionContext,
  ): Promise<CognitivePipelineRecord>;
}

export class InvalidHermesLocalIngestionRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidHermesLocalIngestionRequestError';
  }
}

/**
 * Authenticated local-only boundary for completed Hermes executions. It verifies
 * transport-level constraints before forwarding to the idempotent ingestion service.
 */
export class HermesLocalIngestionBoundary {
  constructor(
    private readonly ingestion: HermesIdempotentIngestionHandler,
    private readonly config: HermesLocalIngestionBoundaryConfig,
  ) {
    if (!config.secret) throw new InvalidHermesLocalIngestionRequestError('Hermes boundary secret is required.');
    if (config.maxPayloadBytes <= 0) throw new InvalidHermesLocalIngestionRequestError('maxPayloadBytes must be positive.');
    if (config.freshnessWindowMs <= 0) throw new InvalidHermesLocalIngestionRequestError('freshnessWindowMs must be positive.');
  }

  async handle(
    request: HermesLocalIngestionRequest,
    context: HermesExecutionIngestionContext,
  ): Promise<CognitivePipelineRecord> {
    this.assertLocal(request.remoteAddress);
    this.assertPayloadSize(request.rawBody);
    this.assertHeaders(request.headers);
    this.assertFresh(request.headers.timestamp!);
    this.assertSignature(request.headers, request.rawBody);

    const payload = parsePayload(request.rawBody);
    if (payload.idempotencyKey && payload.idempotencyKey !== request.headers.idempotencyKey) {
      throw new InvalidHermesLocalIngestionRequestError('Payload idempotencyKey does not match header.');
    }

    return this.ingestion.ingest(
      {
        ...payload,
        idempotencyKey: request.headers.idempotencyKey!,
        receivedAt: request.receivedAt,
      },
      { existingClaims: context.existingClaims.map((claim) => ({ ...claim })) },
    );
  }

  private assertLocal(address: string): void {
    const isLocal = this.config.isLocalAddress ?? defaultIsLocalAddress;
    if (!isLocal(address)) {
      throw new InvalidHermesLocalIngestionRequestError(`Hermes ingestion boundary is local-only: ${address}`);
    }
  }

  private assertPayloadSize(rawBody: string): void {
    if (Buffer.byteLength(rawBody, 'utf8') > this.config.maxPayloadBytes) {
      throw new InvalidHermesLocalIngestionRequestError('Hermes ingestion payload is too large.');
    }
  }

  private assertHeaders(headers: HermesLocalIngestionHeaders): void {
    if (!headers.idempotencyKey?.trim()) {
      throw new InvalidHermesLocalIngestionRequestError('X-IBOS-Idempotency-Key is required.');
    }
    if (!headers.timestamp?.trim()) {
      throw new InvalidHermesLocalIngestionRequestError('X-IBOS-Timestamp is required.');
    }
    if (!headers.signature?.trim()) {
      throw new InvalidHermesLocalIngestionRequestError('X-IBOS-Signature is required.');
    }
  }

  private assertFresh(timestamp: IsoDateTime): void {
    const parsed = new Date(timestamp).getTime();
    if (!Number.isFinite(parsed)) {
      throw new InvalidHermesLocalIngestionRequestError('X-IBOS-Timestamp is invalid.');
    }
    const ageMs = Math.abs(this.config.now().getTime() - parsed);
    if (ageMs > this.config.freshnessWindowMs) {
      throw new InvalidHermesLocalIngestionRequestError('Hermes ingestion request timestamp is outside the freshness window.');
    }
  }

  private assertSignature(headers: HermesLocalIngestionHeaders, rawBody: string): void {
    const expected = signHermesLocalIngestionRequest({
      secret: this.config.secret,
      idempotencyKey: headers.idempotencyKey!,
      timestamp: headers.timestamp!,
      rawBody,
    });
    if (!safeEqual(expected, headers.signature!)) {
      throw new InvalidHermesLocalIngestionRequestError('X-IBOS-Signature is invalid.');
    }
  }
}

export function signHermesLocalIngestionRequest(input: {
  readonly secret: string;
  readonly idempotencyKey: string;
  readonly timestamp: IsoDateTime;
  readonly rawBody: string;
}): string {
  return createHmac('sha256', input.secret)
    .update(`${input.timestamp}.${input.idempotencyKey}.${input.rawBody}`)
    .digest('hex');
}

function parsePayload(rawBody: string): IngestHermesExecutionIdempotentlyInput & { readonly idempotencyKey?: string } {
  try {
    const payload = JSON.parse(rawBody) as IngestHermesExecutionIdempotentlyInput & { readonly idempotencyKey?: string };
    if (!payload || typeof payload !== 'object') {
      throw new InvalidHermesLocalIngestionRequestError('Hermes ingestion payload must be an object.');
    }
    return payload;
  } catch (error) {
    if (error instanceof InvalidHermesLocalIngestionRequestError) throw error;
    throw new InvalidHermesLocalIngestionRequestError('Hermes ingestion payload is not valid JSON.');
  }
}

function defaultIsLocalAddress(address: string): boolean {
  return address === '127.0.0.1'
    || address === '::1'
    || address === '::ffff:127.0.0.1'
    || address === 'localhost';
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
