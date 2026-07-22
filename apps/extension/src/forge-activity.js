const ACTIVITIES = Object.freeze({
  idle: { label: 'The forge is ready', detail: 'Create a Goal or analyze a public page.', tone: 'idle' },
  queued: { label: 'Preparing the tools', detail: 'A research mission is ready for Hermes.', tone: 'queued' },
  working: { label: 'Forging new intelligence', detail: 'Hermes is researching authorized public sources.', tone: 'working' },
  verifying: { label: 'Inspecting the piece', detail: 'Efesto is validating returned findings inside the local Kernel.', tone: 'verifying' },
  success: { label: 'A useful lead was forged', detail: 'Efesto verified and saved the latest findings.', tone: 'success' },
  error: { label: 'Inspecting a broken piece', detail: 'Research stopped safely and needs attention.', tone: 'error' },
});

export function forgeActivityForMission(mission) {
  if (!mission) return ACTIVITIES.idle;
  if (mission.executionPhase === 'verifying') return ACTIVITIES.verifying;
  if (mission.status === 'running') return ACTIVITIES.working;
  if (mission.status === 'waiting_for_agent') return { ...ACTIVITIES.error, label: 'Hermes not available', detail: 'The mission is authorized, but no Hermes worker is connected.' };
  if (mission.status === 'queued') return ACTIVITIES.queued;
  if (mission.status === 'completed') {
    const found = Number(mission.resultSummary?.opportunitiesPromoted) || 0;
    return found > 0
      ? { ...ACTIVITIES.success, detail: `${found} ${found === 1 ? 'opportunity' : 'opportunities'} passed local checks and saved.` }
      : { ...ACTIVITIES.success, label: 'Research completed', detail: 'No strong opportunity passed the local checks.' };
  }
  if (mission.status === 'failed') return ACTIVITIES.error;
  return ACTIVITIES.idle;
}

export function temporaryForgeActivity(kind) {
  if (kind === 'capture') return { ...ACTIVITIES.working, detail: 'Efesto is analyzing this public page.' };
  if (kind === 'capture-success') return { ...ACTIVITIES.success, detail: 'The page was preserved as private Evidence.' };
  if (kind === 'capture-error') return { ...ACTIVITIES.error, detail: 'The page was rejected or could not be analyzed.' };
  return ACTIVITIES.idle;
}
