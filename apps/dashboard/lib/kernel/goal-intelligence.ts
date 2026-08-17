import { KernelClient } from './client';
import type { GoalIntelligencePlan } from './contracts';
import { parseGoalIntelligencePlan } from './parse';

export function loadGoalIntelligencePlan(
  client: KernelClient,
  title: string,
  keywords: string[] = [],
  signal?: AbortSignal,
): Promise<GoalIntelligencePlan> {
  return client.request(
    '/api/goals/plan',
    { method: 'POST', body: JSON.stringify({ title, keywords }) },
    parseGoalIntelligencePlan,
    signal,
  );
}
