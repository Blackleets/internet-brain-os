import { describe, expect, test } from 'vitest';
import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  EvidenceAwareMissionPlanner,
  InvalidMissionPlanError,
} from '../src';
import type {
  Mission,
  MissionId,
  MissionPlanningDraft,
  MissionTaskDecomposer,
} from '../src';

const t1 = '2026-07-19T18:00:00.000Z' as IsoDateTime;
const missionId = 'mission-sourcing' as MissionId;

function mission(): Mission {
  return {
    id: missionId,
    title: 'Supplier intelligence',
    objective: 'Find and compare reliable suppliers',
    status: 'draft',
    constraints: [{ kind: 'forbidden', description: 'No uncited conclusions' }],
    createdAt: t1,
    updatedAt: t1,
  };
}

function decomposer(draft: MissionPlanningDraft): MissionTaskDecomposer {
  return { decompose: async () => draft };
}

function validDraft(): MissionPlanningDraft {
  return {
    summary: 'Discover candidates, verify facts, then compare them.',
    successCriteria: ['At least three comparable candidates'],
    tasks: [
      {
        key: 'discover',
        title: 'Discover suppliers',
        objective: 'Identify candidate suppliers',
        evidenceRequirements: [
          { key: 'canonical-url', description: 'Canonical supplier URL' },
        ],
      },
      {
        key: 'compare',
        title: 'Compare suppliers',
        objective: 'Rank candidates using verified criteria',
        dependsOn: ['discover'],
        evidenceRequirements: [
          { key: 'price', description: 'Current unit price' },
          { key: 'moq', description: 'Current minimum order quantity' },
        ],
      },
    ],
  };
}

describe('EvidenceAwareMissionPlanner', () => {
  test('creates deterministic evidence-aware task graphs', async () => {
    const planner = new EvidenceAwareMissionPlanner(decomposer(validDraft()));
    const first = await planner.plan(mission());
    const second = await planner.plan(mission());

    expect(first).toEqual(second);
    expect(first.tasks[0]?.status).toBe('ready');
    expect(first.tasks[1]?.status).toBe('pending');
    expect(first.tasks[1]?.dependsOn).toEqual([first.tasks[0]?.id]);
    expect(first.tasks[0]?.id).toBe('mission-sourcing:discover:1');
    expect(first.stopConditions).toEqual([
      'Required evidence cannot be obtained reliably',
    ]);
    expect(first.tasks[0]?.evidenceRequirements[0]?.required).toBe(true);
  });

  test('normalizes and deduplicates criteria', async () => {
    const draft = validDraft();
    const planner = new EvidenceAwareMissionPlanner(
      decomposer({
        ...draft,
        successCriteria: ['  Verified candidates  ', 'Verified candidates'],
        stopConditions: ['  Budget exhausted  ', 'Budget exhausted'],
      }),
    );

    const plan = await planner.plan(mission());
    expect(plan.successCriteria).toEqual(['Verified candidates']);
    expect(plan.stopConditions).toEqual(['Budget exhausted']);
  });

  test('rejects unknown dependency keys', async () => {
    const draft = validDraft();
    const planner = new EvidenceAwareMissionPlanner(
      decomposer({
        ...draft,
        tasks: [{ ...draft.tasks[0]!, dependsOn: ['missing'] }],
      }),
    );

    await expect(planner.plan(mission())).rejects.toBeInstanceOf(
      InvalidMissionPlanError,
    );
  });

  test('requires evidence for every task by default', async () => {
    const draft = validDraft();
    const planner = new EvidenceAwareMissionPlanner(
      decomposer({
        ...draft,
        tasks: [{ ...draft.tasks[0]!, evidenceRequirements: [] }],
      }),
    );

    await expect(planner.plan(mission())).rejects.toThrow(
      'task discover has no evidence requirements',
    );
  });

  test('allows policy-controlled non-evidentiary tasks', async () => {
    const draft = validDraft();
    const planner = new EvidenceAwareMissionPlanner(
      decomposer({
        ...draft,
        tasks: [{ ...draft.tasks[0]!, evidenceRequirements: [] }],
      }),
      { requireEvidenceForEveryTask: false },
    );

    const plan = await planner.plan(mission());
    expect(plan.tasks[0]?.evidenceRequirements).toEqual([]);
  });

  test('passes a defensive mission copy to the decomposer', async () => {
    const source = mission();
    const mutating: MissionTaskDecomposer = {
      decompose: async (input) => {
        (input.constraints as Array<{ description: string }>)[0]!.description = 'mutated';
        return validDraft();
      },
    };

    await new EvidenceAwareMissionPlanner(mutating).plan(source);
    expect(source.constraints[0]?.description).toBe('No uncited conclusions');
  });
});
