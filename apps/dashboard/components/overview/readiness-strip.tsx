import type { OverviewIssue, OverviewSnapshot } from '../../lib/kernel/overview';
import { StatusBadge, type StatusState } from '../ui/status-badge';

type ReadinessStripProps = { readiness: OverviewSnapshot['readiness']; issues: OverviewIssue[] };
type ReadinessItem = { label: string; state: StatusState; detail: string };

export function ReadinessStrip({ readiness, issues }: ReadinessStripProps) {
  const status = readiness.status;
  const bootstrap = readiness.bootstrap;
  const items: ReadinessItem[] = [
    { label: 'Kernel', state: readiness.kernel === 'online' ? 'healthy' : 'failed', detail: readiness.kernel === 'online' ? 'Conexion local activa' : 'Sin conexion local' },
    statusItem('Hermes', issues, status?.hermes === 'ready' ? 'healthy' : 'unavailable', status?.hermes === 'ready' ? 'Preparado' : 'No configurado'),
    statusItem('Efesto', issues, bootstrap?.pairing === 'paired' ? 'healthy' : 'attention', bootstrap?.pairing === 'paired' ? 'Emparejado' : 'Requiere emparejamiento', 'bootstrap'),
    statusItem('Replay Lab', issues, status?.replayLab === 'ready' ? 'healthy' : 'unavailable', status?.replayLab === 'ready' ? 'Disponible' : 'No disponible'),
    statusItem('Ollama', issues, status?.ollama === 'configured' ? 'healthy' : 'unavailable', status?.ollama === 'configured' ? 'Configurado' : 'No configurado'),
    statusItem('Obsidian', issues, status?.obsidian === 'configured' ? 'healthy' : 'unavailable', status?.obsidian === 'configured' ? 'Configurado' : 'No configurado'),
  ];

  return <section className="readiness-strip" aria-label="Estado de subsistemas">{items.map((item) => (
    <div className="readiness-item" key={item.label}><span>{item.label}</span><StatusBadge state={item.state} label={item.detail} /></div>
  ))}</section>;
}

function statusItem(label: string, issues: OverviewIssue[], state: StatusState, detail: string, endpoint: OverviewIssue['endpoint'] = 'status'): ReadinessItem {
  return issues.some((issue) => issue.endpoint === endpoint)
    ? { label, state: 'unavailable', detail: 'Estado temporalmente no disponible' }
    : { label, state, detail };
}
