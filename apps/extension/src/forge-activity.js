import { kernelSupportedFindsForMission } from './find-presentation.js';

const ACTIVITIES = Object.freeze({
  idle: { label: 'The forge is ready', detail: 'Create a Goal or analyze a public page.', tone: 'idle' },
  queued: { label: 'Preparing the tools', detail: 'A research mission is ready for Hermes.', tone: 'queued' },
  working: { label: 'Forging new intelligence', detail: 'Hermes is researching authorized public sources.', tone: 'working' },
  verifying: { label: 'Inspecting the piece', detail: 'Efesto is validating returned findings inside the local Kernel.', tone: 'verifying' },
  success: { label: 'A useful lead was forged', detail: 'Efesto verified and saved the latest findings.', tone: 'success' },
  error: { label: 'Inspecting a broken piece', detail: 'Research stopped safely and needs attention.', tone: 'error' },
});

export function forgeActivityForMission(mission, opportunities = []) {
  if (!mission) return ACTIVITIES.idle;
  if (mission.executionPhase === 'verifying') return ACTIVITIES.verifying;
  if (mission.status === 'running') return ACTIVITIES.working;
  if (mission.status === 'waiting_for_agent') return { ...ACTIVITIES.error, label: 'Hermes not available', detail: 'The mission is authorized, but no Hermes worker is connected.' };
  if (mission.status === 'queued') return ACTIVITIES.queued;
  if (mission.status === 'completed' && (mission.executionPhase === 'forged' || mission.workState === 'forged')) {
    const found = kernelSupportedFindsForMission(opportunities, mission).length;
    // Fail-close Living Forge label+detail to Kernel SUPPORT (detail was aligned in da68517;
    // label must not keep branding SUPPORT Finds as bare "useful lead" on #forge-activity-label).
    return found > 0
      ? {
          ...ACTIVITIES.success,
          label: found === 1 ? 'A Kernel SUPPORT Find was forged' : 'Kernel SUPPORT Finds were forged',
          detail: `${found} ${found === 1 ? 'Find' : 'Finds'} passed Kernel SUPPORT and were forged.`,
        }
      : { ...ACTIVITIES.success, label: 'Research completed', detail: 'No Find passed Kernel SUPPORT.' };
  }
  if (mission.status === 'completed') return ACTIVITIES.idle;
  if (mission.status === 'failed') return ACTIVITIES.error;
  return ACTIVITIES.idle;
}

export function temporaryForgeActivity(kind) {
  if (kind === 'capture') return { ...ACTIVITIES.working, detail: 'Efesto is analyzing this public page.' };
  if (kind === 'capture-success') return { label: 'Evidence preserved', detail: 'The page was preserved as private Evidence.', tone: 'success' };
  if (kind === 'capture-error') return { ...ACTIVITIES.error, detail: 'The page was rejected or could not be analyzed.' };
  return ACTIVITIES.idle;
}

const LIVE_FORGE_TONES = new Set(['working', 'verifying', 'queued']);

/**
 * Fail-close Living Forge badge: EN VIVO only while a mission is actively forging.
 * Idle / success / error must not claim a live forge without mission work.
 */
export function livingForgeLiveLabel(tone) {
  if (LIVE_FORGE_TONES.has(tone)) return 'EN VIVO';
  if (tone === 'error') return 'ATENTA';
  return 'LISTA';
}

export function applyLivingForgeActivity(el, tone) {
  if (!el) return;
  const activity = typeof tone === 'string' && tone ? tone : 'idle';
  if (el.dataset) el.dataset.activity = activity;
  const label = el.querySelector?.('.live-badge-label');
  if (label) label.textContent = livingForgeLiveLabel(activity);
}
