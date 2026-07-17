import type { IsoDateTime, Memory, MemoryId } from '@internet-brain-os/shared';

export type MemoryLifecycleAction = 'reinforce' | 'decay' | 'invalidate' | 'restore';

export interface MemoryLifecycleEvent {
  readonly memoryId: MemoryId;
  readonly action: MemoryLifecycleAction;
  readonly previousConfidence: number;
  readonly nextConfidence: number;
  readonly reason: string;
  readonly occurredAt: IsoDateTime;
}

export interface MemoryLifecycleOptions {
  readonly reinforcement?: number;
  readonly decay?: number;
  readonly invalidationThreshold?: number;
}

/** Deterministic memory lifecycle rules. It returns new values and never mutates the input memory. */
export class MemoryLifecycleEngine {
  constructor(private readonly options: MemoryLifecycleOptions = {}) {}

  reinforce(memory: Memory, reason: string, occurredAt: IsoDateTime): { memory: Memory; event: MemoryLifecycleEvent } {
    return this.transition(memory, 'reinforce', this.options.reinforcement ?? 0.05, reason, occurredAt);
  }

  decay(memory: Memory, reason: string, occurredAt: IsoDateTime): { memory: Memory; event: MemoryLifecycleEvent } {
    return this.transition(memory, 'decay', -(this.options.decay ?? 0.05), reason, occurredAt);
  }

  invalidate(memory: Memory, reason: string, occurredAt: IsoDateTime): { memory: Memory; event: MemoryLifecycleEvent } {
    return this.transition(memory, 'invalidate', -1, reason, occurredAt);
  }

  restore(memory: Memory, reason: string, occurredAt: IsoDateTime): { memory: Memory; event: MemoryLifecycleEvent } {
    return this.transition(memory, 'restore', this.options.reinforcement ?? 0.05, reason, occurredAt);
  }

  private transition(memory: Memory, action: MemoryLifecycleAction, delta: number, reason: string, occurredAt: IsoDateTime) {
    const previousConfidence = clamp(memory.confidence);
    const nextConfidence = clamp(previousConfidence + delta);
    const effectiveConfidence = action === 'invalidate' || nextConfidence < (this.options.invalidationThreshold ?? 0.1)
      ? 0
      : nextConfidence;

    const nextMemory = {
      ...memory,
      confidence: effectiveConfidence,
      updatedAt: occurredAt,
    };

    return {
      memory: nextMemory,
      event: {
        memoryId: memory.id,
        action,
        previousConfidence,
        nextConfidence: effectiveConfidence,
        reason,
        occurredAt,
      },
    };
  }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
