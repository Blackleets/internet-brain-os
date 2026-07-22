const MISSION_STAGES = [
  { id: 'authorized', label: 'Authorized' },
  { id: 'agent', label: 'Agent' },
  { id: 'verification', label: 'Verification' },
  { id: 'forged', label: 'Forged' },
];

export function newestMission(missions = []) {
  return [...missions].sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')))[0];
}

export function missionJourney(mission) {
  if (!mission) return { state: 'idle', stages: MISSION_STAGES.map((stage) => ({ ...stage, state: 'pending' })) };
  const activeIndex = mission.executionPhase === 'verifying'
    ? 2
    : { waiting_for_agent: 0, queued: 1, running: 1, completed: 3, failed: Math.min(Number(mission.attempt ?? 1), 2) }[mission.status] ?? 0;
  return {
    state: mission.status,
    stages: MISSION_STAGES.map((stage, index) => ({
      ...stage,
      state: mission.status === 'failed' && index === activeIndex ? 'error' : index < activeIndex || mission.status === 'completed' ? 'complete' : index === activeIndex ? 'active' : 'pending',
    })),
  };
}

export function onboardingJourney({ connected = false, goalCount = 0, radarEnabled = false, findCount = 0 } = {}) {
  const steps = [
    { id: 'connect', label: 'Connect the private Kernel', view: 'forge', complete: connected },
    { id: 'goal', label: 'Forge your first Goal', view: 'missions', complete: goalCount > 0 },
    { id: 'radar', label: 'Authorize a public site', view: 'forge', complete: radarEnabled },
    { id: 'find', label: 'Forge your first useful find', view: 'finds', complete: findCount > 0 },
  ];
  return { complete: steps.every((step) => step.complete), steps, next: steps.find((step) => !step.complete) };
}
