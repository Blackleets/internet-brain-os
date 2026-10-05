import type { GoalSurface, GoalSurfaceWorkState } from '../kernel/goal-surfaces';

const WORKING: ReadonlySet<GoalSurfaceWorkState> = new Set(['running', 'investigating', 'verifying']);

/**
 * The Goal the forge (and the brain phase) focuses on: the one whose mission the agent is working
 * on right now, so a newer queued Goal never hides the real search/verification in progress.
 * With nothing in progress it keeps the Kernel's order (most recent first).
 */
export function focusGoalSurface(surfaces: readonly GoalSurface[]): GoalSurface | undefined {
  return surfaces.find((surface) => surface.mission && WORKING.has(surface.mission.workState)) ?? surfaces[0];
}
