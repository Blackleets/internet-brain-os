import { describe, expect, it, vi, afterEach } from 'vitest';
import { subscribeToKernelEvents, type KernelEvent } from './events';

const token = 'dashboard-events-token-0123456789abcdef';

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let sent = 0;
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        sent += 1;
      }
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function fetchMock(responses: Response[], calls: Array<{ url: string; headers: Headers }>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    calls.push({ url: request.url, headers: request.headers });
    return responses[calls.length - 1] ?? new Response(null, { status: 500 });
  }) as unknown as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('subscribeToKernelEvents', () => {
  it('sends the kernel token header and parses event frames', async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    const events: KernelEvent[] = [];
    const fetcher = fetchMock([sseResponse([': connected\n\n', 'event: mission.created\ndata: {"missionId":"m1"}\n\n'])], calls);

    const unsubscribe = subscribeToKernelEvents(
      { baseUrl: 'http://127.0.0.1:4000', token, fetcher },
      (event) => events.push(event),
    );

    await vi.waitFor(() => {
      expect(events).toContainEqual({ type: 'mission.created', payload: { missionId: 'm1' } });
    });

    expect(calls[0].headers.get('x-hephaestus-token')).toBe(token);
    expect(calls[0].headers.get('accept')).toBe('text/event-stream');
    unsubscribe();
  });

  it('ignores comment frames and malformed data without crashing', async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    const events: KernelEvent[] = [];
    const fetcher = fetchMock([sseResponse([': keepalive\n\n', 'event: evidence.created\ndata: not-json\n\n', 'event: goal.updated\ndata: {"goalId":"g1"}\n\n'])], calls);

    const unsubscribe = subscribeToKernelEvents(
      { baseUrl: 'http://127.0.0.1:4000', token, fetcher },
      (event) => events.push(event),
    );

    await vi.waitFor(() => {
      expect(events).toContainEqual({ type: 'goal.updated', payload: { goalId: 'g1' } });
    });
    // Malformed frame produced no phantom event.
    expect(events.filter((event) => event.type === 'evidence.created')).toHaveLength(0);
    unsubscribe();
  });

  it('stops reconnecting after unsubscribe', async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    const fetcher = fetchMock([], calls);

    const unsubscribe = subscribeToKernelEvents(
      { baseUrl: 'http://127.0.0.1:4000', token, fetcher },
      () => {},
    );
    await vi.waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(1));
    unsubscribe();
    const countAtUnsub = calls.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls.length).toBe(countAtUnsub);
  });
});
