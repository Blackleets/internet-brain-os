import type { MissionSummary, OpportunitySummary } from '../../lib/kernel/contracts';
import { isKernelSupportedFind } from '../../lib/kernel/supported-find';
import { Panel } from '../ui/panel';

type OpportunityPanelProps = {
  opportunities: OpportunitySummary[];
  unavailable: boolean;
  missions?: readonly MissionSummary[];
};

export function OpportunityPanel({ opportunities, unavailable, missions }: OpportunityPanelProps) {
  return <Panel title="Prioridad de oportunidades" eyebrow="Inbox del Kernel" className="overview-opportunities">{unavailable ? <p className="empty-state" role="status">Datos temporalmente no disponibles</p> : opportunities.length === 0 ? <p className="empty-state">No hay oportunidades priorizadas todavía.</p> : <ul className="opportunity-list">{opportunities.map((opportunity) => {
    // Fail-close label: Kernel SUPPORT Finds must not render as Lead no verificado (mirrors FindCard).
    const kernelSupported = isKernelSupportedFind(opportunity, missions);
    return (
      <li key={opportunity.id}>
        <div className="opportunity-title">
          <strong>{opportunity.title}</strong>
          <span className={kernelSupported ? 'kernel-support-lead' : 'unverified-lead'}>
            {kernelSupported ? 'Kernel SUPPORT' : 'Lead no verificado'}
          </span>
        </div>
        <p>{opportunity.categoryLabel} · {opportunity.sourceHost}</p>
        <p className="opportunity-next-action">Siguiente paso: {opportunity.nextAction}</p>
      </li>
    );
  })}</ul>}</Panel>;
}
