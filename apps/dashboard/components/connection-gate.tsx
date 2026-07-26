'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { KernelClient, KernelClientError } from '../lib/kernel/client';
import { type OverviewSnapshot, loadOverview } from '../lib/kernel/overview';
import { normalizeKernelBaseUrl } from '../lib/kernel/url';
import { connectionStore } from '../lib/session/connection-store';
import { OverviewScreen } from './overview/overview-screen';

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
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const controllerRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = undefined;
      connectionStore.clear();
    };
  }, []);

  async function connect(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const baseUrl = String(fields.get('baseUrl') ?? '');
    const token = String(fields.get('token') ?? '');
    const tokenInput = form.elements.namedItem('token');
    if (tokenInput instanceof HTMLInputElement) tokenInput.value = '';

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isCurrentRequest = () => mountedRef.current && requestId === requestIdRef.current;
    setConnecting(true);
    setError(undefined);
    try {
      const normalizedBaseUrl = normalizeKernelBaseUrl(baseUrl);
      const client = new KernelClient({ baseUrl: normalizedBaseUrl, token });
      const nextSnapshot = await loadOverview(client, controller.signal);
      if (nextSnapshot.readiness.kernel === 'offline') throw new KernelClientError('OFFLINE');
      if (!isCurrentRequest()) return;
      connectionStore.set({ baseUrl: normalizedBaseUrl, token });
      setSnapshot(nextSnapshot);
    } catch (reason) {
      if (!isCurrentRequest()) return;
      connectionStore.clear();
      setSnapshot(undefined);
      setError(connectionMessage(reason));
    } finally {
      if (isCurrentRequest()) setConnecting(false);
      if (controllerRef.current === controller) controllerRef.current = undefined;
    }
  }

  async function reload(): Promise<void> {
    const currentConnection = connectionStore.get();
    if (!currentConnection) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isCurrentRequest = () => mountedRef.current && requestId === requestIdRef.current;

    try {
      const client = new KernelClient(currentConnection);
      const nextSnapshot = await loadOverview(client, controller.signal);
      if (!isCurrentRequest()) return;
      setSnapshot(nextSnapshot);
    } catch (reason) {
      if (!isCurrentRequest()) return;
      if (reason instanceof KernelClientError && reason.code === 'UNAUTHORIZED') {
        connectionStore.clear();
        setSnapshot(undefined);
        setError(connectionMessage(reason));
        return;
      }
      throw reason;
    } finally {
      if (controllerRef.current === controller) controllerRef.current = undefined;
    }
  }

  function disconnect(): void {
    controllerRef.current?.abort();
    requestIdRef.current += 1;
    connectionStore.clear();
    setSnapshot(undefined);
  }

  if (connection && snapshot) return <OverviewScreen snapshot={snapshot} reload={reload} disconnect={disconnect} />;

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
