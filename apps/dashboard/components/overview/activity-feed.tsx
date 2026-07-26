import type { OverviewActivity } from '../../lib/kernel/overview';
import { Panel } from '../ui/panel';

type ActivityFeedProps = { activity: OverviewActivity[]; unavailable: boolean; partial: boolean };
const kindLabels: Record<OverviewActivity['kind'], string> = { goal: 'Meta', mission: 'Mision', opportunity: 'Oportunidad' };
const stateLabels: Record<string, string> = { active: 'Activa', new: 'Nueva', waiting_for_agent: 'Esperando agente', queued: 'En cola', running: 'En ejecucion', investigating: 'Investigando', verifying: 'Verificando', forged: 'Forjada', completed: 'Completada', failed: 'Fallida' };

export function ActivityFeed({ activity, unavailable, partial }: ActivityFeedProps) {
  return <Panel title="Actividad reciente" eyebrow="Registros persistidos" className="overview-activity">{unavailable ? <p className="empty-state" role="status">Datos temporalmente no disponibles</p> : <>{activity.length === 0 ? <p className="empty-state">{partial ? 'No hay actividad persistida de las fuentes disponibles.' : 'No hay actividad persistida para mostrar.'}</p> : <ol className="activity-list">{activity.map((entry) => (
    <li key={entry.id}><span>{kindLabels[entry.kind]}</span><strong>{stateLabels[entry.state] ?? entry.state}</strong><time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time></li>
  ))}</ol>}{partial ? <p className="partial-state" role="status">Actividad parcial: algunas fuentes no respondieron.</p> : null}</>}</Panel>;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date);
}
