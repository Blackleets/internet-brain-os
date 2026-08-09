import {
  buildReplayLabMemorySafetyView,
  type ReplayLabMemorySafetyView,
  type ReplayLabPreventionSafetyInput,
  type ReplayLabQuarantineSafetyInput,
  type ReplayLabRecoverySafetyInput,
} from './replay-lab-memory-safety-read-model';

export interface ReplayLabQuarantineSafetyReader {
  list(memoryId: string): Promise<readonly ReplayLabQuarantineSafetyInput[]>;
}

export interface ReplayLabRecoverySafetyReader {
  list(memoryId: string): Promise<readonly ReplayLabRecoverySafetyInput[]>;
}

export interface ReplayLabPreventionSafetyReader {
  list(memoryId: string): Promise<readonly ReplayLabPreventionSafetyInput[]>;
}

export interface ReplayLabMemorySafetyQueryDependencies {
  readonly quarantine: ReplayLabQuarantineSafetyReader;
  readonly recoveryReviews: ReplayLabRecoverySafetyReader;
  readonly prevention: ReplayLabPreventionSafetyReader;
}

/** Read-only operator query surface. Dependencies expose list/read only. */
export class ReplayLabMemorySafetyQueryService {
  constructor(private readonly dependencies: ReplayLabMemorySafetyQueryDependencies) {}

  async getMemorySafety(memoryId: string): Promise<ReplayLabMemorySafetyView> {
    const normalizedMemoryId = memoryId.trim();
    if (!normalizedMemoryId) throw new Error('memoryId is required.');

    const [quarantine, recoveryReviews, prevention] = await Promise.all([
      this.dependencies.quarantine.list(normalizedMemoryId),
      this.dependencies.recoveryReviews.list(normalizedMemoryId),
      this.dependencies.prevention.list(normalizedMemoryId),
    ]);

    return buildReplayLabMemorySafetyView({
      memoryId: normalizedMemoryId,
      quarantine,
      recoveryReviews,
      prevention,
    });
  }
}
