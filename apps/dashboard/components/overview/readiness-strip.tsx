import type { OverviewSnapshot } from '../../lib/kernel/overview';
import { StatusBadge, type StatusState } from '../ui/status-badge';

type ReadinessStripProps = { readiness: OverviewSnapshot['readiness'] };
type ReadinessItem = { label: string; state: StatusState; detail: string };

export function ReadinessStrip({ readiness }: ReadinessStripProps) {
  const status = readiness.status;
  const bootstrap = readiness.bootstrap;
  const items: ReadinessItem[] = [
    { label: 'Kernel', state: readiness.kernel === 'online' ? 'healthy' : 'failed', detail: readiness.kernel === 'online' ? 'Conexion local activa' : 'Sin conexion local' },
    { label: 'Hermes', state: status?.hermes === 'ready' ? 'healthy' : status ? 'unavailable' : 'attention', detail: status?.hermes === 'ready' ? 'Preparado' : 'No configurado' },
    { label: 'Efesto', state: bootstrap?.pairing === 'paired' ? 'healthy' : bootstrap ? 'attention' : 'unavailable', detail: bootstrap?.pairing === 'paired' ? 'Emparejado' : 'Requiere emparejamiento' },
    { label: 'Replay Lab', state: status?.replayLab === 'ready' ? 'healthy' : status ? 'unavailable' : 'attention', detail: status?.replayLab === 'ready' ? 'Disponible' : 'No disponible' },
    { label: 'Ollama', state: status?.ollama === 'configured' ? 'healthy' : status ? 'unavailable' : 'attention', detail: status?.ollama === 'configured' ? 'Configurado' : 'No configurado' },
    { label: 'Obsidian', state: status?.obsidian === 'configured' ? 'healthy' : status ? 'unavailable' : 'attention', detail: status?.obsidian === 'configured' ? 'Configurado' : 'No configurado' },
  ];

  return <section className="readiness-strip" aria-label="Estado de subsistemas">{items.map((item) => (
    <div className="readiness-item" key={item.label}><span>{item.label}</span><StatusBadge state={item.state} label={item.detail} /></div>
  ))}</section>;
}
