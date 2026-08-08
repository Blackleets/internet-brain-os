import { describe, expect, test } from 'vitest';
import { NotificationConflictError, NotificationGateway, NotificationNotFoundError, type NotificationReceiptStore } from './notification-gateway';
import type { NotificationReceipt, QueueNotificationInput } from './notification-contract';

function store(): NotificationReceiptStore {
  let receipts: NotificationReceipt[] = [];
  return {
    transaction: async (callback) => callback(receipts),
    write: async (next) => { receipts = next.map((receipt) => ({ ...receipt, ...(receipt.payload ? { payload: { ...receipt.payload } } : {}) })); },
  };
}
function input(overrides: Partial<QueueNotificationInput> = {}): QueueNotificationInput {
  return {
    dedupeKey: 'trigger:event:1', sourceType: 'trigger', sourceId: 'trigger-event:1', goalId: 'goal:1', evidenceIds: ['evidence:2', 'evidence:1', 'evidence:1'],
    title: 'Price target found', body: 'A verified candidate is below the requested threshold.', priority: 'high', actionRequired: false,
    createdAt: '2026-08-08T15:00:00.000Z', ...overrides,
  };
}

describe('NotificationGateway', () => {
  test('queues one durable notification and exact replay is idempotent', async () => {
    const gateway = new NotificationGateway(store());
    const first = await gateway.queue(input());
    const replay = await gateway.queue(input());
    expect(replay).toEqual(first);
    expect(await gateway.list()).toHaveLength(1);
    expect(first.evidenceIds).toEqual(['evidence:1', 'evidence:2']);
  });

  test('same dedupe key with altered content fails closed', async () => {
    const gateway = new NotificationGateway(store());
    await gateway.queue(input());
    await expect(gateway.queue(input({ body: 'altered' }))).rejects.toThrow(NotificationConflictError);
  });

  test('read and dismiss transitions preserve a projected local inbox', async () => {
    const gateway = new NotificationGateway(store());
    const queued = await gateway.queue(input());
    const read = await gateway.markRead(queued.id, 'user:local', '2026-08-08T15:01:00.000Z');
    expect(read.state).toBe('read');
    const dismissed = await gateway.dismiss(queued.id, 'user:local', '2026-08-08T15:02:00.000Z');
    expect(dismissed.state).toBe('dismissed');
    expect(await gateway.list({ state: 'dismissed' })).toHaveLength(1);
  });

  test('unknown notification cannot be mutated', async () => {
    const gateway = new NotificationGateway(store());
    await expect(gateway.markRead('notification:missing', 'user:local', '2026-08-08T15:01:00.000Z')).rejects.toThrow(NotificationNotFoundError);
  });

  test('returned values cannot mutate persisted notification payload', async () => {
    const gateway = new NotificationGateway(store());
    const queued = await gateway.queue(input());
    (queued.evidenceIds as string[]).push('evidence:evil');
    const [stored] = await gateway.list();
    expect(stored.evidenceIds).toEqual(['evidence:1', 'evidence:2']);
  });
});
