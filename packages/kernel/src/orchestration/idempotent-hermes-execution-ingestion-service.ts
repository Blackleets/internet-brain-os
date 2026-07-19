import type { IsoDateTime } from '@internet-brain-os/shared';
import type { CognitivePipelineRecord } from '../storage/cognitive-pipeline-types';
import type { BeginHermesIngestionResult } from '../storage/json-hermes-ingestion-receipt-repository';
import type {
  HermesExecutionIngestionContext,
  IngestHermesExecutionInput,
} from './hermes-execution-ingestion-service';

export interface HermesExecutionIngestionRunner {
  ingest(
    input: IngestHermesExecutionInput,
    context: HermesExecutionIngestionContext,
  ): Promise<CognitivePipelineRecord>;
}

export interface HermesIngestionReceiptStore {
  begin(input: {
    idempotencyKey: string;
    fingerprint: string;
    recordId: IngestHermesExecutionInput['recordId'];
    at: IsoDateTime;
  }): Promise<BeginHermesIngestionResult>;
  complete(key: string, record: CognitivePipelineRecord, at: IsoDateTime): Promise<void>;
  fail(key: string, error: unknown, at: IsoDateTime): Promise<void>;
}

export interface IngestHermesExecutionIdempotentlyInput extends IngestHermesExecutionInput {
  readonly idempotencyKey: string;
  readonly receivedAt: IsoDateTime;
}

/**
 * Reserves an idempotency key before cognitive processing. A byte-equivalent
 * retry returns the original completed record; key reuse with altered input is
 * rejected by the receipt store before any Kernel gate executes again.
 */
export class IdempotentHermesExecutionIngestionService {
  constructor(
    private readonly ingestion: HermesExecutionIngestionRunner,
    private readonly receipts: HermesIngestionReceiptStore,
  ) {}

  async ingest(
    input: IngestHermesExecutionIdempotentlyInput,
    context: HermesExecutionIngestionContext,
  ): Promise<CognitivePipelineRecord> {
    if (!input.idempotencyKey.trim()) throw new Error('Hermes idempotencyKey is required.');

    const fingerprint = stableFingerprint({
      recordId: input.recordId,
      resultId: input.resultId,
      events: input.events,
      comparisons: input.comparisons ?? [],
      existingClaims: context.existingClaims,
    });
    const reservation = await this.receipts.begin({
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      recordId: input.recordId,
      at: input.receivedAt,
    });

    if (reservation.kind === 'replay') {
      return structuredClone(reservation.receipt.record!);
    }

    try {
      const record = await this.ingestion.ingest(
        {
          recordId: input.recordId,
          resultId: input.resultId,
          events: input.events.map((event) => structuredClone(event)),
          comparisons: (input.comparisons ?? []).map((comparison) => ({ ...comparison })),
        },
        { existingClaims: context.existingClaims.map((claim) => ({ ...claim })) },
      );
      await this.receipts.complete(input.idempotencyKey, record, input.receivedAt);
      return structuredClone(record);
    } catch (error) {
      await this.receipts.fail(input.idempotencyKey, error, input.receivedAt);
      throw error;
    }
  }
}

function stableFingerprint(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortValue(item)]),
    );
  }
  return value;
}
