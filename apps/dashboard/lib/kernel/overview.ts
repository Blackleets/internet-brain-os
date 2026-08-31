import { KernelClient, KernelClientError, type KernelClientErrorCode } from './client';
import type {
  BootstrapStatus,
  CaseSummary,
  GoalSummary,
  KernelHealth,
  KernelStatus,
  MissionSummary,
  ModelForgeSummary,
  OpportunitySummary,
} from './contracts';
import { parseProductScorecardPreferences, type ProductValueScorecard } from './product-scorecard';
import {
  parseBootstrap,
  parseCases,
  parseGoals,
  parseHealth,
  parseMissions,
  parseModelForge,
  parseOpportunities,
  parseStatus,
} from './parse';

type OverviewEndpoint = 'health' | 'status' | 'bootstrap' | 'cases' | 'goals' | 'missions' | 'opportunities' | 'activity' | 'modelForge' | 'scorecard';
type OverviewIssueCode = KernelClientErrorCode | 'UNAVAILABLE' | 'UNKNOWN';

export type OverviewIssue = {
  endpoint: OverviewEndpoint;
  code: OverviewIssueCode;
};

export type OverviewActivity = {
  id: string;
  recordId: string;
  kind: 'goal' | 'mission' | 'opportunity';
  timestamp: string;
  state: string;
};

export type OverviewSnapshot = {
  readiness: {
    kernel: 'online' | 'offline';
    health?: KernelHealth;
    status?: KernelStatus;
    bootstrap?: BootstrapStatus;
    modelForge?: ModelForgeSummary;
  };
  metrics: {
    cases: number;
    goals: number;
    missions: number;
    activeMissions: number;
    opportunities: number;
  };
  productScorecard?: ProductValueScorecard;
  cases: CaseSummary[];
  goals: GoalSummary[];
  missions: MissionSummary[];
  opportunities: OpportunitySummary[];
  activity: OverviewActivity[];
  loadedAt: string;
  issues: OverviewIssue[];
};

export async function loadOverview(client: KernelClient, signal?: AbortSignal): Promise<OverviewSnapshot> {
  const [health, status, bootstrap] = await Promise.allSettled([
    client.get('/health', parseHealth, signal),
    client.get('/status', parseStatus, signal),
    client.get('/bootstrap/status', parseBootstrap, signal),
  ]);

  const readinessResults = [
    ['health', health],
    ['status', status],
    ['bootstrap', bootstrap],
  ] as const;
  throwUnauthorized(readinessResults);

  const healthFailed = health.status === 'rejected';
  const connectionImpossible = healthFailed && health.reason instanceof KernelClientError && health.reason.code === 'OFFLINE';
  const issues = issuesFrom(readinessResults);
  let caseRecords: CaseSummary[] = [];
  let goalRecords: GoalSummary[] = [];
  let missionRecords: MissionSummary[] = [];
  let opportunityRecords: OpportunitySummary[] = [];
  let modelForge: ModelForgeSummary | undefined;
  let productScorecard: ProductValueScorecard | undefined;

  if (!connectionImpossible) {
    const [cases, goals, missions, opportunities, modelForgeResult, scorecardResult] = await Promise.allSettled([
      client.get('/api/cases', parseCases, signal),
      client.get('/api/goals', parseGoals, signal),
      client.get('/api/agent-missions', parseMissions, signal),
      client.get('/api/opportunities', parseOpportunities, signal),
      client.get('/api/model-forge', parseModelForge, signal),
      client.get('/api/preferences', parseProductScorecardPreferences, signal),
    ]);
    const protectedResults = [
      ['cases', cases],
      ['goals', goals],
      ['missions', missions],
      ['opportunities', opportunities],
      ['modelForge', modelForgeResult],
      ['scorecard', scorecardResult],
    ] as const;
    throwUnauthorized(protectedResults);
    issues.push(...issuesFrom(protectedResults));
    caseRecords = fulfilledValue(cases, [] as CaseSummary[]);
    goalRecords = fulfilledValue(goals, [] as GoalSummary[]);
    missionRecords = fulfilledValue(missions, [] as MissionSummary[]);
    opportunityRecords = fulfilledValue(opportunities, [] as OpportunitySummary[]);
    modelForge = fulfilledValue(modelForgeResult, undefined);
    productScorecard = fulfilledValue(scorecardResult, undefined);
  } else {
    issues.push(...unavailableIssues(['cases', 'goals', 'missions', 'opportunities', 'activity', 'modelForge', 'scorecard']));
  }

  return {
    readiness: {
      kernel: healthFailed ? 'offline' : 'online',
      ...(health.status === 'fulfilled' ? { health: health.value } : {}),
      ...(status.status === 'fulfilled' ? { status: status.value } : {}),
      ...(bootstrap.status === 'fulfilled' ? { bootstrap: bootstrap.value } : {}),
      ...(modelForge === undefined ? {} : { modelForge }),
    },
    metrics: {
      cases: caseRecords.length,
      goals: goalRecords.length,
      missions: missionRecords.length,
      activeMissions: missionRecords.filter(isActiveMission).length,
      opportunities: opportunityRecords.length,
    },
    ...(productScorecard === undefined ? {} : { productScorecard }),
    cases: caseRecords,
    goals: goalRecords,
    missions: missionRecords,
    opportunities: opportunityRecords,
    activity: activityFrom(goalRecords, missionRecords, opportunityRecords),
    loadedAt: new Date().toISOString(),
    issues,
  };
}

export function isActiveMission(mission: MissionSummary): boolean {
  if (mission.executionPhase === 'forged' || mission.executionPhase === 'failed') return false;
  if (mission.executionPhase === 'queued' || mission.executionPhase === 'investigating' || mission.executionPhase === 'verifying') return true;
  return mission.status === 'waiting_for_agent' || mission.status === 'queued' || mission.status === 'running';
}

function fulfilledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function isUnauthorized(reason: unknown): reason is KernelClientError {
  return reason instanceof KernelClientError && reason.code === 'UNAUTHORIZED';
}

function throwUnauthorized(results: ReadonlyArray<readonly [OverviewEndpoint, PromiseSettledResult<unknown>]>): void {
  const unauthorized = results.find(([, result]) => result.status === 'rejected' && isUnauthorized(result.reason));
  if (unauthorized?.[1].status === 'rejected') throw unauthorized[1].reason;
}

function issuesFrom(results: ReadonlyArray<readonly [OverviewEndpoint, PromiseSettledResult<unknown>]>): OverviewIssue[] {
  return results.flatMap(([endpoint, result]) => result.status === 'rejected' ? [toIssue(endpoint, result.reason)] : []);
}

function toIssue(endpoint: OverviewEndpoint, reason: unknown): OverviewIssue {
  if ((endpoint === 'modelForge' || endpoint === 'scorecard') && reason instanceof KernelClientError && reason.code === 'HTTP_ERROR' && reason.status === 404) {
    return { endpoint, code: 'UNAVAILABLE' };
  }
  return { endpoint, code: reason instanceof KernelClientError ? reason.code : 'UNKNOWN' };
}

function unavailableIssues(endpoints: OverviewEndpoint[]): OverviewIssue[] {
  return endpoints.map((endpoint) => ({ endpoint, code: 'UNAVAILABLE' }));
}

function missionActivityState(mission: MissionSummary): string {
  if (mission.executionPhase === 'forged') return 'forged';
  if (mission.executionPhase) return mission.executionPhase;
  // Bare status completed (e.g. zero Hermes candidates, no Evidence) is not Completado.
  if (mission.status === 'completed') return 'completed_without_forge';
  return mission.status;
}

function activityFrom(goals: GoalSummary[], missions: MissionSummary[], opportunities: OpportunitySummary[]): OverviewActivity[] {
  const entries = [
    ...goals.map((goal) => activity('goal', goal.id, goal.createdAt, goal.status)),
    ...missions.map((mission) => activity('mission', mission.id, mission.createdAt, missionActivityState(mission))),
    ...opportunities.map((opportunity) => activity('opportunity', opportunity.id, opportunity.detectedAt, opportunity.status)),
  ].filter((entry): entry is OverviewActivity => entry !== undefined);

  return entries.sort((left, right) => timestamp(right.timestamp) - timestamp(left.timestamp) || compareCodeUnits(left.id, right.id));
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function activity(kind: OverviewActivity['kind'], recordId: string, timestampValue: string, state: string): OverviewActivity | undefined {
  if (!Number.isFinite(timestamp(timestampValue))) return undefined;
  return { id: `${kind}:${recordId}`, recordId, kind, timestamp: timestampValue, state };
}

function timestamp(value: string): number {
  return Date.parse(value);
}