import type { IsoDateTime } from '@internet-brain-os/shared';
import {
  InvalidMissionTaskTransitionError,
  MissingMissionTaskEvidenceError,
  MissionExecutionInvariantError,
  MissionTaskBlockedError,
  MissionTaskNotFoundError,
} from './mission-execution-errors';
import type {
  MissionExecutionState,
  MissionTaskEvidenceRef,
  MissionTaskExecution,
} from './mission-execution-types';
import type { Mission, MissionTask, MissionTaskId } from './mission-types';

export class MissionExecutionEngine {
  initialize(mission: Mission, createdAt: IsoDateTime): MissionExecutionState {
    if (!mission.plan) throw new MissionExecutionInvariantError('mission must have a plan');
    if (mission.status !== 'planned' && mission.status !== 'active') {
      throw new MissionExecutionInvariantError('mission must be planned or active');
    }

    return cloneState({
      missionId: mission.id,
      plan: mission.plan,
      tasks: mission.plan.tasks.map((task) => ({
        taskId: task.id,
        status: this.dependenciesComplete(task, mission.plan!.tasks, []) ? 'ready' : 'pending',
        evidence: [],
      })),
      createdAt,
      updatedAt: createdAt,
    });
  }

  startTask(
    state: MissionExecutionState,
    taskId: MissionTaskId,
    updatedAt: IsoDateTime,
  ): MissionExecutionState {
    this.assertFresh(state, updatedAt);
    const execution = this.requireExecution(state, taskId);
    if (execution.status === 'pending') throw new MissionTaskBlockedError(taskId);
    if (execution.status !== 'ready') {
      throw new InvalidMissionTaskTransitionError(taskId, execution.status, 'active');
    }

    return this.replaceExecution(state, { ...execution, status: 'active', startedAt: updatedAt }, updatedAt);
  }

  recordEvidence(
    state: MissionExecutionState,
    taskId: MissionTaskId,
    evidence: MissionTaskEvidenceRef,
    updatedAt: IsoDateTime,
  ): MissionExecutionState {
    this.assertFresh(state, updatedAt);
    const execution = this.requireExecution(state, taskId);
    if (execution.status !== 'active') {
      throw new InvalidMissionTaskTransitionError(taskId, execution.status, execution.status);
    }
    const task = this.requireTask(state, taskId);
    if (!task.evidenceRequirements.some((item) => item.key === evidence.requirementKey)) {
      throw new MissionExecutionInvariantError(
        `task ${taskId} does not declare evidence requirement ${evidence.requirementKey}`,
      );
    }
    const normalizedEvidence = execution.evidence.filter(
      (item) => item.requirementKey !== evidence.requirementKey,
    );
    normalizedEvidence.push({ ...evidence });
    return this.replaceExecution(
      state,
      { ...execution, evidence: normalizedEvidence },
      updatedAt,
    );
  }

  completeTask(
    state: MissionExecutionState,
    taskId: MissionTaskId,
    updatedAt: IsoDateTime,
  ): MissionExecutionState {
    this.assertFresh(state, updatedAt);
    const execution = this.requireExecution(state, taskId);
    if (execution.status !== 'active') {
      throw new InvalidMissionTaskTransitionError(taskId, execution.status, 'completed');
    }
    const task = this.requireTask(state, taskId);
    const collected = new Set(execution.evidence.map((item) => item.requirementKey));
    const missing = task.evidenceRequirements
      .filter((item) => item.required && !collected.has(item.key))
      .map((item) => item.key);
    if (missing.length > 0) throw new MissingMissionTaskEvidenceError(taskId, missing);

    const completed = this.replaceExecution(
      state,
      { ...execution, status: 'completed', completedAt: updatedAt },
      updatedAt,
    );
    return this.refreshReadiness(completed);
  }

  failTask(
    state: MissionExecutionState,
    taskId: MissionTaskId,
    reason: string,
    updatedAt: IsoDateTime,
  ): MissionExecutionState {
    this.assertFresh(state, updatedAt);
    const execution = this.requireExecution(state, taskId);
    if (execution.status !== 'active') {
      throw new InvalidMissionTaskTransitionError(taskId, execution.status, 'failed');
    }
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new MissionExecutionInvariantError('failure reason is required');
    return this.replaceExecution(
      state,
      { ...execution, status: 'failed', failureReason: normalizedReason, failedAt: updatedAt },
      updatedAt,
    );
  }

  isComplete(state: MissionExecutionState): boolean {
    return state.tasks.length > 0 && state.tasks.every((task) => task.status === 'completed');
  }

  private refreshReadiness(state: MissionExecutionState): MissionExecutionState {
    const completedIds = state.tasks
      .filter((task) => task.status === 'completed')
      .map((task) => task.taskId);
    const tasks = state.tasks.map((execution) => {
      if (execution.status !== 'pending') return execution;
      const task = this.requireTask(state, execution.taskId);
      return this.dependenciesComplete(task, state.plan.tasks, completedIds)
        ? { ...execution, status: 'ready' as const }
        : execution;
    });
    return cloneState({ ...state, tasks });
  }

  private dependenciesComplete(
    task: MissionTask,
    _tasks: readonly MissionTask[],
    completedIds: readonly MissionTaskId[],
  ): boolean {
    const completed = new Set(completedIds);
    return task.dependsOn.every((dependencyId) => completed.has(dependencyId));
  }

  private replaceExecution(
    state: MissionExecutionState,
    replacement: MissionTaskExecution,
    updatedAt: IsoDateTime,
  ): MissionExecutionState {
    return cloneState({
      ...state,
      tasks: state.tasks.map((task) =>
        task.taskId === replacement.taskId ? replacement : task,
      ),
      updatedAt,
    });
  }

  private requireExecution(
    state: MissionExecutionState,
    taskId: MissionTaskId,
  ): MissionTaskExecution {
    const task = state.tasks.find((item) => item.taskId === taskId);
    if (!task) throw new MissionTaskNotFoundError(taskId);
    return task;
  }

  private requireTask(state: MissionExecutionState, taskId: MissionTaskId): MissionTask {
    const task = state.plan.tasks.find((item) => item.id === taskId);
    if (!task) throw new MissionTaskNotFoundError(taskId);
    return task;
  }

  private assertFresh(state: MissionExecutionState, updatedAt: IsoDateTime): void {
    if (updatedAt <= state.updatedAt) {
      throw new MissionExecutionInvariantError('updatedAt must be newer than current state');
    }
  }
}

function cloneState(state: MissionExecutionState): MissionExecutionState {
  return {
    ...state,
    plan: {
      ...state.plan,
      successCriteria: [...state.plan.successCriteria],
      stopConditions: [...state.plan.stopConditions],
      tasks: state.plan.tasks.map((task) => ({
        ...task,
        dependsOn: [...task.dependsOn],
        evidenceRequirements: task.evidenceRequirements.map((item) => ({ ...item })),
      })),
    },
    tasks: state.tasks.map((task) => ({
      ...task,
      evidence: task.evidence.map((item) => ({ ...item })),
    })),
  };
}
