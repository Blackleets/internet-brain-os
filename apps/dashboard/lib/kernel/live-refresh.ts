import type { KernelEvent, KernelEventUnsubscribe } from './events';

/**
 * Kernel events that mean mission state changed. The Kernel publishes these from mission
 * creation and the agent claim/results/failures contract (apps/local-kernel/server.mjs).
 */
const REFRESH_EVENT_TYPES = new Set(['mission.created', 'mission.updated']);

/**
 * Event-driven refresh hint for the dashboard: on a mission event, re-read the Kernel now.
 * The payload is never rendered or trusted as the record; the next poll wave re-reads
 * /api/agent-missions and Goal surfaces. Polling stays the fallback when the stream is down.
 */
export function refreshOnKernelEvents(
  subscribe: (onEvent: (event: KernelEvent) => void) => KernelEventUnsubscribe,
  refreshNow: () => void,
): KernelEventUnsubscribe {
  return subscribe((event) => {
    if (REFRESH_EVENT_TYPES.has(event.type)) refreshNow();
  });
}
