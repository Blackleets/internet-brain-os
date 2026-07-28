import type { OverviewIssue, OverviewSnapshot } from '../../lib/kernel/overview';

type MetricGridProps = { metrics: OverviewSnapshot['metrics']; issues: OverviewIssue[] };
type Metric = { label: string; value?: number; unavailable?: boolean; endpoint?: OverviewIssue['endpoint'] };

export function MetricGrid({ metrics, issues }: MetricGridProps) {
  const values: Metric[] = [
    { label: 'Casos', value: metrics.cases, endpoint: 'cases' }, { label: 'Metas', value: metrics.goals, endpoint: 'goals' },
    { label: 'Misiones', value: metrics.missions, endpoint: 'missions' }, { label: 'Misiones activas', value: metrics.activeMissions, endpoint: 'missions' },
    { label: 'Oportunidades', value: metrics.opportunities, endpoint: 'opportunities' }, { label: 'Entidades', unavailable: true },
    { label: 'Relaciones', unavailable: true },
  ];
  return <section className="metric-grid" aria-label="Metricas actuales del Kernel">{values.map((metric) => (
    <article className="metric-card" key={metric.label}><h2>{metric.label}</h2>{metric.unavailable || (metric.endpoint && endpointFailed(issues, metric.endpoint))
      ? <p className="metric-unavailable">{metric.unavailable ? 'Aún no expuesto por el Kernel' : 'Datos temporalmente no disponibles'}</p>
      : <p className="metric-value">{metric.value}</p>}</article>
  ))}</section>;
}

function endpointFailed(issues: OverviewIssue[], endpoint: OverviewIssue['endpoint']): boolean {
  return issues.some((issue) => issue.endpoint === endpoint);
}
