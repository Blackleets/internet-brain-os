import { describe, expect, test } from 'vitest';
import type { CaseId, IsoDateTime } from '@internet-brain-os/shared';
import {
  ArchivedCaseMutationError,
  CaseAlreadyExistsError,
  CaseManager,
  CaseNotFoundError,
  InvalidCaseInputError,
  InvalidCaseTransitionError,
  StaleCaseUpdateError,
} from '../src';
import { InMemoryCaseRepository } from './in-memory-case-repository';

const id = 'case-1' as CaseId;
const t1 = '2026-07-11T10:00:00.000Z' as IsoDateTime;
const t2 = '2026-07-11T11:00:00.000Z' as IsoDateTime;
const t3 = '2026-07-11T12:00:00.000Z' as IsoDateTime;

function manager(): CaseManager {
  return new CaseManager(new InMemoryCaseRepository());
}

describe('CaseManager', () => {
  test('creates a normalized draft case', async () => {
    const service = manager();
    const created = await service.create({
      id,
      title: '  Supplier research  ',
      objective: '  Find reliable suppliers  ',
      description: '   ',
      tags: [' ecommerce ', '', 'ecommerce', ' suppliers '],
      createdAt: t1,
    });

    expect(created).toEqual({
      id,
      title: 'Supplier research',
      objective: 'Find reliable suppliers',
      description: undefined,
      status: 'draft',
      tags: ['ecommerce', 'suppliers'],
      createdAt: t1,
      updatedAt: t1,
    });
  });

  test('defaults omitted tags to an empty array', async () => {
    const created = await manager().create({
      id,
      title: 'Case',
      objective: 'Objective',
      createdAt: t1,
    });
    expect(created.tags).toEqual([]);
  });

  test('rejects empty title and objective', async () => {
    await expect(
      manager().create({ id, title: ' ', objective: 'ok', createdAt: t1 }),
    ).rejects.toBeInstanceOf(InvalidCaseInputError);
    await expect(
      manager().create({ id, title: 'ok', objective: ' ', createdAt: t1 }),
    ).rejects.toBeInstanceOf(InvalidCaseInputError);
  });

  test('rejects duplicate IDs', async () => {
    const service = manager();
    const input = { id, title: 'Case', objective: 'Objective', createdAt: t1 };
    await service.create(input);
    await expect(service.create(input)).rejects.toBeInstanceOf(
      CaseAlreadyExistsError,
    );
  });

  test('returns null for a missing case', async () => {
    expect(await manager().getById(id)).toBeNull();
  });

  test('updates fields without mutating the original case', async () => {
    const service = manager();
    const original = await service.create({
      id,
      title: 'Case',
      objective: 'Objective',
      description: 'Description',
      tags: ['one'],
      createdAt: t1,
    });

    const updated = await service.update(id, {
      title: ' Updated ',
      description: null,
      tags: [' two ', 'two'],
      updatedAt: t2,
    });

    expect(updated.title).toBe('Updated');
    expect(updated.description).toBeUndefined();
    expect(updated.tags).toEqual(['two']);
    expect(original.title).toBe('Case');
    expect(original.tags).toEqual(['one']);
  });

  test('rejects update of unknown case', async () => {
    await expect(
      manager().update(id, { title: 'Updated', updatedAt: t2 }),
    ).rejects.toBeInstanceOf(CaseNotFoundError);
  });

  test('rejects stale timestamps', async () => {
    const service = manager();
    await service.create({ id, title: 'Case', objective: 'Objective', createdAt: t1 });
    await expect(
      service.update(id, { title: 'Updated', updatedAt: t1 }),
    ).rejects.toBeInstanceOf(StaleCaseUpdateError);
  });

  test('allows the approved lifecycle', async () => {
    const service = manager();
    await service.create({ id, title: 'Case', objective: 'Objective', createdAt: t1 });
    const active = await service.transitionStatus(id, 'active', t2);
    const completed = await service.transitionStatus(id, 'completed', t3);
    expect(active.status).toBe('active');
    expect(completed.status).toBe('completed');
  });

  test('rejects invalid and same-state transitions', async () => {
    const service = manager();
    await service.create({ id, title: 'Case', objective: 'Objective', createdAt: t1 });
    await expect(
      service.transitionStatus(id, 'completed', t2),
    ).rejects.toBeInstanceOf(InvalidCaseTransitionError);
    await expect(
      service.transitionStatus(id, 'draft', t2),
    ).rejects.toBeInstanceOf(InvalidCaseTransitionError);
  });

  test('archives cases and makes archived state terminal', async () => {
    const service = manager();
    await service.create({ id, title: 'Case', objective: 'Objective', createdAt: t1 });
    const archived = await service.archive(id, t2);
    expect(archived.status).toBe('archived');
    await expect(
      service.update(id, { title: 'Nope', updatedAt: t3 }),
    ).rejects.toBeInstanceOf(ArchivedCaseMutationError);
    await expect(service.archive(id, t3)).rejects.toBeInstanceOf(
      ArchivedCaseMutationError,
    );
  });

  test('returned objects and arrays do not expose repository state', async () => {
    const repository = new InMemoryCaseRepository();
    const service = new CaseManager(repository);
    await service.create({
      id,
      title: 'Case',
      objective: 'Objective',
      tags: ['safe'],
      createdAt: t1,
    });

    const found = await service.getById(id);
    const listed = (await service.list()) as unknown as Array<{ tags: string[] }>;
    if (!found) throw new Error('Expected case');
    (found.tags as unknown as string[]).push('mutated');
    listed.push({ tags: [] });
    listed[0]?.tags.push('changed');

    const stored = await repository.getById(id);
    expect(stored?.tags).toEqual(['safe']);
    expect((await repository.list()).length).toBe(1);
  });
});
