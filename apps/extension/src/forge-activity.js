import { VERIFIED_WITHOUT_SUPPORT, WEB_READ_FAILED, kernelSettlementCode, countVerifiedReads } from './mission-presentation.js';
import { kernelSupportedFindsForMission } from './find-presentation.js';

const ACTIVITIES = Object.freeze({
  idle: { label: 'The forge is ready', detail: 'Create a Goal or analyze a public page.', tone: 'idle' },
  queued: { label: 'Preparing the tools', detail: 'A research mission is ready for Hermes.', tone: 'queued' },
  working: { label: 'Forging new intelligence', detail: 'Hermes is researching authorized public sources.', tone: 'working' },
  verifying: { label: 'Inspecting the piece', detail: 'Efesto is validating returned material inside the local Kernel. Finds still require Kernel SUPPORT.', tone: 'verifying' },
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
    // Living Forge truth = max(inbox Finds, verificationResults SUPPORT) — same gate as
    // presentWatchtowerAviso / mission-presentation. listOpportunities catch→[] must not
    // demote a SUPPORT-proven mission to "Research completed" on #forge-activity-label.
    const found = Math.max(
      kernelSupportedFindsForMission(opportunities, mission).length,
      countMissionSupportedFinds(mission),
    );
    // Fail-close Living Forge label+detail to Kernel SUPPORT (detail was aligned in da68517;
    // label must not keep branding SUPPORT Finds as bare "useful lead" on #forge-activity-label).
    // Fail-close Living Forge chrome: zero-SUPPORT forged must not keep data-activity=success
    // (green badge + celebrate) while Central Forge orb is research_completed → idle.
    // Label/detail stay Research completed; tone mirrors completed-without-Evidence.
    return found > 0
      ? {
          ...ACTIVITIES.success,
          label: found === 1 ? 'A Kernel SUPPORT Find was forged' : 'Kernel SUPPORT Finds were forged',
          detail: `${found} ${found === 1 ? 'Find' : 'Finds'} passed Kernel SUPPORT and were forged.`,
        }
      : { label: 'Research completed', detail: 'No Find passed Kernel SUPPORT.', tone: 'idle' };
  }
  // Fail-close Living Forge (#forge-activity-label via popup loadAgentHub):
  // bare completed (no forged Evidence) must not keep "The forge is ready" / LISTA
  // Forja lista lookalike while #mission-state / Home already say Research ended
  // without Evidence / Terminada sin Evidence. Tone stays idle (no celebrate).
  if (mission.status === 'completed') {
    return {
      label: 'Research ended without Evidence',
      detail: 'The bounded attempt finished. No Kernel-sealed Evidence was forged.',
      tone: 'idle',
    };
  }
  // Fail-close Living Forge (#forge-activity-label via popup loadAgentHub): Kernel settlement
  // verified_without_support is an honest research outcome (pages read → Evidence, none passed
  // SUPPORT) — same copy as mission card / orb / watchtower. Must not keep "Inspecting a broken
  // piece" / ATENTA error chrome while those surfaces say Read without Kernel SUPPORT.
  const settlement = kernelSettlementCode(mission);
  if (settlement === VERIFIED_WITHOUT_SUPPORT) {
    const read = countVerifiedReads(mission?.verificationResults);
    const pages = read > 0 ? `${read} ${read === 1 ? 'page' : 'pages'}` : 'the candidate pages';
    return {
      label: 'Read without Kernel SUPPORT',
      detail: `The Kernel read ${pages} as Evidence; none passed Kernel SUPPORT, so no Find was forged.`,
      tone: 'idle',
    };
  }
  if (settlement === WEB_READ_FAILED) {
    return {
      label: 'Candidate pages could not be read',
      detail: 'The Kernel could not read any candidate page, so no page became Evidence and no Find was forged.',
      tone: 'idle',
    };
  }
  if (mission.status === 'failed') return ACTIVITIES.error;
  return ACTIVITIES.idle;
}


/** Living Forge gate: verificationResults with supported === true. */
function countMissionSupportedFinds(mission) {
  const results = mission?.verificationResults;
  if (!Array.isArray(results)) return 0;
  let n = 0;
  for (const entry of results) {
    if (entry && typeof entry === 'object' && entry.supported === true) n += 1;
  }
  return n;
}

export function temporaryForgeActivity(kind) {
  if (kind === 'capture') return { ...ACTIVITIES.working, detail: 'Efesto is analyzing this public page.' };
  // Fail-close Living Forge chrome: a manual page capture mints Case+Evidence only (server.mjs
  // /api/browser/page-context; popup status already says it is not a Kernel SUPPORT Find).
  // data-activity=success (green badge + celebrate) is reserved for Kernel SUPPORT Finds, so a
  // capture must not paint it; neutral idle chrome, same as completed-without-Evidence.
  if (kind === 'capture-success') return { label: 'Evidence preserved', detail: 'The page was preserved as private Evidence. Capture is not a Kernel SUPPORT Find.', tone: 'idle' };
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
