'use client';

import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { KernelClient, KernelClientError } from '../lib/kernel/client';
import { type OverviewSnapshot, loadOverview } from '../lib/kernel/overview';
import { normalizeKernelBaseUrl } from '../lib/kernel/url';
import { connectionStore } from '../lib/session/connection-store';

const DEFAULT_BASE_URL = 'http://127.0.0.1:4000';

export function ConnectionGate() {
  const connection = useSyncExternalStore(
    (listener) => connectionStore.subscribe(listener),
    () => connectionStore.get(),
    () => undefined,
  );
  const [snapshot, setSnapshot] = useState<OverviewSnapshot>();
  const [error, setError] = useState<string>();
  const [connecting, setConnecting] = useState(false);

  async function connect(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const baseUrl = String(fields.get('baseUrl') ?? '');
    const token = String(fields.get('token') ?? '');
    const tokenInput = form.elements.namedItem('token');
    if (tokenInput instanceof HTMLInputElement) tokenInput.value = '';

    setConnecting(true);
    setError(undefined);
    try {
      const normalizedBaseUrl = normalizeKernelBaseUrl(baseUrl);
      const client = new KernelClient({ baseUrl: normalizedBaseUrl, token });
      const nextSnapshot = await loadOverview(client);
      connectionStore.set({ baseUrl: normalizedBaseUrl, token });
      setSnapshot(nextSnapshot);
    } catch (reason) {
      connectionStore.clear();
      setSnapshot(undefined);
      setError(connectionMessage(reason));
    } finally {
      setConnecting(false);
    }
  }

  if (connection && snapshot) return <OverviewScreen snapshot={snapshot} disconnect={() => connectionStore.clear()} />;

  return (
    <section aria-labelledby="connection-title">
      <h1 id="connection-title">Conectar al Kernel</h1>
      <form onSubmit={connect}>
        <label>
          URL del Kernel
          <input name="baseUrl" type="url" defaultValue={DEFAULT_BASE_URL} required />
        </label>
        <label>
          Token local
          <input name="token" type="password" autoComplete="off" required />
        </label>
        <button type="submit" disabled={connecting}>{connecting ? 'Conectando…' : 'Conectar al Kernel'}</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

function connectionMessage(reason: unknown): string {
  if (reason instanceof KernelClientError && reason.code === 'UNAUTHORIZED') {
    return 'El token no es válido. Vuelve a conectarte al Kernel.';
  }
  return 'No se pudo conectar al Kernel. Revisa la URL y vuelve a intentarlo.';
}

// Task 8 replaces this bounded connected-state placeholder with the live Overview composition.
function OverviewScreen({ snapshot, disconnect }: { snapshot: OverviewSnapshot; disconnect: () => void }) {
  return (
    <section aria-label="Resumen del Kernel">
      <h1>Kernel conectado</h1>
      <p>{snapshot.readiness.kernel === 'online' ? 'El Kernel está disponible.' : 'El Kernel requiere atención.'}</p>
      <button type="button" onClick={disconnect}>Desconectar</button>
    </section>
  );
}
