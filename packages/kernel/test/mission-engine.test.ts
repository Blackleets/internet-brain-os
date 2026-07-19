import { describe, expect, test } from 'vitest';
import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  InvalidMissionPlanError,
  InvalidMissionTransitionError,
  MissionEngine,
  MissionTaskDependencyError,
} from '../src';
import type { MissionId, MissionPlan, MissionPlanner, MissionTaskId } from '../src';

const t1 = '2026-07-19T17:00:00.000Z' as IsoDateTime;
const t2 = '2026-07-19T18:00:00.000Z' as IsoDateTime;
const t3 = '2026-07-19T19:00:00.000Z' as IsoDateTime;
const t4 = '2026-07-19T20:00:00.000Z' as IsoDateTime;
const missionId = 'mission-1' as MissionId;
const taskA = 'task-a' as MissionTaskId;
const taskB = 'task-b' as MissionTaskId;

function planner(plan: MissionPlan): MissionPlanner {
  return { plan: async () => plan };
}

function validPlan(): MissionPlan {
  return {
    summary: 'Research and compare suppliers using cited evidence.',
    successCriteria: ['At least three comparable suppliers'],
    stopConditions: ['Evidence budget exhausted'],
    tasks: [
      {
        id: taskA,
        title: 'Discover suppliers',
        objective: 'Find candidate suppliers',
        status: 'ready',
        dependsOn: [],
        evidenceRequirements: [
          { key: 'supplier-url', description: 'Canonical supplier URL', required: true },
        ],
      },
      {
        id: taskB,
        title: 'Compare suppliers',
        objective: 'Rank candidates against the mission criteria',
        status: 'pending',
        dependsOn: [taskA],
        evidenceRequirements: [
          { key: 'price', description: 'Current unit price', required: true },
        ],
      },
    ],
  };
}

describe('MissionEngine', () => {
  test('creates a normalized draft mission', () => {
    const engine = new MissionEngine(planner(validPlan()));
    const mission = engine.create({
      id: missionId,
      title: '  Supplier intelligence  ',
      objective: '  Find the strongest supplier  ',
      constraints: [{ kind: 'forbidden', description: '  No uncited conclusions  ' }],
      createdAt: t1,
    });

    expect(mission.title).toBe('Supplier intelligence');
    expect(mission.objective).toBe('Find the strongest supplier');
    expect(mission.status).toBe('draft');
    expect(mission.constraints[0]?.description).toBe('No uncited conclusions');
  });

  test('plans and executes the approved lifecycle', async () => {
    const engine = new MissionEngine(planner(validPlan()));
    const draft = engine.create({
      id: missionId,
      title: 'Mission',
      objective: 'Objective',
      createdAt: t1,
    });
    const planned = await engine.plan(draft, t2);
    const active = engine.start(planned, t3);
    const completed = engine.complete(active, t4);

    expect(planned.plan?.tasks).toHaveLength(2);
    expect(active.status).toBe('active');
    expect(completed.status).toBe('completed');
  });

  test('rejects plans with unknown dependencies', async () => {
    const plan = validPlan();
    const unknown = 'unknown' as MissionTaskId;
    const invalid: MissionPlan = {
      ...plan,
      tasks: [{ ...plan.tasks[0]!, dependsOn: [unknown] }],
    };
    const engine = new MissionEngine(planner(invalid));
    const mission = engine.create({
      id: missionId,
      title: 'Mission',
      objective: 'Objective',
      createdAt: t1,
    });

    await expect(engine.plan(mission, t2)).rejects.toBeInstanceOf(
      MissionTaskDependencyError,
    );
  });

  test('rejects cyclic task graphs', async () => {
    const plan = validPlan();
    const invalid: MissionPlan = {
      ...plan,
      tasks: [
        { ...plan.tasks[0]!, dependsOn: [taskB] },
        { ...plan.tasks[1]!, dependsOn: [taskA] },
      ],
    };
    const engine = new MissionEngine(planner(invalid));
    const mission = engine.create({
      id: missionId,
      title: 'Mission',
      objective: 'Objective',
      createdAt: t1,
    });

    await expect(engine.plan(mission, t2)).rejects.toBeInstanceOf(
      InvalidMissionPlanError,
    );
  });

  test('rejects impossible state transitions', () => {
    const engine = new MissionEngine(planner(validPlan()));
    const draft = engine.create({
      id: missionId,
      title: 'Mission',
      objective: 'Objective',
      createdAt: t1,
    });

    expect(() => engine.complete(draft, t2)).toThrow(InvalidMissionTransitionError);
  });

  test('does not expose mutable planner output', async () => {
    const plan = validPlan();
    const engine = new MissionEngine(planner(plan));
    const draft = engine.create({
      id: missionId,
      title: 'Mission',
      objective: 'Objective',
      createdAt: t1,
    });
    const planned = await engine.plan(draft, t2);

    (planned.plan?.tasks as unknown as Array<unknown>).push({});
    expect(plan.tasks).toHaveLength(2);
  });
});
