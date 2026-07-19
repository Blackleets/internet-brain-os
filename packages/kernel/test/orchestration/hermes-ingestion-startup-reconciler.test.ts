import { describe, expect, test } from 'vitest';
import type { IsoDateTime } from '@internet-brain-os/shared';
import { HermesIngestionStartupReconciler } from '../../src';
import type {
  HermesIngestionRecoveryResult,
  HermesIngestionReceipt,
  HermesIngestionRecoveryCoordinator,
} from '../../src';

const now = '2026-07-19T22:05:00.000Z' as IsoDateTime;

describe('HermesIngestionStartupReconciler', () => {
  test('runs recovery before expiring stale pending leases', async () => {
    const failed: string[] = [];
    const recovery = {
      reconcile: async (): Promise<HermesIngestionRecoveryResult> => ({
        recovered: ['recovered-key'],
        unresolved: ['expired-key', 'fresh-key'],
      }),
    } as unknown as HermesIngestionRecoveryCoordinator;
    const receipts = {
      listExpiredPending: async () => ([
        { idempotencyKey: 'expired-key' } as HermesIngestionReceipt,
      ]),
      fail: async (key: string) => { failed.push(key); },
    };

    const result = await new HermesIngestionStartupReconciler(recovery, receipts).reconcileStartup(now);

    expect(result.recovered).toEqual(['recovered-key']);
    expect(result.expired).toEqual(['expired-key']);
    expect(result.unresolved).toEqual(['fresh-key']);
    expect(failed).toEqual(['expired-key']);
  });

  test('leaves fresh unresolved receipts pending', async () => {
    const failed: string[] = [];
    const recovery = {
      reconcile: async (): Promise<HermesIngestionRecoveryResult> => ({
        recovered: [],
        unresolved: ['fresh-key'],
      }),
    } as unknown as HermesIngestionRecoveryCoordinator;
    const receipts = {
      listExpiredPending: async () => [],
      fail: async (key: string) => { failed.push(key); },
    };

    const result = await new HermesIngestionStartupReconciler(recovery, receipts).reconcileStartup(now);

    expect(result.recovered).toEqual([]);
    expect(result.expired).toEqual([]);
    expect(result.unresolved).toEqual(['fresh-key']);
    expect(failed).toEqual([]);
  });
});
