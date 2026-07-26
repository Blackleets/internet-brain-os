import type { MissionSummary } from '../../lib/kernel/contracts';
import { Panel } from '../ui/panel';
import { StatusBadge, type StatusState } from '../ui/status-badge';

type MissionPanelProps = { missions: MissionSummary[] };
const phaseLabels: Record<NonNullable<MissionSummary['executionPhase']> | MissionSummary['status'], string> = {
  waiting_for_agent: 'Esperando agente', queued: 'En cola', running: 'En ejecucion', completed: 'Completada', failed: 'Fallida', investigating: 'Investigando', verifying: 'Verificando', forged: 'Forjada',
};
function missionState(mission: MissionSummary): StatusState {
  const phase = mission.executionPhase ?? mission.status;
  return phase === 'failed' ? 'failed' : phase === 'forged' || phase === 'completed' ? 'healthy' : phase === 'waiting_for_agent' ? 'attention' : 'working';
}
function missionTitle(mission: MissionSummary): string {
  return typeof mission.goalTitle === 'string' && mission.goalTitle.length > 0 ? mission.goalTitle : `Mision ${mission.id}`;
}
export function MissionPanel({ missions }: MissionPanelProps) {
  return <Panel title="Misiones activas" eyebrow="Agent Hub" className="overview-missions">{missions.length === 0 ? <p className="empty-state">No hay misiones persistidas todavía.</p> : <ul className="mission-list">{missions.map((mission) => {
    const phase = mission.executionPhase ?? mission.status;
    return <li key={mission.id}><div><strong>{missionTitle(mission)}</strong><span>Intento persistido {mission.attempt ?? 0}</span></div><StatusBadge state={missionState(mission)} label={phaseLabels[phase]} /></li>;
  })}</ul>}</Panel>;
}
