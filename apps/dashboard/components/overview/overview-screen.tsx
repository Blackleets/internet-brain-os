'use client';

import Image from 'next/image';
import { Bot, BrainCircuit, Network, Search, Sparkles, Workflow } from 'lucide-react';
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

const modules = [
  { id: 'investigations', title: 'Investigación', copy: 'Explora casos y ejecuciones verificadas.', action: 'Ver investigaciones', icon: Search },
  { id: 'knowledge', title: 'Conocimiento', copy: 'Consulta evidencia y memoria controlada.', action: 'Explorar conocimiento', icon: BrainCircuit },
  { id: 'graph', title: 'Relaciones', copy: 'Visualiza conexiones con procedencia.', action: 'Ver relaciones', icon: Network },
  { id: 'agents', title: 'Agentes IA', copy: 'Supervisa misiones reales de Hermes.', action: 'Gestionar agentes', icon: Bot },
  { id: 'automations', title: 'Automatizaciones', copy: 'Observa procesos existentes y acotados.', action: 'Ver automatizaciones', icon: Workflow },
];

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
    <section className="brain-hero panel" id="overview" aria-labelledby="overview-title">
      <Image
        src="/internet-brain-core.webp"
        alt=""
        fill
        priority
        sizes="(max-width: 760px) 100vw, 70vw"
        className="forge-core-artwork"
      />
      <div className="brain-hero-content">
        <p className="panel-eyebrow">Resumen general</p>
        <h1 id="overview-title">¡Hola, Blackleets!</h1>
        <p>{bootstrapMessage}</p>
        <div className="hero-status"><StatusBadge state={snapshot.readiness.kernel === 'online' ? 'healthy' : 'failed'} label={kernelLabel} /></div>
        <div className="hero-actions">
          <button type="button" onClick={handleRefresh} disabled={refreshing} aria-label="Actualizar resumen">
            {refreshing ? 'Actualizando…' : 'Actualizar resumen'}
          </button>
          <button type="button" className="quiet-button" onClick={disconnect} aria-label="Desconectar del Kernel">Desconectar</button>
        </div>
        {stale ? <p className="stale-state" role="status" aria-live="polite">Datos sin actualizar desde <time dateTime={snapshot.loadedAt}>{formatLoadedAt(snapshot.loadedAt)}</time></p> : null}
        {refreshError ? <p className="overview-error" role="alert">{refreshError}</p> : null}
      </div>
      <div className="hero-metrics"><MetricGrid metrics={snapshot.metrics} issues={snapshot.issues} /></div>
    </section>

    <section className="module-grid" aria-label="Áreas de Internet Brain OS">
      {modules.map(({ id, title, copy, action, icon: Icon }) => (
        <a className="module-card panel" href={`#${id}`} key={id}>
          <span className="module-icon"><Icon size={18} /></span>
          <h2>{title}</h2>
          <p>{copy}</p>
          <strong>{action}<span aria-hidden="true">→</span></strong>
        </a>
      ))}
    </section>

    <div id="intelligence"><ReadinessStrip readiness={snapshot.readiness} issues={snapshot.issues} /></div>
    <div id="agents"><MissionPanel missions={snapshot.missions} unavailable={hasIssue(snapshot.issues, 'missions')} /></div>
    <div id="knowledge"><OpportunityPanel opportunities={snapshot.opportunities} unavailable={hasIssue(snapshot.issues, 'opportunities')} /></div>
    <div id="investigations"><ActivityFeed activity={snapshot.activity} unavailable={activityUnavailable} partial={!activityUnavailable && failedActivitySources.length > 0} /></div>
    <div id="system"><SystemReadiness snapshot={snapshot} /></div>

    <section className="command-dock panel" id="automations">
      <Sparkles aria-hidden="true" size={20} />
      <p><strong>HEPHAESTUS</strong> está listo. Usa la barra superior para navegar por tus datos reales.</p>
      <a href="#overview">Volver al inicio <span aria-hidden="true">→</span></a>
    </section>
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
    return bootstrap.pairing === 'paired' ? 'Tu cerebro digital está activo. Efesto está emparejado.' : 'Tu cerebro digital está listo para operar.';
  }
  return bootstrap?.message ?? (snapshot.readiness.kernel === 'online' ? 'El Kernel está disponible para lectura local.' : 'El Kernel requiere atención antes de continuar.');
}
function formatLoadedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date);
}

const overviewStyles = `
.brain-hero{position:relative;grid-column:span 9;min-height:19rem;padding:1rem;isolation:isolate}.brain-hero::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,#06101e 0%,rgb(5 11 20/.88) 32%,transparent 68%)}.forge-core-artwork{z-index:-2;object-fit:cover;object-position:center}.brain-hero-content{position:relative;z-index:1;max-width:26rem}.brain-hero h1{margin:0 0 .3rem;font-size:1.55rem}.brain-hero-content>p:not(.panel-eyebrow,.stale-state,.overview-error){margin:0;color:#aeb8c8;font-size:.86rem}.hero-status{margin-top:.7rem}.hero-actions{display:flex;gap:.45rem;margin-top:.85rem}.hero-actions button{min-height:2.25rem;padding:0 .75rem;cursor:pointer;color:#eaf6ff;border:1px solid #2254a7;border-radius:.45rem;background:linear-gradient(90deg,#152d7b,#442195);font-size:.72rem}.hero-actions .quiet-button{border-color:#233044;background:rgb(4 10 18/.76)}.hero-metrics{position:absolute;left:1rem;right:1rem;bottom:1rem;z-index:1}.metric-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:.45rem}.metric-card{min-height:4.7rem;padding:.55rem;border:1px solid rgb(32 54 84/.8);border-radius:.45rem;background:rgb(5 13 24/.84);backdrop-filter:blur(10px)}.metric-card h2{margin:0 0 .35rem;color:#aab4c5;font-size:.58rem;font-weight:600;text-transform:none}.metric-value{margin:0;font-size:1.3rem;font-weight:750}.metric-unavailable{margin:0;color:#64738a;font-size:.6rem;line-height:1.25}.overview-error,.partial-state,.stale-state{margin:.55rem 0 0;color:#ffb44f;font-size:.7rem}
.module-grid{grid-column:span 9;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.6rem}.module-card{display:flex;min-height:10.5rem;flex-direction:column;padding:.75rem;transition:.2s ease}.module-card:hover{border-color:#304d8b;transform:translateY(-2px);box-shadow:0 12px 30px rgb(37 62 159/.15)}.module-icon{display:grid;width:1.8rem;height:1.8rem;place-items:center;color:#9b66ff;border-radius:.4rem;background:rgb(111 54 219/.15)}.module-card:nth-child(2) .module-icon{color:#4be69a;background:rgb(47 184 117/.14)}.module-card:nth-child(3) .module-icon{color:#3dcaff;background:rgb(39 157 224/.13)}.module-card:nth-child(5) .module-icon{color:#ffc13c;background:rgb(234 156 28/.13)}.module-card h2{margin:.6rem 0 .3rem;font-size:.75rem}.module-card p{margin:0;color:#8c98aa;font-size:.66rem;line-height:1.45}.module-card strong{display:flex;justify-content:space-between;margin-top:auto;padding:.55rem;color:#dce8ff;border-radius:.35rem;background:linear-gradient(90deg,rgb(29 49 117/.8),rgb(45 25 105/.8));font-size:.65rem}
#intelligence{grid-column:span 3;grid-row:1 / span 2}#intelligence .readiness-strip{display:grid;gap:.45rem}.readiness-item{padding:.55rem;border-bottom:1px solid var(--line-subtle)}.readiness-item>span{display:block;margin-bottom:.25rem;color:#7f8da1;font-size:.6rem;text-transform:uppercase}
#agents{grid-column:span 5}#knowledge{grid-column:span 4}#investigations{grid-column:span 6}#system{grid-column:span 3}.overview-missions,.overview-opportunities,.overview-activity,.overview-system{height:100%}.empty-state{margin:0;color:#7d899c;font-size:.72rem}.mission-list,.opportunity-list,.activity-list{display:grid;gap:.45rem;padding:0;margin:0;list-style:none}.mission-list li,.opportunity-list li,.activity-list li{padding:.45rem 0;border-bottom:1px solid var(--line-subtle)}.mission-list li{display:flex;justify-content:space-between;gap:.6rem}.mission-list strong,.opportunity-title strong,.activity-list strong{font-size:.7rem}.mission-list span,.opportunity-list p,.activity-list span,.activity-list time{color:#7f8da0;font-size:.62rem}.opportunity-title{display:flex;justify-content:space-between;gap:.5rem}.opportunity-list p{margin:.2rem 0}.unverified-lead{color:#b36fff;font-size:.58rem}.activity-list li{display:grid;grid-template-columns:4.5rem 1fr auto;align-items:center}.system-readiness{display:grid;gap:.75rem}.system-readiness h3{margin:0 0 .25rem;font-size:.7rem}.system-readiness p{margin:0;color:#8190a4;font-size:.65rem}
.command-dock{display:flex;align-items:center;gap:.7rem;margin-top:.15rem;padding:.75rem 1rem;border-color:#342c91;box-shadow:inset 0 0 0 1px rgb(17 161 255/.16),0 0 25px rgb(90 36 224/.08)}.command-dock svg{color:#a05dff}.command-dock p{margin:0;color:#aeb8c8;font-size:.72rem}.command-dock strong{color:#d7e1f4}.command-dock a{margin-left:auto;padding:.55rem .85rem;border-radius:.4rem;background:linear-gradient(90deg,#742bd5,#1a65be);font-size:.68rem;white-space:nowrap}
@media(max-width:1200px){.brain-hero,.module-grid{grid-column:span 12}#intelligence{grid-column:span 12;grid-row:auto}#intelligence .readiness-strip{grid-template-columns:repeat(3,1fr)}#agents,#knowledge,#investigations,#system{grid-column:span 6}.module-grid{grid-template-columns:repeat(5,minmax(8rem,1fr));overflow-x:auto}}
@media(max-width:760px){.brain-hero{min-height:29rem}.brain-hero::after{background:linear-gradient(180deg,rgb(5 11 20/.8),rgb(5 11 20/.45))}.forge-core-artwork{opacity:.45}.hero-metrics{position:absolute}.metric-grid{grid-template-columns:repeat(2,1fr)}.metric-card:nth-child(n+5){display:none}.module-grid{grid-template-columns:repeat(5,10rem)}#intelligence .readiness-strip{grid-template-columns:repeat(2,1fr)}#agents,#knowledge,#investigations,#system{grid-column:1}.command-dock{align-items:flex-start;flex-wrap:wrap}.command-dock a{margin-left:0}}
`;
