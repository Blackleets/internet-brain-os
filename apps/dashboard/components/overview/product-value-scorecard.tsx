import { Clock3, Gauge, LockKeyhole, Repeat2, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ProductMetric, ProductValueScorecard } from '../../lib/kernel/product-scorecard';

export function ProductValueScorecardPanel({
  scorecard,
  unavailable,
}: {
  scorecard?: ProductValueScorecard;
  unavailable: boolean;
}) {
  return <>
    <style>{scorecardStyles}</style>
    <section className="product-scorecard-view" aria-labelledby="product-scorecard-title">
      <header className="product-scorecard-header">
        <div><small>SCORECARD LOCAL</small><h2 id="product-scorecard-title">Valor del producto</h2></div>
        <span className="scorecard-privacy"><LockKeyhole size={14} aria-hidden="true" /> Solo local · sin telemetría externa</span>
      </header>
      {unavailable || !scorecard ? <Unavailable /> : <ScorecardBody scorecard={scorecard} />}
    </section>
  </>;
}

function Unavailable() {
  return <div className="product-value-unavailable" role="status"><ShieldCheck size={18} aria-hidden="true" /><div><strong>Métricas temporalmente no disponibles</strong><p>Efesto conserva el resto de datos verificados. No mostramos ceros inventados.</p></div></div>;
}

function ScorecardBody({ scorecard }: { scorecard: ProductValueScorecard }) {
  const unavailableCount = countUnavailable(scorecard);
  return <>
    <dl className="scorecard-primary">
      <ScoreMetric icon={<Gauge size={17} aria-hidden="true" />} label="Goals con Find útil" metric={scorecard.primary.goalUsefulFindRate} />
      <ScoreMetric icon={<Clock3 size={17} aria-hidden="true" />} label="Tiempo al primer Find útil" metric={scorecard.primary.timeToFirstUsefulFind} />
      <ScoreMetric icon={<Repeat2 size={17} aria-hidden="true" />} label="Repetición de Goals" metric={scorecard.primary.repeatGoalUsage} />
    </dl>
    <div className="scorecard-secondary" aria-label="Cobertura y guardas del scorecard">
      <span>Activación local <strong>{formatMetric(scorecard.drivers.installationToFirstGoalActivationRate)}</strong></span>
      <span>Misiones completadas <strong>{formatMetric(scorecard.drivers.missionCompletionRate)}</strong></span>
      <span>Finds útiles <strong>{formatMetric(scorecard.drivers.usefulSavedFindShare)}</strong></span>
      <span>Goals medidos <strong>{scorecard.coverage.executedGoals}</strong></span>
      <span>Finds con Goal <strong>{scorecard.coverage.goalLinkedFinds}</strong></span>
      <span>Fallos de misión <strong>{formatMetric(scorecard.guardrails.missionFailureRate)}</strong></span>
      <span>Descartados <strong>{formatMetric(scorecard.guardrails.findDismissalNotInterestedRate)}</strong></span>
    </div>
    {unavailableCount > 0 ? <p className="scorecard-caveat">{unavailableCount} métricas aún no tienen un ledger o cohorte fiable. Efesto muestra “Sin datos” en lugar de estimarlas.</p> : null}
  </>;
}

function ScoreMetric({ icon, label, metric }: { icon: ReactNode; label: string; metric: ProductMetric }) {
  const measured = metric.status === 'measured';
  return <div className={measured ? 'scorecard-metric measured' : 'scorecard-metric unavailable'}><dt>{icon}<span>{label}</span></dt><dd>{formatMetric(metric)}</dd><p>{measured ? metricContext(metric) : reasonCopy(metric.reason)}</p></div>;
}

function formatMetric(metric: ProductMetric): string {
  if (metric.status !== 'measured' || metric.value === null) return 'Sin datos';
  if (metric.unit === 'ratio') return `${Math.round(metric.value * 100)}%`;
  if (metric.unit === 'milliseconds') return formatDuration(metric.value);
  if (metric.unit === 'count_per_goal') return `${trimNumber(metric.value)} / Goal`;
  return trimNumber(metric.value);
}

function formatDuration(milliseconds: number): string {
  if (milliseconds < 60_000) return '< 1 min';
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes} min`;
}

function trimNumber(value: number): string { return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, ''); }
function metricContext(metric: ProductMetric): string {
  const denominator = typeof metric.denominator === 'number' ? metric.denominator : undefined;
  const sampleCount = typeof metric.sampleCount === 'number' ? metric.sampleCount : undefined;
  if (denominator !== undefined) return `Base local: ${denominator}`;
  if (sampleCount !== undefined) return `Muestras locales: ${sampleCount}`;
  return 'Medido desde la instancia local.';
}
function reasonCopy(reason: string | null): string {
  return ({
    no_executed_goals: 'Aún no hay Goals autorizados ejecutados.',
    no_useful_or_saved_find_feedback: 'Aún no hay Finds marcados como útiles o guardados.',
    installation_cohort_not_recorded: 'La medición local aún no se ha iniciado en esta instalación.',
    local_installation_cohort_invalid: 'El registro local de medición no es válido.',
    no_local_goal_activation: 'Esta instalación aún no ha autorizado su primer Goal.',
    no_missions: 'Aún no hay misiones medibles.',
    no_completed_goals: 'Aún no hay Goals completados.',
    no_goal_linked_finds: 'Aún no hay Finds ligados a un Goal verificado.',
  } as Record<string, string>)[reason ?? ''] ?? 'El Kernel todavía no dispone del ledger necesario.';
}
function countUnavailable(scorecard: ProductValueScorecard): number {
  return [...Object.values(scorecard.primary), ...Object.values(scorecard.drivers), ...Object.values(scorecard.guardrails)].filter((metric) => metric.status === 'not_measurable').length;
}

const scorecardStyles = `
.product-scorecard-view{width:min(960px,100%);margin:1.4rem auto 6rem;padding:1rem;border:1px solid rgb(61 99 150/.55);border-radius:1rem;background:linear-gradient(145deg,rgb(5 15 29/.94),rgb(8 17 34/.82));box-shadow:0 20px 70px rgb(0 0 0/.24)}
.product-scorecard-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:.8rem}.product-scorecard-header small{color:#7184a2;font-size:.62rem;letter-spacing:.12em}.product-scorecard-header h2{margin:.15rem 0 0;font-size:1rem}.scorecard-privacy{display:inline-flex;align-items:center;gap:.35rem;padding:.42rem .55rem;color:#7fe3b2;border:1px solid rgb(58 184 127/.35);border-radius:999px;background:rgb(27 116 78/.12);font-size:.62rem;white-space:nowrap}
.scorecard-primary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem;margin:0}.scorecard-metric{min-width:0;padding:.72rem;border:1px solid #172b46;border-radius:.65rem;background:rgb(3 11 21/.68)}.scorecard-metric dt{display:flex;align-items:center;gap:.38rem;color:#95a8c4;font-size:.62rem}.scorecard-metric dt svg{flex:none;color:#66c9ff}.scorecard-metric dd{margin:.45rem 0 .22rem;color:#eef7ff;font-size:1.2rem;font-weight:750}.scorecard-metric p{margin:0;color:#647894;font-size:.57rem;line-height:1.35}.scorecard-metric.unavailable dd{color:#7a8ca4;font-size:.92rem}.scorecard-metric.unavailable dt svg{color:#6d7a8d}
.scorecard-secondary{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.65rem}.scorecard-secondary span{padding:.35rem .48rem;color:#71839d;border:1px solid #152842;border-radius:.42rem;background:#07111d;font-size:.58rem}.scorecard-secondary strong{color:#d7e8fb}.scorecard-caveat{margin:.65rem 0 0;color:#8d9bb0;font-size:.6rem;line-height:1.45}.product-value-unavailable{display:flex;align-items:flex-start;gap:.6rem;padding:.75rem;color:#91a1b8;border:1px dashed #263b57;border-radius:.65rem}.product-value-unavailable strong{display:block;color:#d7e4f4;font-size:.7rem}.product-value-unavailable p{margin:.2rem 0 0;font-size:.62rem}
@media(max-width:820px){.product-scorecard-view{margin-bottom:7rem}.product-scorecard-header{align-items:stretch;flex-direction:column}.scorecard-privacy{align-self:flex-start}.scorecard-primary{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.product-scorecard-view{padding:.75rem;border-radius:.75rem}.scorecard-primary{grid-template-columns:1fr 1fr}.scorecard-metric{padding:.6rem}.scorecard-metric dd{font-size:1rem}.scorecard-secondary{display:grid;grid-template-columns:1fr 1fr}}
`;
