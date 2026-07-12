import type { Case, CaseId, IsoDateTime } from '@internet-brain-os/shared';
import type { CaseRepository } from './case-repository';
import {
  ArchivedCaseMutationError,
  CaseAlreadyExistsError,
  CaseNotFoundError,
  InvalidCaseTransitionError,
  StaleCaseUpdateError,
} from './case-errors';
import {
  canTransition,
  normalizeDescription,
  normalizeRequiredText,
  normalizeTags,
} from './case-normalization';

export interface CreateCaseInput {
  readonly id: CaseId;
  readonly title: string;
  readonly objective: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly createdAt: IsoDateTime;
}

export interface UpdateCaseInput {
  readonly title?: string;
  readonly objective?: string;
  readonly description?: string | null;
  readonly tags?: readonly string[];
  readonly updatedAt: IsoDateTime;
}

export class CaseManager {
  constructor(private readonly repository: CaseRepository) {}

  async create(input: CreateCaseInput): Promise<Case> {
    if (await this.repository.getById(input.id)) {
      throw new CaseAlreadyExistsError(input.id);
    }

    const caseRecord: Case = {
      id: input.id,
      title: normalizeRequiredText('title', input.title),
      objective: normalizeRequiredText('objective', input.objective),
      description: normalizeDescription(input.description),
      status: 'draft',
      tags: normalizeTags(input.tags),
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    };

    await this.repository.create(caseRecord);
    return cloneCase(caseRecord);
  }

  getById(id: CaseId): Promise<Case | null> {
    return this.repository.getById(id);
  }

  list(): Promise<readonly Case[]> {
    return this.repository.list();
  }

  async update(id: CaseId, input: UpdateCaseInput): Promise<Case> {
    const current = await this.requireCase(id);
    this.assertMutable(current);
    this.assertFresh(current, input.updatedAt);

    const updated: Case = {
      ...current,
      title:
        input.title === undefined
          ? current.title
          : normalizeRequiredText('title', input.title),
      objective:
        input.objective === undefined
          ? current.objective
          : normalizeRequiredText('objective', input.objective),
      description:
        input.description === undefined
          ? current.description
          : normalizeDescription(input.description),
      tags: input.tags === undefined ? [...current.tags] : normalizeTags(input.tags),
      updatedAt: input.updatedAt,
    };

    await this.repository.update(updated);
    return cloneCase(updated);
  }

  async transitionStatus(
    id: CaseId,
    nextStatus: Case['status'],
    updatedAt: IsoDateTime,
  ): Promise<Case> {
    const current = await this.requireCase(id);
    this.assertMutable(current);
    this.assertFresh(current, updatedAt);

    if (!canTransition(current.status, nextStatus)) {
      throw new InvalidCaseTransitionError(id, current.status, nextStatus);
    }

    const updated: Case = {
      ...current,
      tags: [...current.tags],
      status: nextStatus,
      updatedAt,
    };

    await this.repository.update(updated);
    return cloneCase(updated);
  }

  archive(id: CaseId, updatedAt: IsoDateTime): Promise<Case> {
    return this.transitionStatus(id, 'archived', updatedAt);
  }

  private async requireCase(id: CaseId): Promise<Case> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new CaseNotFoundError(id);
    return existing;
  }

  private assertMutable(caseRecord: Case): void {
    if (caseRecord.status === 'archived') {
      throw new ArchivedCaseMutationError(caseRecord.id);
    }
  }

  private assertFresh(caseRecord: Case, updatedAt: IsoDateTime): void {
    if (updatedAt <= caseRecord.updatedAt) {
      throw new StaleCaseUpdateError(
        caseRecord.id,
        updatedAt,
        caseRecord.updatedAt,
      );
    }
  }
}

function cloneCase(caseRecord: Case): Case {
  return { ...caseRecord, tags: [...caseRecord.tags] };
}
