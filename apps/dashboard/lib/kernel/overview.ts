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

type OverviewEndpoint = 'health' | 'status' | 'bootstrap' | 'cases' | 'goals' | 'missions' | 'opportunities' | 'modelForge';
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
  missions: MissionSummary[];
  opportunities: OpportunitySummary[];
  activity: OverviewActivity[];
  loadedAt: string;
  issues: OverviewIssue[];
};

export async function loadOverview(client: KernelClient, signal?: AbortSignal): Promise<OverviewSnapshot> {
  const [health, status, bootstrap, cases, goals, missions, opportunities, modelForge] = await Promise.allSettled([
    client.get('/health', parseHealth, signal),
    client.get('/status', parseStatus, signal),
    client.get('/bootstrap/status', parseBootstrap, signal),
    client.get('/api/cases', parseCases, signal),
    client.get('/api/goals', parseGoals, signal),
    client.get('/api/agent-missions', parseMissions, signal),
    client.get('/api/opportunities', parseOpportunities, signal),
    client.get('/api/model-forge', parseModelForge, signal),
  ]);

  const results = [
    ['health', health],
    ['status', status],
    ['bootstrap', bootstrap],
    ['cases', cases],
    ['goals', goals],
    ['missions', missions],
    ['opportunities', opportunities],
    ['modelForge', modelForge],
  ] as const;

  const unauthorized = results.find(([, result]) => result.status === 'rejected' && isUnauthorized(result.reason));
  if (unauthorized?.[1].status === 'rejected') throw unauthorized[1].reason;

  const issues = results.flatMap(([endpoint, result]) => result.status === 'rejected' ? [toIssue(endpoint, result.reason)] : []);
  const caseRecords = fulfilledValue(cases, [] as CaseSummary[]);
  const goalRecords = fulfilledValue(goals, [] as GoalSummary[]);
  const missionRecords = fulfilledValue(missions, [] as MissionSummary[]);
  const opportunityRecords = fulfilledValue(opportunities, [] as OpportunitySummary[]);

  return {
    readiness: {
      kernel: health.status === 'fulfilled' ? 'online' : 'offline',
      ...(health.status === 'fulfilled' ? { health: health.value } : {}),
      ...(status.status === 'fulfilled' ? { status: status.value } : {}),
      ...(bootstrap.status === 'fulfilled' ? { bootstrap: bootstrap.value } : {}),
      ...(modelForge.status === 'fulfilled' ? { modelForge: modelForge.value } : {}),
    },
    metrics: {
      cases: caseRecords.length,
      goals: goalRecords.length,
      missions: missionRecords.length,
      activeMissions: missionRecords.filter(isActiveMission).length,
      opportunities: opportunityRecords.length,
    },
    missions: missionRecords,
    opportunities: opportunityRecords,
    activity: activityFrom(goalRecords, missionRecords, opportunityRecords),
    loadedAt: new Date().toISOString(),
    issues,
  };
}

export function isActiveMission(mission: MissionSummary): boolean {
  return mission.status === 'queued' || mission.status === 'running';
}

function fulfilledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function isUnauthorized(reason: unknown): reason is KernelClientError {
  return reason instanceof KernelClientError && reason.code === 'UNAUTHORIZED';
}

function toIssue(endpoint: OverviewEndpoint, reason: unknown): OverviewIssue {
  if (endpoint === 'modelForge' && reason instanceof KernelClientError && reason.code === 'HTTP_ERROR') {
    return { endpoint, code: 'UNAVAILABLE' };
  }
  return { endpoint, code: reason instanceof KernelClientError ? reason.code : 'UNKNOWN' };
}

function activityFrom(goals: GoalSummary[], missions: MissionSummary[], opportunities: OpportunitySummary[]): OverviewActivity[] {
  const entries = [
    ...goals.map((goal) => activity('goal', goal.id, goal.createdAt, goal.status)),
    ...missions.map((mission) => activity('mission', mission.id, mission.createdAt, mission.executionPhase ?? mission.status)),
    ...opportunities.map((opportunity) => activity('opportunity', opportunity.id, opportunity.detectedAt, opportunity.status)),
  ].filter((entry): entry is OverviewActivity => entry !== undefined);

  return entries.sort((left, right) => timestamp(right.timestamp) - timestamp(left.timestamp) || left.id.localeCompare(right.id));
}

function activity(kind: OverviewActivity['kind'], recordId: string, timestampValue: string, state: string): OverviewActivity | undefined {
  if (!Number.isFinite(timestamp(timestampValue))) return undefined;
  return { id: `${kind}:${recordId}`, recordId, kind, timestamp: timestampValue, state };
}

function timestamp(value: string): number {
  return Date.parse(value);
}
