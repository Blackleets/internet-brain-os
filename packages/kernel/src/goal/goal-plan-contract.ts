import { UserGoal } from './user-goal-contract';

/**
 * Represents a plan for achieving a goal.
 * This is the output of the planning stage, which takes a UserGoal and produces a plan
 * that includes interpretation, criteria, queries to execute, etc.
 */
export interface GoalPlan {
  /** The original user goal that this plan is based on */
  userGoal: UserGoal;
  /** A human-readable interpretation of the goal */
  interpretation: string;
  /** The criteria that must be satisfied for the goal to be considered met */
  criteria: GoalCriterion[];
  /** The queries that should be executed to gather information */
  queries: string[];
  /** The sources that are allowed or preferred for gathering information */
  sources: string[];
  /** The capabilities that are required or allowed for executing the plan */
  capabilities: string[];
  /** The risks associated with executing this plan */
  risks: string[];
  /** Any limits or constraints on the plan (e.g., time, budget) */
  limits: string[];
  /** The current state of the plan (e.g., 'draft', 'ready', 'executing', 'completed') */
  state: GoalPlanState;
  /** The next action to take in executing this plan */
  nextAction: string;
}

/** A single criterion that must be met for the goal to be satisfied */
export interface GoalCriterion {
  /** A description of the criterion (e.g., "Job must pay 600 EUR per month") */
  description: string;
  /** Whether this criterion has been confirmed by evidence */
  confirmed: boolean;
  /** The evidence that confirms this criterion, if any */
  evidenceId?: string;
  /** Any notes about this criterion */
  notes?: string;
}

/** The possible states of a goal plan */
export type GoalPlanState = 'draft' | 'ready' | 'executing' | 'completed' | 'failed' | 'cancelled';

/**
 * Default values for a GoalPlan.
 */
export const GOAL_PLAN_DEFAULTS: Partial<GoalPlan> = {
  interpretation: '',
  criteria: [],
  queries: [],
  sources: [],
  capabilities: [],
  risks: [],
  limits: [],
  state: 'draft',
  nextAction: '',
};