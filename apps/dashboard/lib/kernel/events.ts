import type { KernelClientOptions } from './client';

/**
 * Live kernel event stream over SSE.
 *
 * Native EventSource cannot set custom headers, and the Kernel authenticates
 * every /api route via `x-hephaestus-token`. This subscriber uses fetch
 * streaming against the same contract instead, with bounded reconnect and
 * automatic cleanup. It never logs or stores the token.
 */
export type KernelEvent = {
  type: string;
  payload: Record<string, unknown>;
};

export type KernelEventUnsubscribe = () => void;

const DEFAULT_RECONNECT_MS = 2_000;
const MAX_RECONNECT_MS = 30_000;

export function subscribeToKernelEvents(
  options: KernelClientOptions,
  onEvent: (event: KernelEvent) => void,
  onStateChange?: (state: 'connected' | 'disconnected') => void,
): KernelEventUnsubscribe {
  const controller = new AbortController();
  let stopped = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const fetcher = options.fetcher ?? fetch;

  async function loop(): Promise<void> {
    while (!stopped) {
      try {
        const response = await fetcher(`${baseUrl}/api/events`, {
          headers: { accept: 'text/event-stream', 'x-hephaestus-token': options.token },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);
        attempt = 0;
        onStateChange?.('connected');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done || stopped) break;
          buffer += decoder.decode(value, { stream: true });
          let separator = buffer.indexOf('\n\n');
          while (separator !== -1) {
            const frame = buffer.slice(0, separator);
            buffer = buffer.slice(separator + 2);
            const event = parseFrame(frame);
            if (event) onEvent(event);
            separator = buffer.indexOf('\n\n');
          }
        }
      } catch {
        // Connection lost or refused: bounded backoff, never a hard failure.
      }
      if (stopped) break;
      onStateChange?.('disconnected');
      const delay = Math.min(DEFAULT_RECONNECT_MS * 2 ** Math.min(attempt, 5), MAX_RECONNECT_MS);
      attempt += 1;
      await new Promise<void>((resolve) => {
        timer = setTimeout(resolve, delay);
      });
    }
  }

  void loop();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    controller.abort();
  };
}

/** Parses one SSE frame (event/data pairs separated by blank lines). */
function parseFrame(frame: string): KernelEvent | null {
  let type = '';
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) type = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!type) return null;
  try {
    return { type, payload: dataLines.length ? (JSON.parse(dataLines.join('\n')) as Record<string, unknown>) : {} };
  } catch {
    return null;
  }
}
