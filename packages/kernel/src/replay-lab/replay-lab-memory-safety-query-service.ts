import {
  buildReplayLabMemorySafetyView,
  ReplayLabMemorySafetyInputError,
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
    if (typeof memoryId !== 'string') {
      throw new ReplayLabMemorySafetyInputError('memoryId must be a string.');
    }
    const normalizedMemoryId = memoryId.trim();
    if (!normalizedMemoryId
      || normalizedMemoryId.length > 240
      || /[\u0000-\u001f\u007f]/.test(normalizedMemoryId)) {
      throw new ReplayLabMemorySafetyInputError('memoryId is invalid.');
    }

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
