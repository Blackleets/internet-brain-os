import { CircleAlert, CircleCheck, CircleX, LoaderCircle, MinusCircle } from 'lucide-react';

export type StatusState = 'healthy' | 'attention' | 'working' | 'unavailable' | 'failed';

const statusLabels: Record<StatusState, string> = {
  healthy: 'Saludable',
  attention: 'Requiere atención',
  working: 'En curso',
  unavailable: 'No disponible',
  failed: 'Falló',
};

const statusIcons = {
  healthy: CircleCheck,
  attention: CircleAlert,
  working: LoaderCircle,
  unavailable: MinusCircle,
  failed: CircleX,
};

type StatusBadgeProps = {
  state: StatusState;
  label?: string;
};

export function StatusBadge({ state, label = statusLabels[state] }: StatusBadgeProps) {
  const Icon = statusIcons[state];

  return (
    <span className={`status-badge status-badge--${state}`}>
      <Icon aria-hidden="true" data-testid="status-icon" size={15} strokeWidth={2} />
      <span>{label}</span>
    </span>
  );
}
