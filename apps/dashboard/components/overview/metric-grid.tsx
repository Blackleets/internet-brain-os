import type { OverviewSnapshot } from '../../lib/kernel/overview';

type MetricGridProps = { metrics: OverviewSnapshot['metrics'] };
type Metric = { label: string; value?: number; unavailable?: boolean };

export function MetricGrid({ metrics }: MetricGridProps) {
  const values: Metric[] = [
    { label: 'Casos', value: metrics.cases }, { label: 'Metas', value: metrics.goals },
    { label: 'Misiones', value: metrics.missions }, { label: 'Misiones activas', value: metrics.activeMissions },
    { label: 'Oportunidades', value: metrics.opportunities }, { label: 'Entidades', unavailable: true },
    { label: 'Relaciones', unavailable: true },
  ];
  return <section className="metric-grid" aria-label="Metricas actuales del Kernel">{values.map((metric) => (
    <article className="metric-card" key={metric.label}><h2>{metric.label}</h2>{metric.unavailable
      ? <p className="metric-unavailable">Aún no expuesto por el Kernel</p>
      : <p className="metric-value">{metric.value}</p>}</article>
  ))}</section>;
}
