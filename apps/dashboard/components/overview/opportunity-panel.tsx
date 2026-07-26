import type { OpportunitySummary } from '../../lib/kernel/contracts';
import { Panel } from '../ui/panel';

type OpportunityPanelProps = { opportunities: OpportunitySummary[]; unavailable: boolean };
export function OpportunityPanel({ opportunities, unavailable }: OpportunityPanelProps) {
  return <Panel title="Prioridad de oportunidades" eyebrow="Inbox del Kernel" className="overview-opportunities">{unavailable ? <p className="empty-state" role="status">Datos temporalmente no disponibles</p> : opportunities.length === 0 ? <p className="empty-state">No hay oportunidades priorizadas todavía.</p> : <ul className="opportunity-list">{opportunities.map((opportunity) => (
    <li key={opportunity.id}><div className="opportunity-title"><strong>{opportunity.title}</strong><span className="unverified-lead">Lead no verificado</span></div><p>{opportunity.categoryLabel} · {opportunity.sourceHost}</p><p className="opportunity-next-action">Siguiente paso: {opportunity.nextAction}</p></li>
  ))}</ul>}</Panel>;
}
