import { AppShell } from '../components/app-shell';
import { ConnectionGate } from '../components/connection-gate';

export default function HomePage() {
  return (
    <AppShell>
      <ConnectionGate />
    </AppShell>
  );
}
