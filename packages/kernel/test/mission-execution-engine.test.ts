import { describe, expect, test } from 'vitest';
import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  MissingMissionTaskEvidenceError,
  MissionExecutionEngine,
  MissionTaskBlockedError,
} from '../src';
import type { Mission, MissionId, MissionTaskId } from '../src';

const missionId = 'mission-execution' as MissionId;
const discover = 'discover' as MissionTaskId;
const compare = 'compare' as MissionTaskId;
const t1 = '2026-07-19T18:00:00.000Z' as IsoDateTime;
const t2 = '2026-07-19T18:01:00.000Z' as IsoDateTime;
const t3 = '2026-07-19T18:02:00.000Z' as IsoDateTime;
const t4 = '2026-07-19T18:03:00.000Z' as IsoDateTime;
const t5 = '2026-07-19T18:04:00.000Z' as IsoDateTime;
const t6 = '2026-07-19T18:05:00.000Z' as IsoDateTime;
const t7 = '2026-07-19T18:06:00.000Z' as IsoDateTime;

function mission(): Mission {
  return {
    id: missionId,
    title: 'Supplier mission',
    objective: 'Find and compare suppliers',
    status: 'planned',
    constraints: [],
    createdAt: t1,
    updatedAt: t1,
    plan: {
      summary: 'Discover then compare suppliers',
      successCriteria: ['Comparison completed'],
      stopConditions: ['Evidence unavailable'],
      tasks: [
        {
          id: discover,
          title: 'Discover',
          objective: 'Find suppliers',
          status: 'ready',
          dependsOn: [],
          evidenceRequirements: [
            { key: 'source-url', description: 'Supplier source', required: true },
          ],
        },
        {
          id: compare,
          title: 'Compare',
          objective: 'Compare suppliers',
          status: 'pending',
          dependsOn: [discover],
          evidenceRequirements: [
            { key: 'price', description: 'Current price', required: true },
          ],
        },
      ],
    },
  };
}

describe('MissionExecutionEngine', () => {
  test('initializes root tasks ready and dependent tasks pending', () => {
    const state = new MissionExecutionEngine().initialize(mission(), t1);
    expect(state.tasks.map((task) => task.status)).toEqual(['ready', 'pending']);
  });

  test('blocks dependent tasks until dependencies complete', () => {
    const engine = new MissionExecutionEngine();
    const state = engine.initialize(mission(), t1);
    expect(() => engine.startTask(state, compare, t2)).toThrow(MissionTaskBlockedError);
  });

  test('requires declared evidence before task completion', () => {
    const engine = new MissionExecutionEngine();
    const initialized = engine.initialize(mission(), t1);
    const active = engine.startTask(initialized, discover, t2);
    expect(() => engine.completeTask(active, discover, t3)).toThrow(
      MissingMissionTaskEvidenceError,
    );
  });

  test('records evidence, completes tasks, and unlocks dependants', () => {
    const engine = new MissionExecutionEngine();
    const initialized = engine.initialize(mission(), t1);
    const activeDiscover = engine.startTask(initialized, discover, t2);
    const evidencedDiscover = engine.recordEvidence(
      activeDiscover,
      discover,
      { requirementKey: 'source-url', evidenceId: 'evidence-1', recordedAt: t3 },
      t3,
    );
    const discoverCompleted = engine.completeTask(evidencedDiscover, discover, t4);

    expect(discoverCompleted.tasks.find((task) => task.taskId === compare)?.status).toBe(
      'ready',
    );

    const activeCompare = engine.startTask(discoverCompleted, compare, t5);
    const evidencedCompare = engine.recordEvidence(
      activeCompare,
      compare,
      { requirementKey: 'price', evidenceId: 'evidence-2', recordedAt: t6 },
      t6,
    );
    const complete = engine.completeTask(evidencedCompare, compare, t7);
    expect(engine.isComplete(complete)).toBe(true);
  });

  test('replaces evidence for the same requirement deterministically', () => {
    const engine = new MissionExecutionEngine();
    const initialized = engine.initialize(mission(), t1);
    const active = engine.startTask(initialized, discover, t2);
    const first = engine.recordEvidence(
      active,
      discover,
      { requirementKey: 'source-url', evidenceId: 'old', recordedAt: t3 },
      t3,
    );
    const second = engine.recordEvidence(
      first,
      discover,
      { requirementKey: 'source-url', evidenceId: 'new', recordedAt: t4 },
      t4,
    );
    const evidence = second.tasks.find((task) => task.taskId === discover)?.evidence;
    expect(evidence).toHaveLength(1);
    expect(evidence?.[0]?.evidenceId).toBe('new');
  });
});
