import { Clock3, Gauge, LockKeyhole, Repeat2, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ProductMetric, ProductValueScorecard } from '../../lib/kernel/product-scorecard';
import { useEfestoLocale } from '../../lib/efesto-i18n';

export function ProductValueScorecardPanel({
  scorecard,
  unavailable,
}: {
  scorecard?: ProductValueScorecard;
  unavailable: boolean;
}) {
  const { t } = useEfestoLocale();
  return <>
    <style>{scorecardStyles}</style>
    <section className="product-scorecard-view" aria-labelledby="product-scorecard-title">
      <header className="product-scorecard-header">
        <div><small>{t('scorecard.eyebrow')}</small><h2 id="product-scorecard-title">{t('scorecard.title')}</h2></div>
        <span className="scorecard-privacy"><LockKeyhole size={14} aria-hidden="true" /> {t('scorecard.privacy')}</span>
      </header>
      {unavailable || !scorecard ? <Unavailable /> : <ScorecardBody scorecard={scorecard} />}
    </section>
  </>;
}

function Unavailable() {
  const { t } = useEfestoLocale();
  return <div className="product-value-unavailable" role="status"><ShieldCheck size={18} aria-hidden="true" /><div><strong>{t('scorecard.unavailable')}</strong><p>{t('scorecard.unavailableCopy')}</p></div></div>;
}

function ScorecardBody({ scorecard }: { scorecard: ProductValueScorecard }) {
  const { t } = useEfestoLocale();
  const unavailableCount = countUnavailable(scorecard);
  return <>
    <dl className="scorecard-primary">
      <ScoreMetric icon={<Gauge size={17} aria-hidden="true" />} label={t('scorecard.goalUseful')} metric={scorecard.primary.goalUsefulFindRate} />
      <ScoreMetric icon={<Clock3 size={17} aria-hidden="true" />} label={t('scorecard.timeToUseful')} metric={scorecard.primary.timeToFirstUsefulFind} />
      <ScoreMetric icon={<Repeat2 size={17} aria-hidden="true" />} label={t('scorecard.repeatGoals')} metric={scorecard.primary.repeatGoalUsage} />
    </dl>
    <div className="scorecard-secondary" aria-label={t('scorecard.coverageLabel')}>
      <span>{t('scorecard.localActivation')} <strong>{formatMetric(scorecard.drivers.installationToFirstGoalActivationRate, t)}</strong></span>
      <span>{t('scorecard.completedMissions')} <strong>{formatMetric(scorecard.drivers.missionCompletionRate, t)}</strong></span>
      <span>{t('scorecard.usefulFinds')} <strong>{formatMetric(scorecard.drivers.usefulSavedFindShare, t)}</strong></span>
      <span>{t('scorecard.measuredGoals')} <strong>{scorecard.coverage.executedGoals}</strong></span>
      <span>{t('scorecard.linkedFinds')} <strong>{scorecard.coverage.goalLinkedFinds}</strong></span>
      <span>{t('scorecard.missionFailures')} <strong>{formatMetric(scorecard.guardrails.missionFailureRate, t)}</strong></span>
      <span>{t('scorecard.dismissed')} <strong>{formatMetric(scorecard.guardrails.findDismissalNotInterestedRate, t)}</strong></span>
    </div>
    {unavailableCount > 0 ? <p className="scorecard-caveat">{t('scorecard.caveat', { count: unavailableCount })}</p> : null}
  </>;
}

function ScoreMetric({ icon, label, metric }: { icon: ReactNode; label: string; metric: ProductMetric }) {
  const { t } = useEfestoLocale();
  const measured = metric.status === 'measured';
  return <div className={measured ? 'scorecard-metric measured' : 'scorecard-metric unavailable'}><dt>{icon}<span>{label}</span></dt><dd>{formatMetric(metric, t)}</dd><p>{measured ? metricContext(metric, t) : reasonCopy(metric.reason, t)}</p></div>;
}

function formatMetric(metric: ProductMetric, t: (key: string, values?: Record<string, string | number>) => string): string {
  if (metric.status !== 'measured' || metric.value === null) return t('scorecard.noData');
  if (metric.unit === 'ratio') return `${Math.round(metric.value * 100)}%`;
  if (metric.unit === 'milliseconds') return formatDuration(metric.value, t);
  if (metric.unit === 'count_per_goal') return `${trimNumber(metric.value)}${t('scorecard.perGoal')}`;
  return trimNumber(metric.value);
}

function formatDuration(milliseconds: number, t: (key: string, values?: Record<string, string | number>) => string): string {
  if (milliseconds < 60_000) return t('scorecard.lessThanMinute');
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 60) return t('scorecard.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? t('scorecard.hours', { count: hours }) : t('scorecard.hoursMinutes', { hours, minutes: remainingMinutes });
}

function trimNumber(value: number): string { return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, ''); }
function metricContext(metric: ProductMetric, t: (key: string, values?: Record<string, string | number>) => string): string {
  const denominator = typeof metric.denominator === 'number' ? metric.denominator : undefined;
  const sampleCount = typeof metric.sampleCount === 'number' ? metric.sampleCount : undefined;
  if (denominator !== undefined) return t('scorecard.baseLocal', { value: denominator });
  if (sampleCount !== undefined) return t('scorecard.localSamples', { value: sampleCount });
  return t('scorecard.measuredLocal');
}
function reasonCopy(reason: string | null, t: (key: string, values?: Record<string, string | number>) => string): string {
  const reasonKeys: Record<string, string> = {
    no_executed_goals: 'scorecard.noExecutedGoals',
    no_useful_or_saved_find_feedback: 'scorecard.noUsefulFeedback',
    installation_cohort_not_recorded: 'scorecard.cohortNotRecorded',
    local_installation_cohort_invalid: 'scorecard.invalidCohort',
    no_local_goal_activation: 'scorecard.noActivation',
    no_missions: 'scorecard.noMissions',
    no_completed_goals: 'scorecard.noCompletedGoals',
    no_goal_linked_finds: 'scorecard.noLinkedFinds',
  };
  return reasonKeys[reason ?? ''] ? t(reasonKeys[reason ?? '']) : t('scorecard.noLedger');
}
function countUnavailable(scorecard: ProductValueScorecard): number {
  return [...Object.values(scorecard.primary), ...Object.values(scorecard.drivers), ...Object.values(scorecard.guardrails)].filter((metric) => metric.status === 'not_measurable').length;
}

const scorecardStyles = `
.product-scorecard-view{width:min(768px,calc(100% - 40px));margin:0 auto 5rem;padding:1.15rem 0 0;border-top:1px solid var(--forge-line,#262628);background:transparent;color:var(--forge-text,#f2efea)}
.product-scorecard-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:.8rem}.product-scorecard-header small{color:#a5653f;font-size:.6rem;font-weight:760;letter-spacing:.15em}.product-scorecard-header h2{margin:.2rem 0 0;color:#eee9e3;font-size:1rem;font-weight:650;letter-spacing:-.02em}.scorecard-privacy{display:inline-flex;align-items:center;gap:.35rem;padding:.42rem .55rem;color:#a6c79a;border:1px solid rgb(142 183 122/.3);border-radius:999px;background:rgb(67 92 54/.16);font-size:.6rem;white-space:nowrap}
.scorecard-primary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem;margin:0}.scorecard-metric{min-width:0;padding:.72rem;border:1px solid #2a292b;border-radius:.7rem;background:linear-gradient(145deg,#171718,#121213);box-shadow:inset 0 1px 0 rgb(255 255 255/.025)}.scorecard-metric dt{display:flex;align-items:center;gap:.38rem;color:#9a9691;font-size:.62rem}.scorecard-metric dt svg{flex:none;color:var(--forge-accent,#e98245)}.scorecard-metric dd{margin:.45rem 0 .22rem;color:#f2ece6;font-size:1.2rem;font-weight:750;letter-spacing:-.025em}.scorecard-metric p{margin:0;color:#77736f;font-size:.57rem;line-height:1.35}.scorecard-metric.unavailable dd{color:#8b8782;font-size:.92rem}.scorecard-metric.unavailable dt svg{color:#69666a}
.scorecard-secondary{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.65rem}.scorecard-secondary span{padding:.35rem .48rem;color:#85817d;border:1px solid #29282a;border-radius:.42rem;background:#121213;font-size:.58rem}.scorecard-secondary strong{color:#d8d1ca}.scorecard-caveat{margin:.65rem 0 0;color:#817d78;font-size:.6rem;line-height:1.45}.product-value-unavailable{display:flex;align-items:flex-start;gap:.6rem;padding:.75rem;color:#96918b;border:1px dashed #393436;border-radius:.7rem;background:#121213}.product-value-unavailable svg{flex:none;color:#88aa7a}.product-value-unavailable strong{display:block;color:#d8d2cb;font-size:.7rem}.product-value-unavailable p{margin:.2rem 0 0;color:#817d78;font-size:.62rem}
@media(max-width:820px){.product-scorecard-view{margin-bottom:6rem}.product-scorecard-header{align-items:stretch;flex-direction:column}.scorecard-privacy{align-self:flex-start}.scorecard-primary{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.product-scorecard-view{width:min(100%,calc(100% - 28px));margin-bottom:5rem;padding-top:1rem}.scorecard-primary{grid-template-columns:1fr 1fr}.scorecard-metric{padding:.6rem}.scorecard-metric dd{font-size:1rem}.scorecard-secondary{display:grid;grid-template-columns:1fr 1fr}}
`;
