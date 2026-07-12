import type { Case, CaseId } from '@internet-brain-os/shared';

export interface CaseRepository {
  create(caseRecord: Case): Promise<void>;
  getById(id: CaseId): Promise<Case | null>;
  list(): Promise<readonly Case[]>;
  update(caseRecord: Case): Promise<void>;
}
