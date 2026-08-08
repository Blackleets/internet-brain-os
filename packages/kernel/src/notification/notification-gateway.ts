import { createHash } from 'node:crypto';
import type { NotificationReceipt, NotificationView, QueueNotificationInput } from './notification-contract';

export interface NotificationReceiptStore {
  transaction<T>(callback: (receipts: readonly NotificationReceipt[]) => Promise<T>): Promise<T>;
  write(receipts: readonly NotificationReceipt[]): Promise<void>;
}

export class NotificationConflictError extends Error {
  readonly code = 'NOTIFICATION_IDEMPOTENCY_CONFLICT';
  constructor(readonly dedupeKey: string) { super(`Notification dedupe key was reused with altered content: ${dedupeKey}`); this.name = 'NotificationConflictError'; }
}
export class NotificationNotFoundError extends Error {
  readonly code = 'NOTIFICATION_NOT_FOUND';
  constructor(readonly notificationId: string) { super(`Notification not found: ${notificationId}`); this.name = 'NotificationNotFoundError'; }
}
export class InvalidNotificationError extends Error {
  readonly code = 'INVALID_NOTIFICATION';
  constructor(message: string) { super(message); this.name = 'InvalidNotificationError'; }
}

export class NotificationGateway {
  constructor(private readonly store: NotificationReceiptStore) {}

  async queue(input: QueueNotificationInput, actor = 'system'): Promise<NotificationView> {
    const normalized = normalize(input);
    const requestHash = sha(stableStringify(normalized));
    const notificationId = `notification:${sha(normalized.dedupeKey).slice(0, 24)}`;

    return this.store.transaction(async (receipts) => {
      const queued = receipts.find((receipt) => receipt.notificationId === notificationId && receipt.event === 'queued');
      if (queued) {
        if (queued.requestHash !== requestHash) throw new NotificationConflictError(normalized.dedupeKey);
        return project(notificationId, receipts);
      }
      const receipt: NotificationReceipt = {
        sequence: nextSequence(receipts), notificationId, dedupeKey: normalized.dedupeKey, event: 'queued',
        at: normalized.createdAt, actor: clean(actor, 'actor'), requestHash, payload: cloneInput(normalized),
      };
      await this.store.write([...receipts.map(cloneReceipt), receipt]);
      return project(notificationId, [...receipts, receipt]);
    });
  }

  async markRead(notificationId: string, actor: string, at: string): Promise<NotificationView> {
    return this.appendState(notificationId, 'read', actor, at);
  }

  async dismiss(notificationId: string, actor: string, at: string): Promise<NotificationView> {
    return this.appendState(notificationId, 'dismissed', actor, at);
  }

  async list(options: { readonly state?: NotificationView['state']; readonly limit?: number } = {}): Promise<readonly NotificationView[]> {
    const limit = options.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new InvalidNotificationError('limit must be an integer between 1 and 500');
    return this.store.transaction(async (receipts) => {
      const ids = [...new Set(receipts.filter((receipt) => receipt.event === 'queued').map((receipt) => receipt.notificationId))];
      return ids.map((id) => project(id, receipts))
        .filter((view) => !options.state || view.state === options.state)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.sequence - a.sequence)
        .slice(0, limit);
    });
  }

  private async appendState(notificationId: string, event: 'read' | 'dismissed', actor: string, at: string): Promise<NotificationView> {
    clean(notificationId, 'notificationId'); clean(actor, 'actor'); requireIso(at, 'at');
    return this.store.transaction(async (receipts) => {
      const current = projectOrNull(notificationId, receipts);
      if (!current) throw new NotificationNotFoundError(notificationId);
      if ((event === 'read' && current.state === 'read') || (event === 'dismissed' && current.state === 'dismissed')) return current;
      if (current.state === 'dismissed') return current;
      const queued = receipts.find((receipt) => receipt.notificationId === notificationId && receipt.event === 'queued')!;
      const receipt: NotificationReceipt = {
        sequence: nextSequence(receipts), notificationId, dedupeKey: queued.dedupeKey, event, at, actor: clean(actor, 'actor'),
      };
      await this.store.write([...receipts.map(cloneReceipt), receipt]);
      return project(notificationId, [...receipts, receipt]);
    });
  }
}

function project(notificationId: string, receipts: readonly NotificationReceipt[]): NotificationView {
  const view = projectOrNull(notificationId, receipts);
  if (!view) throw new NotificationNotFoundError(notificationId);
  return view;
}
function projectOrNull(notificationId: string, receipts: readonly NotificationReceipt[]): NotificationView | null {
  const chain = receipts.filter((receipt) => receipt.notificationId === notificationId).sort((a, b) => a.sequence - b.sequence);
  const queued = chain.find((receipt) => receipt.event === 'queued');
  if (!queued?.payload) return null;
  let state: NotificationView['state'] = 'unread';
  for (const receipt of chain) {
    if (receipt.event === 'read' && state !== 'dismissed') state = 'read';
    if (receipt.event === 'dismissed') state = 'dismissed';
  }
  return { ...cloneInput(queued.payload), id: notificationId, state, sequence: chain.at(-1)?.sequence ?? queued.sequence };
}
function normalize(input: QueueNotificationInput): QueueNotificationInput {
  const evidenceIds = [...new Set((input.evidenceIds ?? []).map((id) => clean(id, 'evidenceId')))].sort();
  return {
    dedupeKey: clean(input.dedupeKey, 'dedupeKey'), sourceType: input.sourceType, sourceId: clean(input.sourceId, 'sourceId'),
    ...(input.goalId ? { goalId: clean(input.goalId, 'goalId') } : {}), ...(evidenceIds.length ? { evidenceIds } : {}),
    title: bounded(input.title, 'title', 160), body: bounded(input.body, 'body', 2_000), priority: input.priority,
    actionRequired: Boolean(input.actionRequired), createdAt: requireIso(input.createdAt, 'createdAt'),
  };
}
function cloneInput(input: QueueNotificationInput): QueueNotificationInput { return { ...input, ...(input.evidenceIds ? { evidenceIds: [...input.evidenceIds] } : {}) }; }
function cloneReceipt(receipt: NotificationReceipt): NotificationReceipt { return { ...receipt, ...(receipt.payload ? { payload: cloneInput(receipt.payload) } : {}) }; }
function nextSequence(receipts: readonly NotificationReceipt[]): number { return (receipts.at(-1)?.sequence ?? 0) + 1; }
function bounded(value: string, field: string, max: number): string { const result = clean(value, field); if (result.length > max) throw new InvalidNotificationError(`${field} exceeds ${max} characters`); return result; }
function clean(value: string, field: string): string { if (typeof value !== 'string' || value.trim().length === 0) throw new InvalidNotificationError(`${field} is required`); return value.trim(); }
function requireIso(value: string, field: string): string { const result = clean(value, field); if (!Number.isFinite(Date.parse(result))) throw new InvalidNotificationError(`${field} must be an ISO datetime`); return result; }
function stableStringify(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`; if (value && typeof value === 'object') { const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)); return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(',')}}`; } return JSON.stringify(value); }
function sha(value: string): string { return createHash('sha256').update(value).digest('hex'); }
