import { afterEach, describe, expect, it } from 'vitest';
import { NotificationGateway } from '../../packages/kernel/src/index.ts';
import { memoryNotificationReceiptStore } from './notification-receipt-store.mjs';
import { createLocalKernelServer } from './server.mjs';

const token = 'n'.repeat(64);
const servers = new Set();

function gateway() {
  return new NotificationGateway(memoryNotificationReceiptStore());
}

async function start(notificationGateway, options = {}) {
  const server = createLocalKernelServer(
    { accept: async () => ({ receiptId: 'receipt:test', duplicate: false }) },
    undefined,
    undefined,
    undefined,
    {
      apiToken: token,
      notificationGateway,
      allowedDashboardOrigins: [],
      ...options,
    },
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.add(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP test server address.');
  return `http://127.0.0.1:${address.port}`;
}

async function request(baseUrl, path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  if (options.auth !== false) headers.set('x-hephaestus-token', token);
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

async function json(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

async function seedSupportedFind(notifications) {
  return notifications.queue({
    dedupeKey: 'find:supported:opportunity:1',
    sourceType: 'opportunity',
    sourceId: 'opportunity:1',
    goalId: 'goal:1',
    evidenceIds: ['evidence:verified:1'],
    title: 'Quality drill 24.99 EUR',
    body: 'Quality drill 24.99 EUR passed Kernel SUPPORT. Evidence retained — open Efesto to inspect.',
    priority: 'high',
    actionRequired: true,
    createdAt: '2026-08-09T22:20:00.000Z',
  }, 'system');
}

afterEach(async () => {
  const closing = [...servers].map((server) => new Promise((resolve) => server.close(resolve)));
  servers.clear();
  await Promise.all(closing);
});

describe('NotificationGateway HTTP read/list/mark path', () => {
  it('requires the existing API token before listing notifications', async () => {
    const notifications = gateway();
    await seedSupportedFind(notifications);
    const baseUrl = await start(notifications);
    const response = await request(baseUrl, '/api/notifications', { auth: false });
    expect(response.status).toBe(401);
    expect(await json(response)).toEqual({ ok: false, code: 'AUTH_REQUIRED' });
  });

  it('returns 404 when the gateway was not composed into the server', async () => {
    const baseUrl = await start(undefined);
    const response = await request(baseUrl, '/api/notifications');
    expect(response.status).toBe(404);
    expect(await json(response)).toEqual({ ok: false, code: 'NOTIFICATION_GATEWAY_UNAVAILABLE' });
  });

  it('lists queued SUPPORT Find notifications from the durable receipt store', async () => {
    const notifications = gateway();
    const queued = await seedSupportedFind(notifications);
    const baseUrl = await start(notifications);
    const response = await request(baseUrl, '/api/notifications');
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.ok).toBe(true);
    expect(body.notifications).toHaveLength(1);
    expect(body.notifications[0]).toMatchObject({
      id: queued.id,
      sourceType: 'opportunity',
      sourceId: 'opportunity:1',
      state: 'unread',
      evidenceIds: ['evidence:verified:1'],
      priority: 'high',
      actionRequired: true,
    });
    expect(body.notifications[0].body).toContain('Kernel SUPPORT');
  });

  it('filters by projected state and rejects an invalid limit', async () => {
    const notifications = gateway();
    const queued = await seedSupportedFind(notifications);
    await notifications.markRead(queued.id, 'user:local', '2026-08-09T22:21:00.000Z');
    const baseUrl = await start(notifications);

    const unread = await request(baseUrl, '/api/notifications?state=unread');
    expect(unread.status).toBe(200);
    expect((await json(unread)).notifications).toHaveLength(0);

    const read = await request(baseUrl, '/api/notifications?state=read');
    expect(read.status).toBe(200);
    expect((await json(read)).notifications).toHaveLength(1);

    const badLimit = await request(baseUrl, '/api/notifications?limit=nope');
    expect(badLimit.status).toBe(400);
    expect((await json(badLimit)).code).toBe('INVALID_NOTIFICATION');
  });

  it('marks read and dismisses through authenticated mutation routes', async () => {
    const notifications = gateway();
    const queued = await seedSupportedFind(notifications);
    const baseUrl = await start(notifications);
    const encoded = encodeURIComponent(queued.id);

    const readResponse = await request(baseUrl, `/api/notifications/${encoded}/read`, { method: 'POST' });
    expect(readResponse.status).toBe(200);
    expect(await json(readResponse)).toMatchObject({
      ok: true,
      notification: { id: queued.id, state: 'read' },
    });

    const dismissResponse = await request(baseUrl, `/api/notifications/${encoded}/dismiss`, { method: 'POST' });
    expect(dismissResponse.status).toBe(200);
    expect(await json(dismissResponse)).toMatchObject({
      ok: true,
      notification: { id: queued.id, state: 'dismissed' },
    });

    const listed = await request(baseUrl, '/api/notifications?state=dismissed');
    expect((await json(listed)).notifications).toHaveLength(1);
  });

  it('fails closed for unknown notification ids without inventing receipts', async () => {
    const notifications = gateway();
    const baseUrl = await start(notifications);
    const response = await request(baseUrl, `/api/notifications/${encodeURIComponent('notification:missing')}/read`, {
      method: 'POST',
    });
    expect(response.status).toBe(404);
    expect(await json(response)).toMatchObject({ ok: false, code: 'NOTIFICATION_NOT_FOUND' });
    expect(await notifications.list()).toHaveLength(0);
  });
});
