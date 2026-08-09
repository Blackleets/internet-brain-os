import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalKernelServer } from './server.mjs';
import { GoalSurfaceReaderError } from './goal-surface-reader.mjs';

const token = 'g'.repeat(64);
const servers = new Set();

function sampleSurface(goalId = 'goal:1') {
  return {
    schemaVersion: 'efesto.goal-surface.v1',
    sourceOfTruth: 'kernel',
    observedAt: '2026-08-09T17:00:00.000Z',
    goal: {
      id: goalId,
      title: 'Find a quality drill',
      status: 'active',
      revision: 1,
      createdAt: '2026-08-09T16:00:00.000Z',
      updatedAt: '2026-08-09T16:00:00.000Z',
      compatibility: 'legacy_radar',
      policySummary: {
        autonomyLevel: 'assisted',
        approvalPolicy: 'none',
        source: 'legacy_compatibility',
      },
    },
  };
}

async function start(reader, options = {}) {
  const server = createLocalKernelServer(
    { accept: vi.fn() },
    undefined,
    undefined,
    undefined,
    {
      apiToken: token,
      goalSurfaceReader: reader,
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

afterEach(async () => {
  const closing = [...servers].map((server) => new Promise((resolve) => server.close(resolve)));
  servers.clear();
  await Promise.all(closing);
});

describe('Shared Goal Truth HTTP boundary', () => {
  it('requires the existing API token before reading Goal surfaces', async () => {
    const reader = { list: vi.fn(async () => [sampleSurface()]), get: vi.fn() };
    const baseUrl = await start(reader);
    const response = await request(baseUrl, '/api/goal-surfaces', { auth: false });

    expect(response.status).toBe(401);
    expect(await json(response)).toEqual({ ok: false, code: 'AUTH_REQUIRED' });
    expect(reader.list).not.toHaveBeenCalled();
    expect(reader.get).not.toHaveBeenCalled();
  });

  it('returns the Kernel-owned surface list through the authenticated GET route', async () => {
    const surfaces = [sampleSurface('goal:1'), sampleSurface('goal:2')];
    const reader = { list: vi.fn(async () => surfaces), get: vi.fn() };
    const baseUrl = await start(reader);
    const response = await request(baseUrl, '/api/goal-surfaces');

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true, surfaces });
    expect(reader.list).toHaveBeenCalledTimes(1);
    expect(reader.get).not.toHaveBeenCalled();
  });

  it('returns one exact surface by decoded Goal id', async () => {
    const surface = sampleSurface('goal:1');
    const reader = { list: vi.fn(), get: vi.fn(async (goalId) => goalId === 'goal:1' ? surface : undefined) };
    const baseUrl = await start(reader);
    const response = await request(baseUrl, '/api/goal-surfaces/goal%3A1');

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true, surface });
    expect(reader.get).toHaveBeenCalledWith('goal:1');
  });

  it('returns a deterministic not-found response without inventing Goal state', async () => {
    const reader = { list: vi.fn(), get: vi.fn(async () => undefined) };
    const baseUrl = await start(reader);
    const response = await request(baseUrl, '/api/goal-surfaces/goal%3Amissing');

    expect(response.status).toBe(404);
    expect(await json(response)).toEqual({ ok: false, code: 'GOAL_SURFACE_NOT_FOUND' });
    expect(reader.get).toHaveBeenCalledWith('goal:missing');
  });

  it('maps invalid Goal identity to a controlled reader error', async () => {
    const reader = {
      list: vi.fn(),
      get: vi.fn(async () => {
        throw new GoalSurfaceReaderError('INVALID_GOAL_SURFACE_READER_INPUT', 'goalId is invalid');
      }),
    };
    const baseUrl = await start(reader);
    const response = await request(baseUrl, '/api/goal-surfaces/%20');

    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({
      ok: false,
      code: 'INVALID_GOAL_SURFACE_READER_INPUT',
      error: 'goalId is invalid',
    });
  });

  it('is GET-only and exposes no Goal-surface writer route', async () => {
    const reader = { list: vi.fn(), get: vi.fn() };
    const baseUrl = await start(reader);
    const response = await request(baseUrl, '/api/goal-surfaces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ goal: 'mutate' }),
    });

    expect(response.status).toBe(404);
    expect(await json(response)).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(reader.list).not.toHaveBeenCalled();
    expect(reader.get).not.toHaveBeenCalled();
  });

  it('keeps the existing extension identity gate in front of Goal surface reads', async () => {
    const reader = { list: vi.fn(async () => [sampleSurface()]), get: vi.fn() };
    const extensionRegistry = { allows: vi.fn(async () => false) };
    const baseUrl = await start(reader, { extensionRegistry });
    const response = await request(baseUrl, '/api/goal-surfaces', {
      headers: { origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop' },
    });

    expect(response.status).toBe(403);
    expect(await json(response)).toEqual({ ok: false, code: 'EXTENSION_NOT_AUTHORIZED' });
    expect(extensionRegistry.allows).toHaveBeenCalledTimes(1);
    expect(reader.list).not.toHaveBeenCalled();
  });
});
