import type { IsoDateTime, MemoryId } from '@internet-brain-os/shared';
import type { MemoryLifecycleEvent } from './memory-lifecycle';

export interface MemoryEventLog {
  append(event: MemoryLifecycleEvent): void;
  list(memoryId?: MemoryId): readonly MemoryLifecycleEvent[];
}

/** Append-only in-memory event log for memory evolution. */
export class InMemoryMemoryEventLog implements MemoryEventLog {
  private readonly events: MemoryLifecycleEvent[] = [];

  append(event: MemoryLifecycleEvent): void {
    this.events.push({ ...event });
  }

  list(memoryId?: MemoryId): readonly MemoryLifecycleEvent[] {
    return this.events
      .filter((event) => !memoryId || event.memoryId === memoryId)
      .map((event) => ({ ...event }));
  }
}
