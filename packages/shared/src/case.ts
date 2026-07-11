// case.ts
import type { CaseId, IsoDateTime } from './common';

export interface Case {
  readonly id: CaseId;
  readonly title: string;
  readonly description?: string;
  readonly objective: string;
  readonly status: 'draft' | 'active' | 'completed' | 'archived';
  readonly tags: readonly string[];
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}