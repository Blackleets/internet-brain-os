const MISSION_STAGES = [
  { id: 'authorized', label: 'Authorized' },
  { id: 'agent', label: 'Agent' },
  { id: 'verification', label: 'Verification' },
  { id: 'forged', label: 'Forged' },
];

export function newestMission(missions = []) {
  return [...missions].sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')))[0];
}

/**
 * Fail-close #mission-progress Forged stage to Kernel SUPPORT Finds.
 * executionPhase/workState forged alone must not paint Forged complete when
 * Living Forge / mission-state / presentMission already say Research completed
 * (zero SUPPORT). Mirror completed-without-Evidence: Verification complete,
 * Forged pending until verificationResults/findCount prove SUPPORT.
 */
export function missionJourney(mission) {
  if (!mission) return { state: 'idle', stages: MISSION_STAGES.map((stage) => ({ ...stage, state: 'pending' })) };
  const forged = mission.executionPhase === 'forged' || mission.workState === 'forged';
  const forgedWithSupport = forged && countMissionSupportedFinds(mission) > 0;
  const activeIndex = mission.executionPhase === 'verifying'
    ? 2
    : { waiting_for_agent: 0, queued: 1, running: 1, completed: forgedWithSupport ? 3 : 2, failed: Math.min(Number(mission.attempt ?? 1), 2) }[mission.status] ?? 0;
  return {
    state: mission.status,
    stages: MISSION_STAGES.map((stage, index) => ({
      ...stage,
      state: mission.status === 'failed' && index === activeIndex ? 'error' : index < activeIndex || (mission.status === 'completed' && (forgedWithSupport || stage.id !== 'forged')) ? 'complete' : index === activeIndex ? 'active' : 'pending',
    })),
  };
}

/** Prefer verificationResults supported === true; GoalSurface may expose findCount only. */
function countMissionSupportedFinds(mission) {
  const results = mission?.verificationResults;
  if (Array.isArray(results)) {
    let n = 0;
    for (const entry of results) {
      if (entry && typeof entry === 'object' && entry.supported === true) n += 1;
    }
    return n;
  }
  const findCount = mission?.findCount;
  if (typeof findCount === 'number' && Number.isSafeInteger(findCount) && findCount >= 0) return findCount;
  return 0;
}

export function onboardingJourney({ connected = false, goalCount = 0, radarEnabled = false, findCount = 0 } = {}) {
  const steps = [
    { id: 'connect', label: 'Connect the private Kernel', view: 'forge', complete: connected },
    { id: 'goal', label: 'Forge your first Goal', view: 'missions', complete: goalCount > 0 },
    { id: 'radar', label: 'Authorize a public site', view: 'forge', complete: radarEnabled },
    { id: 'find', label: 'Forge your first Kernel SUPPORT Find', view: 'finds', complete: findCount > 0 },
  ];
  return { complete: steps.every((step) => step.complete), steps, next: steps.find((step) => !step.complete) };
}
