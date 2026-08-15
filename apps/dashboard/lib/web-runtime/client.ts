import type { GoalIntelligencePlan } from '../kernel/contracts';
import { parseGoalIntelligencePlan } from '../kernel/parse';

export async function loadWebGoalIntelligencePlan(title: string, keywords: string[] = [], signal?: AbortSignal): Promise<GoalIntelligencePlan> {
  const response = await fetch('/api/efesto/plan', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ title, keywords }),
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error(`Web planning failed with ${response.status}`);
  return parseGoalIntelligencePlan(await response.json());
}
