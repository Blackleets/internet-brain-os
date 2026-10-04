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
  running: 'En ejecución',
  investigating: 'Investigando',
  verifying: 'Verificando',
  verified_unsupported: 'Sin SUPPORT',
  failed: 'Fallida',
  blocked: 'Bloqueada',
  runtime_read_only_unverified: 'Hermes requiere actualización segura',
  authorization_missing: 'Falta autorización del Goal',
  authorization_revision_mismatch: 'Goal requiere reautorización',
  goal_not_active: 'Goal no activo',
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
  if (['failed', 'invalid', 'blocked', 'runtime_read_only_unverified', 'authorization_missing', 'authorization_revision_mismatch', 'goal_not_active'].includes(state)) return 'bad';
  if (['running', 'investigating', 'verifying', 'queued', 'waiting_for_agent'].includes(state)) return 'working';
  return 'neutral';
}
