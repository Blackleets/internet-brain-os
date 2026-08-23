import { EventEmitter } from 'node:events';

/**
 * Bounded in-memory domain event bus for the local Kernel.
 *
 * Events are fire-and-forget notifications for connected dashboard/extension
 * clients. Nothing is persisted here: the durable record remains the existing
 * stores and vault projections. Subscribers that disappear are pruned on the
 * next publish so the bus never accumulates dead listeners.
 *
 * Bounded by design: at most MAX_LISTENERS subscribers and no event history.
 */
const MAX_LISTENERS = 16;

export class KernelEventBus {
  #emitter = new EventEmitter();

  constructor() {
    this.#emitter.setMaxListeners(MAX_LISTENERS);
  }

  /**
   * Publishes a domain event to every live subscriber.
   * @param {string} type Stable event name (e.g. 'mission.updated').
   * @param {Record<string, unknown>} payload JSON-serializable bounded payload.
   */
  publish(type, payload = {}) {
    const frame = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const listener of this.#emitter.listeners('event')) {
      try {
        listener(frame);
      } catch {
        // A dead subscriber must never break the publisher.
        this.#emitter.removeListener('event', listener);
      }
    }
  }

  /**
   * Registers a live SSE subscriber. Returns an unsubscribe function.
   * @param {(frame: string) => void} listener
   * @returns {() => void}
   */
  subscribe(listener) {
    if (this.#emitter.listenerCount('event') >= MAX_LISTENERS) {
      throw new Error('EVENT_BUS_FULL');
    }
    this.#emitter.on('event', listener);
    return () => this.#emitter.removeListener('event', listener);
  }
}
