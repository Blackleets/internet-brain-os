import {
  Activity, Bot, BrainCircuit, ExternalLink, FolderSearch, Network,
  SearchCheck, Settings, ShieldCheck, Workflow,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState, type FormEvent } from 'react';
import type { OverviewSnapshot } from '../../lib/kernel/overview';
import type { DashboardActions } from '../overview/overview-screen';
import { Panel } from '../ui/panel';
import { StatusBadge } from '../ui/status-badge';

export function KernelWorkspaces({ snapshot, actions }: { snapshot: OverviewSnapshot; actions?: DashboardActions }) {
  const [actionState, setActionState] = useState<string>();
  const status = snapshot.readiness.status;
  const bootstrap = snapshot.readiness.bootstrap;
  const activeMissions = snapshot.missions.filter((mission) =>
    !['completed', 'failed'].includes(mission.status),
  );

  return (
    <section className="kernel-workspaces" aria-label="Espacios funcionales del Kernel">
      <Workspace id="investigations" icon={FolderSearch} title="Investigación" eyebrow="Cases · Replay Lab">
        <WorkspaceStatus available={!failed(snapshot, 'cases')} />
        {failed(snapshot, 'cases') ? <Unavailable /> : snapshot.cases.length === 0 ? <Empty text="Todavía no existen casos persistidos." /> : (
          <ul className="workspace-records">
            {snapshot.cases.map((item) => <li key={item.id}><div><strong>{item.title}</strong><span>ID persistido: {item.id}</span></div><StatusBadge state={item.status === 'active' ? 'working' : 'unavailable'} label={caseState(item.status)} /></li>)}
          </ul>
        )}
        <a className="workspace-action" href="http://127.0.0.1:4000/replay-lab" target="_blank" rel="noreferrer">Abrir Replay Lab <ExternalLink size={14} /></a>
      </Workspace>

      <Workspace id="knowledge" icon={BrainCircuit} title="Conocimiento" eyebrow="Goals · Evidence boundary">
        <WorkspaceStatus available={!failed(snapshot, 'goals')} />
        {failed(snapshot, 'goals') ? <Unavailable /> : snapshot.goals.length === 0 ? <Empty text="Todavía no existen metas privadas." /> : (
          <ul className="workspace-records">
            {snapshot.goals.map((goal) => <li key={goal.id}><div><strong>{goal.title}</strong><span>Creada: {date(goal.createdAt)}</span></div><StatusBadge state="healthy" label={`Prioridad ${goal.priority}`} /></li>)}
          </ul>
        )}
        {actions ? <GoalComposer createGoal={actions.createGoal} onState={setActionState} /> : null}
        <p className="workspace-boundary"><ShieldCheck size={14} /> La memoria durable solo cambia después de los gates del Kernel.</p>
      </Workspace>

      <Workspace id="agents" icon={Bot} title="Agent Hub" eyebrow="Hermes · Misiones">
        <WorkspaceStatus available={!failed(snapshot, 'missions')} />
        <div className="workspace-kpis"><Kpi label="Hermes" value={status?.hermes === 'ready' ? 'Online' : 'No configurado'} /><Kpi label="Activas" value={String(activeMissions.length)} /><Kpi label="Total" value={String(snapshot.missions.length)} /></div>
        {snapshot.missions.length === 0 ? <Empty text="No hay misiones persistidas." /> : (
          <ul className="workspace-records">
            {snapshot.missions.slice(0, 6).map((mission) => <li key={mission.id}><div><strong>{typeof mission.goalTitle === 'string' ? mission.goalTitle : `Misión ${mission.id}`}</strong><span>Intento {mission.attempt ?? 0} · {date(mission.createdAt)}</span></div><StatusBadge state={mission.status === 'failed' ? 'failed' : mission.status === 'completed' ? 'healthy' : 'working'} label={mission.executionPhase ?? mission.status} /></li>)}
          </ul>
        )}
        {actions && snapshot.goals.length ? <div className="mission-launchers"><p>Iniciar misión manual con confirmación explícita:</p>{snapshot.goals.map((goal) => <button type="button" key={goal.id} onClick={() => run(() => actions.createMission(goal.id), setActionState, 'Misión enviada al Agent Hub')}>{goal.title}</button>)}</div> : null}
      </Workspace>

      <Workspace id="opportunities" icon={SearchCheck} title="Oportunidades" eyebrow="Inbox · Feedback privado">
        <WorkspaceStatus available={!failed(snapshot, 'opportunities')} />
        {snapshot.opportunities.length === 0 ? <Empty text="No hay oportunidades priorizadas todavía." /> : <ul className="workspace-records opportunity-records">{snapshot.opportunities.slice(0, 8).map((item) => <li key={item.id}><div><strong>{item.title}</strong><span>{item.categoryLabel} · {item.sourceHost} · relevancia {item.relevance}</span><span>Siguiente paso: {item.nextAction}</span></div>{actions ? <div className="feedback-actions"><button type="button" onClick={() => run(() => actions.recordOpportunityFeedback(item.id, 'useful'), setActionState, 'Feedback guardado')}>Útil</button><button type="button" onClick={() => run(() => actions.recordOpportunityFeedback(item.id, 'saved'), setActionState, 'Oportunidad guardada')}>Guardar</button><button type="button" onClick={() => run(() => actions.recordOpportunityFeedback(item.id, 'dismissed'), setActionState, 'Oportunidad descartada')}>Descartar</button></div> : null}</li>)}</ul>}
      </Workspace>

      <Workspace id="automations" icon={Workflow} title="Automatizaciones" eyebrow="Procesos existentes">
        <WorkspaceStatus available={snapshot.readiness.kernel === 'online'} />
        <ul className="workspace-processes">
          <Process icon={SearchCheck} title="Radar de oportunidades" detail="Captura autorizada por sitio desde Efesto" active={snapshot.readiness.kernel === 'online'} />
          <Process icon={Activity} title="Mission Watchtower" detail="Observa transiciones terminales persistidas" active={status?.hermes === 'ready'} />
          <Process icon={Workflow} title="Reintentos acotados" detail="Máximo de tres intentos observables" active />
        </ul>
        <p className="workspace-boundary">No existe un scheduler general: no se muestran horarios ni ejecuciones futuras inventadas.</p>
      </Workspace>

      <Workspace id="graph" icon={Network} title="Relaciones" eyebrow="Knowledge Graph">
        <WorkspaceStatus available={false} label="Proyección pendiente" />
        <Empty text="El dominio de Entidades y Relaciones existe, pero el Kernel aún no expone una proyección dashboard autenticada." />
        <p className="workspace-boundary"><ShieldCheck size={14} /> El grafo aparecerá aquí únicamente con Evidence y procedencia verificable.</p>
      </Workspace>

      <Workspace id="system" icon={Settings} title="Sistema" eyebrow="Readiness real">
        <WorkspaceStatus available={snapshot.readiness.kernel === 'online'} />
        <div className="workspace-kpis system-kpis">
          <Kpi label="Kernel" value={snapshot.readiness.kernel === 'online' ? 'Online' : 'Offline'} />
          <Kpi label="Efesto" value={bootstrap?.pairing === 'paired' ? 'Emparejado' : 'Requiere pairing'} />
          <Kpi label="Ollama" value={status?.ollama === 'configured' ? 'Configurado' : 'No configurado'} />
          <Kpi label="Obsidian" value={status?.obsidian === 'configured' ? 'Configurado' : 'No configurado'} />
          <Kpi label="Replay Lab" value={status?.replayLab === 'ready' ? 'Online' : 'No disponible'} />
          <Kpi label="Modelo" value={snapshot.readiness.modelForge?.activeModel ?? 'Sin modelo activo'} />
        </div>
      </Workspace>
      {actionState ? <p className="workspace-action-state" role="status">{actionState}</p> : null}
    </section>
  );
}

function GoalComposer({ createGoal, onState }: { createGoal: DashboardActions['createGoal']; onState: (value: string) => void }) {
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const title = String(fields.get('title') ?? '').trim();
    const keywords = String(fields.get('keywords') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    const priority = Number(fields.get('priority')) as 1 | 2 | 3;
    setPending(true);
    try {
      await createGoal({ title, keywords, priority });
      form.reset();
      onState('Meta privada creada y sincronizada con el Kernel');
    } catch {
      onState('El Kernel rechazó la meta. Revisa título y palabras clave.');
    } finally {
      setPending(false);
    }
  }
  return <form className="goal-composer" onSubmit={submit}><label>Nueva meta<input name="title" required minLength={3} maxLength={120} placeholder="Ej. Encontrar clientes de automatización" /></label><label>Palabras clave<input name="keywords" required placeholder="IA, automatización, Madrid" /></label><label>Prioridad<select name="priority" defaultValue="2"><option value="1">Baja</option><option value="2">Media</option><option value="3">Alta</option></select></label><button type="submit" disabled={pending}>{pending ? 'Creando…' : 'Crear meta privada'}</button></form>;
}

function Workspace({ id, icon: Icon, title, eyebrow, children }: { id: string; icon: typeof FolderSearch; title: string; eyebrow: string; children: ReactNode }) {
  return <Panel title={title} eyebrow={eyebrow} className={`kernel-workspace kernel-workspace--${id}`}><span id={id} className="workspace-anchor" /><div className="workspace-title-icon" aria-hidden="true"><Icon size={18} /></div>{children}</Panel>;
}
function WorkspaceStatus({ available, label }: { available: boolean; label?: string }) { return <StatusBadge state={available ? 'healthy' : 'attention'} label={label ?? (available ? 'Cableado al Kernel' : 'Temporalmente no disponible')} />; }
function Kpi({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <p className="workspace-empty">{text}</p>; }
function Unavailable() { return <p className="workspace-empty" role="status">El endpoint no respondió. No se presentan ceros ficticios.</p>; }
function Process({ icon: Icon, title, detail, active }: { icon: typeof Activity; title: string; detail: string; active: boolean }) { return <li><Icon size={16} /><div><strong>{title}</strong><span>{detail}</span></div><StatusBadge state={active ? 'healthy' : 'unavailable'} label={active ? 'Activo' : 'No disponible'} /></li>; }
function failed(snapshot: OverviewSnapshot, endpoint: OverviewSnapshot['issues'][number]['endpoint']): boolean { return snapshot.issues.some((issue) => issue.endpoint === endpoint); }
function date(value: string): string { const parsed = new Date(value); return Number.isNaN(parsed.valueOf()) ? value : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: 'UTC' }).format(parsed); }
function caseState(value: OverviewSnapshot['cases'][number]['status']): string { return value === 'active' ? 'Activo' : value === 'draft' ? 'Borrador' : 'Archivado'; }
async function run(action: () => Promise<void>, onState: (value: string) => void, success: string) { try { await action(); onState(success); } catch { onState('La acción no pudo completarse. El estado real se conservó.'); } }
