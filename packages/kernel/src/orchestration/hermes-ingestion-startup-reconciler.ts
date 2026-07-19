import type { IsoDateTime } from '@internet-brain-os/shared';
import type { HermesIngestionReceipt } from '../storage/json-hermes-ingestion-receipt-repository';
import type {
  HermesIngestionRecoveryCoordinator,
  HermesIngestionRecoveryResult,
} from './hermes-ingestion-recovery-coordinator';

export interface HermesStartupReceiptStore {
  listExpiredPending(at: IsoDateTime): Promise<readonly HermesIngestionReceipt[]>;
  fail(key: string, error: unknown, at: IsoDateTime): Promise<void>;
}

export interface HermesStartupReconciliationResult extends HermesIngestionRecoveryResult {
  readonly expired: readonly string[];
}

/**
 * Startup policy for interrupted Hermes ingestions.
 *
 * Recovery always runs before lease expiry handling. This preserves the key
 * invariant: if a cognitive record already exists, startup links it to the
 * pending receipt instead of rerunning admission or marking it stale.
 */
export class HermesIngestionStartupReconciler {
  constructor(
    private readonly recovery: HermesIngestionRecoveryCoordinator,
    private readonly receipts: HermesStartupReceiptStore,
  ) {}

  async reconcileStartup(at: IsoDateTime): Promise<HermesStartupReconciliationResult> {
    const recovery = await this.recovery.reconcile(at);
    const expired: string[] = [];

    for (const receipt of await this.receipts.listExpiredPending(at)) {
      await this.receipts.fail(
        receipt.idempotencyKey,
        new Error(`Hermes ingestion lease expired: ${receipt.idempotencyKey}`),
        at,
      );
      expired.push(receipt.idempotencyKey);
    }

    return {
      recovered: recovery.recovered,
      unresolved: recovery.unresolved.filter((key) => !expired.includes(key)),
      expired,
    };
  }
}
