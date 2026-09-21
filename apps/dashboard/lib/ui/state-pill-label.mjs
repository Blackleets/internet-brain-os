/**
 * Fail-close Goals/Actividad/Automations StatePill labels
 * (page.tsx → EfestoProductShell).
 *
 * missionPillState / activityFrom already gate forged → SUPPORT-only;
 * bare English "forged" / "research completed" must not stand in for
 * Home forge-state-action honesty.
 */
const STATE_PILL_LABELS = Object.freeze({
  forged: 'Find SUPPORT forjado',
  research_completed: 'Investigación terminada',
  completed_without_forge: 'Terminada sin Evidence',
  waiting_for_agent: 'Esperando agente',
  queued: 'En cola',
  running: 'En ejecucion',
  investigating: 'Investigando',
  verifying: 'Verificando',
  failed: 'Fallida',
  active: 'Activa',
  new: 'Nueva',
  available: 'Disponible',
  ready: 'Lista',
});

export function statePillLabel(state) {
  if (typeof state !== 'string' || !state) return '';
  return STATE_PILL_LABELS[state] ?? state.replaceAll('_', ' ');
}

export function statePillTone(state) {
  if (['ready', 'forged', 'available', 'new'].includes(state)) return 'good';
  if (['failed', 'invalid', 'blocked'].includes(state)) return 'bad';
  if (['running', 'investigating', 'verifying', 'queued', 'waiting_for_agent'].includes(state)) return 'working';
  return 'neutral';
}
