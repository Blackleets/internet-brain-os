'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ActivityFeed } from './activity-feed';
import { MetricGrid } from './metric-grid';
import { MissionPanel } from './mission-panel';
import { OpportunityPanel } from './opportunity-panel';
import { ReadinessStrip } from './readiness-strip';
import type { OverviewIssue, OverviewSnapshot } from '../../lib/kernel/overview';
import { Panel } from '../ui/panel';
import { StatusBadge } from '../ui/status-badge';

type OverviewScreenProps = { snapshot: OverviewSnapshot; reload: () => Promise<void>; disconnect: () => void };

export function OverviewScreen({ snapshot, reload, disconnect }: OverviewScreenProps) {
  const [refreshError, setRefreshError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const bootstrapMessage = readinessSummary(snapshot);
  const kernelLabel = snapshot.readiness.kernel === 'online' ? 'Kernel conectado' : 'Kernel sin conexión';
  const failedActivitySources = (['goals', 'missions', 'opportunities'] as const).filter((endpoint) => hasIssue(snapshot.issues, endpoint));
  const activityUnavailable = hasIssue(snapshot.issues, 'activity') || failedActivitySources.length === 3;

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    setRefreshError(undefined);
    try {
      await reload();
      setStale(false);
    } catch {
      setStale(true);
      setRefreshError('No se pudo actualizar el resumen. Conservamos los datos verificados disponibles.');
    } finally {
      setRefreshing(false);
    }
  }

  return <>
    <style>{overviewStyles}</style>
    <ReadinessStrip readiness={snapshot.readiness} issues={snapshot.issues} />
    <section className="overview-hero panel" aria-labelledby="overview-title">
      <div>
        <p className="panel-eyebrow">{kernelLabel}</p>
        <h1 id="overview-title">Centro de control</h1>
        <p>{bootstrapMessage}</p>
        <div className="overview-actions">
          <button type="button" onClick={handleRefresh} disabled={refreshing} aria-label="Actualizar resumen">{refreshing ? 'Actualizando…' : 'Actualizar resumen'}</button>
          <button type="button" className="quiet-button" onClick={disconnect} aria-label="Desconectar del Kernel">Desconectar</button>
        </div>
        {stale ? <p className="stale-state" role="status" aria-live="polite">Datos sin actualizar desde <time dateTime={snapshot.loadedAt}>{formatLoadedAt(snapshot.loadedAt)}</time></p> : null}
        {refreshError ? <p className="overview-error" role="alert">{refreshError}</p> : null}
      </div>
      <div className="forge-core-slot">
        <Image
          src="/forge-core.webp"
          alt=""
          width={1672}
          height={941}
          priority
          sizes="(max-width: 760px) calc(100vw - 4rem), (max-width: 1100px) 38vw, 42vw"
          className="forge-core-artwork"
        />
      </div>
    </section>
    <MetricGrid metrics={snapshot.metrics} issues={snapshot.issues} />
    <MissionPanel missions={snapshot.missions} unavailable={hasIssue(snapshot.issues, 'missions')} />
    <OpportunityPanel opportunities={snapshot.opportunities} unavailable={hasIssue(snapshot.issues, 'opportunities')} />
    <ActivityFeed activity={snapshot.activity} unavailable={activityUnavailable} partial={!activityUnavailable && failedActivitySources.length > 0} />
    <SystemReadiness snapshot={snapshot} />
  </>;
}

function SystemReadiness({ snapshot }: { snapshot: OverviewSnapshot }) {
  const modelIssue = snapshot.issues.find((issue) => issue.endpoint === 'modelForge');
  const modelForge = snapshot.readiness.modelForge;
  const statusUnavailable = hasIssue(snapshot.issues, 'status');
  return <Panel title="Modelo y proyección local" eyebrow="Sistema" className="overview-system"><div className="system-readiness"><div><h3>Model Forge</h3>{modelForge ? <p>{modelForge.runtime === 'available' ? `Disponible · ${modelForge.activeModel ?? 'sin modelo activo'}` : 'Runtime no detectado'}</p> : <p>{modelIssue ? modelIssueMessage(modelIssue) : 'Aún no expuesto por el Kernel'}</p>}</div><div><h3>Obsidian</h3><StatusBadge state={statusUnavailable ? 'unavailable' : snapshot.readiness.status?.obsidian === 'configured' ? 'healthy' : 'unavailable'} label={statusUnavailable ? 'Estado temporalmente no disponible' : snapshot.readiness.status?.obsidian === 'configured' ? 'Proyección configurada' : 'No configurado'} /></div></div>{snapshot.issues.length > 0 ? <p className="partial-state">Resumen parcial: algunos endpoints no respondieron, pero los datos disponibles se conservan.</p> : null}</Panel>;
}

function modelIssueMessage(issue: OverviewIssue): string { return issue.code === 'UNAVAILABLE' ? 'Model Forge no está disponible en este Kernel.' : 'Model Forge no pudo cargarse en esta actualización.'; }
function hasIssue(issues: OverviewIssue[], endpoint: OverviewIssue['endpoint']): boolean { return issues.some((issue) => issue.endpoint === endpoint); }
function readinessSummary(snapshot: OverviewSnapshot): string {
  const bootstrap = snapshot.readiness.bootstrap;
  if (snapshot.readiness.kernel === 'online' && bootstrap?.overall === 'ready') {
    return bootstrap.pairing === 'paired' ? 'Kernel local listo. Efesto está emparejado.' : 'Kernel local listo para operar.';
  }
  return bootstrap?.message ?? (snapshot.readiness.kernel === 'online' ? 'El Kernel está disponible para lectura local.' : 'El Kernel requiere atención antes de continuar.');
}
function formatLoadedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date);
}

const overviewStyles = `
.readiness-strip,.metric-grid{grid-column:span 12;display:grid;gap:.6rem}.readiness-strip{grid-template-columns:repeat(6,minmax(0,1fr))}.readiness-item,.metric-card{min-width:0;padding:.7rem .85rem;border:1px solid var(--line-subtle);border-radius:.75rem;background:var(--bg-surface)}.readiness-item>span,.metric-card h2{display:block;margin:0 0 .35rem;color:var(--text-secondary);font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.overview-hero{grid-column:span 12;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(12rem,.95fr);align-items:stretch;gap:1rem;min-height:11.75rem}.overview-hero h1{margin:0 0 .4rem;font-size:clamp(1.6rem,2.5vw,2.35rem);letter-spacing:-.04em}.overview-hero p:not(.panel-eyebrow){max-width:38rem;margin:0;color:var(--text-secondary);line-height:1.45}.forge-core-slot{min-height:8rem;border-left:1px solid var(--line-subtle)}.overview-actions{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:.85rem}.overview-actions button{min-height:2.5rem;padding:0 .9rem;color:#081118;border:1px solid var(--accent-data);border-radius:.55rem;background:var(--accent-data);font-weight:750;cursor:pointer}.overview-actions .quiet-button{color:var(--text-primary);border-color:var(--line-subtle);background:transparent}.overview-actions button:disabled{cursor:wait;opacity:.7}.overview-error,.partial-state,.stale-state{margin:.75rem 0 0;color:var(--accent-forge);font-size:.85rem}.metric-grid{grid-template-columns:repeat(7,minmax(0,1fr))}.metric-value{margin:0;color:var(--text-primary);font-variant-numeric:tabular-nums;font-size:clamp(1.35rem,2vw,2rem);font-weight:750;letter-spacing:-.04em}.metric-unavailable{margin:0;color:var(--text-secondary);font-size:.78rem;line-height:1.35}.overview-missions{grid-column:span 7}.overview-opportunities{grid-column:span 5}.overview-activity{grid-column:span 7}.overview-system{grid-column:span 5}.empty-state{margin:0;color:var(--text-secondary)}.mission-list,.opportunity-list,.activity-list{display:grid;gap:.5rem;padding:0;margin:0;list-style:none}.mission-list li,.opportunity-list li,.activity-list li{display:flex;align-items:center;justify-content:space-between;gap:.85rem;padding:.55rem 0;border-bottom:1px solid var(--line-subtle)}.mission-list li:last-child,.opportunity-list li:last-child,.activity-list li:last-child{padding-bottom:0;border-bottom:0}.mission-list strong,.opportunity-title strong,.activity-list strong{display:block;color:var(--text-primary);font-size:.9rem}.mission-list span,.opportunity-list p,.activity-list span,.activity-list time{margin:.2rem 0 0;color:var(--text-secondary);font-size:.8rem}.opportunity-list li{display:block}.opportunity-title{display:flex;align-items:center;justify-content:space-between;gap:.75rem}.unverified-lead{flex:0 0 auto;color:var(--accent-forge);font-size:.74rem;font-weight:700}.opportunity-next-action{line-height:1.4}.activity-list li{display:grid;grid-template-columns:7rem 1fr auto}.system-readiness{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}.system-readiness h3{margin:0 0 .4rem;color:var(--text-primary);font-size:.9rem}.system-readiness p{margin:0;color:var(--text-secondary);line-height:1.4}@media(max-width:1100px){.readiness-strip{grid-template-columns:repeat(3,minmax(0,1fr))}.metric-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:760px){.readiness-strip,.metric-grid,.overview-hero,.overview-missions,.overview-opportunities,.overview-activity,.overview-system{grid-column:1}.readiness-strip,.metric-grid,.overview-hero,.system-readiness{grid-template-columns:1fr}.overview-hero .forge-core-slot{display:none}.activity-list li{grid-template-columns:1fr;gap:.25rem}}
`;
