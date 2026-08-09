const FORGE_ACTIVITY = Object.freeze({
  idle: { label: 'The forge is ready', detail: 'Create a Goal or analyze a public page.', tone: 'idle' },
  waiting: { label: 'Hermes not available', detail: 'The mission is authorized, but no Hermes worker is connected.', tone: 'error' },
  queued: { label: 'Preparing the tools', detail: 'A research mission is ready for Hermes.', tone: 'queued' },
  working: { label: 'Forging new intelligence', detail: 'Hermes is researching authorized public sources.', tone: 'working' },
  verifying: { label: 'Inspecting the piece', detail: 'Efesto is validating returned findings inside the local Kernel.', tone: 'verifying' },
  forged: { label: 'A useful lead was forged', detail: 'Efesto forged the latest persisted findings.', tone: 'success' },
  failed: { label: 'Inspecting a broken piece', detail: 'Research stopped safely and needs attention.', tone: 'error' },
});

const WORK_COPY = Object.freeze({
  idle: 'No research mission yet',
  waiting_for_agent: 'Waiting for Hermes',
  queued: 'Ready for Hermes',
  running: 'Hermes is researching',
  investigating: 'Hermes is researching',
  verifying: 'Efesto is verifying findings',
  forged: 'Evidence-backed findings forged',
  completed: 'Research completed',
  failed: 'Research needs attention',
});

export function presentGoalSurfaces(surfaces = []) {
  const safe = Array.isArray(surfaces) ? surfaces : [];
  const focused = safe[0];
  return {
    goalCount: safe.length,
    focused: focused ? presentGoalSurface(focused) : undefined,
    goals: safe.slice(0, 3).map(presentGoalSurface),
    forgeActivity: forgeActivityForGoalSurface(focused),
  };
}

export function presentGoalSurface(surface) {
  if (!surface?.goal) return undefined;
  const mission = surface.mission;
  return {
    id: surface.goal.id,
    title: surface.goal.title,
    status: surface.goal.status,
    compatibility: surface.goal.compatibility,
    compatibilityLabel: surface.goal.compatibility === 'universal_v2' ? 'Universal Goal v2' : 'Legacy radar · Kernel compatibility',
    autonomyLabel: autonomyLabel(surface.goal.policySummary?.autonomyLevel),
    approvalLabel: approvalLabel(surface.goal.policySummary?.approvalPolicy),
    workState: mission?.workState ?? 'idle',
    workLabel: WORK_COPY[mission?.workState ?? 'idle'] ?? 'Kernel state unavailable',
    missionId: mission?.id,
    findCount: mission?.findCount,
    canResearch: surface.goal.status === 'active' && !isActiveWork(mission?.workState),
  };
}

export function forgeActivityForGoalSurface(surface) {
  const workState = surface?.mission?.workState;
  if (!workState || workState === 'idle' || workState === 'completed') return FORGE_ACTIVITY.idle;
  if (workState === 'waiting_for_agent') return FORGE_ACTIVITY.waiting;
  if (workState === 'queued') return FORGE_ACTIVITY.queued;
  if (workState === 'running' || workState === 'investigating') return FORGE_ACTIVITY.working;
  if (workState === 'verifying') return FORGE_ACTIVITY.verifying;
  if (workState === 'forged') {
    const found = Number.isSafeInteger(surface?.mission?.findCount) ? surface.mission.findCount : undefined;
    if (found === undefined) return FORGE_ACTIVITY.forged;
    if (found === 0) return { ...FORGE_ACTIVITY.forged, label: 'Research completed', detail: 'No strong opportunity passed the local checks.' };
    return { ...FORGE_ACTIVITY.forged, detail: `${found} ${found === 1 ? 'opportunity' : 'opportunities'} passed local checks and were forged.` };
  }
  if (workState === 'failed') return FORGE_ACTIVITY.failed;
  return FORGE_ACTIVITY.idle;
}

function isActiveWork(workState) {
  return ['waiting_for_agent', 'queued', 'running', 'investigating', 'verifying'].includes(workState);
}

function autonomyLabel(value) {
  return ({
    manual: 'Manual',
    assisted: 'Assisted',
    semi_autonomous: 'Semi-autonomous',
    autonomous: 'Autonomous',
  })[value] ?? 'Unknown autonomy';
}

function approvalLabel(value) {
  return ({
    none: 'No extra checkpoints',
    checkpoints: 'Approval checkpoints',
    per_action: 'Approve each action',
    strict: 'Strict approval',
  })[value] ?? 'Unknown approval policy';
}
