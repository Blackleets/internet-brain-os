import { describe, expect, it, vi } from 'vitest';
import { listCases, LocalTransportError, sendPageContext } from './local-transport.js';

const context = {
  schemaVersion: 'hephaestus.page-context.v1',
  url: 'https://example.com',
  title: 'Example',
  visibleText: 'Evidence text',
  capturedAt: '2026-07-19T11:00:00.000Z',
};

describe('sendPageContext', () => {
  it('posts structured context to the local Kernel', async () => {
    const fetchImpl = vi.fn(async (_url, init) => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, receiptId: 'receipt:1', caseId: 'case:1', evidenceId: 'evidence:1' }),
      requestBody: init.body,
    }));

    await expect(sendPageContext(context, { fetchImpl })).resolves.toEqual({
      ok: true,
      receiptId: 'receipt:1',
      caseId: 'case:1',
      evidenceId: 'evidence:1',
      obsidianUpdated: false,
      intelligenceStatus: undefined,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:4000/api/browser/page-context',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual(context);
  });

  it('targets an existing Case without changing the page context contract', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 202,
      json: async () => ({ ok: true, receiptId: 'receipt:2', caseId: 'case:existing', evidenceId: 'evidence:2' }),
    }));
    await sendPageContext(context, { fetchImpl, targetCaseId: 'case:existing' });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ ...context, targetCaseId: 'case:existing' });
  });

  it('rejects unsupported payloads before network access', async () => {
    const fetchImpl = vi.fn();
    await expect(sendPageContext({ schemaVersion: 'unknown' }, { fetchImpl })).rejects.toMatchObject({
      code: 'INVALID_CONTEXT',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns safe unavailable errors without page contents', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503 }));
    await expect(sendPageContext(context, { fetchImpl })).rejects.toEqual(
      expect.objectContaining({
        name: 'LocalTransportError',
        code: 'KERNEL_UNAVAILABLE',
        message: 'Local Kernel request failed with HTTP 503',
      }),
    );
  });

  it('rejects malformed success responses', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }));
    await expect(sendPageContext(context, { fetchImpl })).rejects.toBeInstanceOf(LocalTransportError);
  });
});

describe('listCases', () => {
  it('returns validated local Case summaries', async () => {
    const cases = [{ id: 'case:1', title: 'Investigation', status: 'draft' }];
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, cases }) }));
    await expect(listCases({ fetchImpl })).resolves.toEqual(cases);
  });
});
