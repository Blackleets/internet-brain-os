'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { KeyRound, Link2, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { KernelClient, KernelClientError } from '../lib/kernel/client';
import { type OverviewSnapshot, loadOverview } from '../lib/kernel/overview';
import { normalizeKernelBaseUrl } from '../lib/kernel/url';
import { connectionStore } from '../lib/session/connection-store';
import { OverviewScreen } from './overview/overview-screen';

const DEFAULT_BASE_URL = 'http://127.0.0.1:4000';

type Detection = 'idle' | 'checking' | 'online' | 'offline' | 'invalid';

export function ConnectionGate() {
  const connection = useSyncExternalStore(
    (listener) => connectionStore.subscribe(listener),
    () => connectionStore.get(),
    () => undefined,
  );
  const [snapshot, setSnapshot] = useState<OverviewSnapshot>();
  const [error, setError] = useState<string>();
  const [connecting, setConnecting] = useState(false);
  const [detection, setDetection] = useState<Detection>('idle');
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  // Live, unauthenticated probe of the Kernel base URL. Never sends the token.
  function detect(baseUrl: string): void {
    setDetection('checking');
    if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    detectTimerRef.current = setTimeout(async () => {
      try {
        const normalized = normalizeKernelBaseUrl(baseUrl);
        const response = await fetch(`${normalized}/health`, { cache: 'no-store' });
        if (!mountedRef.current) return;
        setDetection(response.ok ? 'online' : 'offline');
      } catch (reason) {
        if (!mountedRef.current) return;
        const message = reason instanceof Error ? reason.message : '';
        setDetection(/loopback|localhost/i.test(message) ? 'invalid' : 'offline');
      }
    }, 350);
  }

  useEffect(() => {
    detect(DEFAULT_BASE_URL);
    return () => {
      if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
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
    <section className="connection-panel" aria-labelledby="connection-title">
      <div className="connection-card">
        <header className="connection-card-head">
          <p className="connection-eyebrow"><ShieldCheck aria-hidden="true" size={15} /> Hephaestus Control Center</p>
          <h1 id="connection-title">Conectar al Kernel</h1>
          <p className="connection-lede">
            Tu Panel de control se ejecuta sobre el Kernel de Hephaestus en esta máquina. Sin conexión
            no se muestra ni se inventa ningún dato del sistema.
          </p>
        </header>

        <form className="connection-form" onSubmit={connect}>
          <div className="field">
            <label htmlFor="baseUrl">
              <Link2 aria-hidden="true" size={16} /> URL del Kernel
            </label>
            <input
              id="baseUrl"
              name="baseUrl"
              type="url"
              defaultValue={DEFAULT_BASE_URL}
              required
              autoComplete="off"
              onChange={(event) => detect(event.target.value)}
            />
            <DetectionBadge state={detection} />
            <p className="field-hint">Solo se aceptan orígenes loopback (localhost, 127.0.0.1, [::1]).</p>
          </div>

          <div className="field">
            <label htmlFor="token">
              <KeyRound aria-hidden="true" size={16} /> Token local
            </label>
            <input
              id="token"
              name="token"
              type="password"
              autoComplete="off"
              required
              placeholder="Pégalo desde el emparejamiento del Kernel"
            />
            <p className="field-hint">
              Viaja solo en memoria y únicamente en la cabecera <code>x-hephaestus-token</code> a rutas <code>/api/*</code>.
            </p>
          </div>

          <button type="submit" className="connection-cta" disabled={connecting}>
            {connecting ? 'Conectando…' : 'Conectar al Kernel'}
          </button>
          {error ? <p className="connection-error" role="alert" aria-live="polite">{error}</p> : null}
        </form>

        <details className="connection-help">
          <summary>¿Cómo obtengo el token local sin exponerlo?</summary>
          <ol>
            <li>Arranca el Kernel de Hephaestus en tu máquina (por ejemplo con <code>pnpm kernel:serve</code>).</li>
            <li>Abre <code>http://127.0.0.1:&lt;PUERTO&gt;/bootstrap/status</code> y completa el emparejamiento del Kernel con tu extensión o cliente.</li>
            <li>El Kernel genera un token de API para ese emparejamiento. Cópialo desde la pantalla de emparejamiento o el archivo de token POSIX del Kernel.</li>
            <li>Pégalo arriba. No se guarda en disco ni se envía fuera de tu red local.</li>
          </ol>
          <p className="connection-help-note">
            Este panel nunca muestra el valor del token ni lo persiste. Si el token se pierde o se
            revoca, repite el emparejamiento en el Kernel.
          </p>
        </details>
      </div>
      <p className="connection-footnote">Fase 1 · Solo lectura local · Loopback</p>
    </section>
  );
}

function DetectionBadge({ state }: { state: Detection }) {
  if (state === 'idle' || state === 'checking') {
    return <p className="detection detection--checking" aria-live="polite"><Wifi aria-hidden="true" size={14} /> Comprobando Kernel en esta URL…</p>;
  }
  if (state === 'online') {
    return <p className="detection detection--online" role="status"><Wifi aria-hidden="true" size={14} /> Kernel detectado en esta URL.</p>;
  }
  if (state === 'invalid') {
    return <p className="detection detection--invalid" role="status"><WifiOff aria-hidden="true" size={14} /> Usa una URL loopback (localhost o 127.0.0.1).</p>;
  }
  return <p className="detection detection--offline" role="status"><WifiOff aria-hidden="true" size={14} /> No se detectó un Kernel en esta URL.</p>;
}

function connectionMessage(reason: unknown): string {
  if (reason instanceof KernelClientError && reason.code === 'UNAUTHORIZED') {
    return 'El token no es válido. Vuelve a conectarte al Kernel.';
  }
  if (reason instanceof KernelClientError && reason.code === 'OFFLINE') {
    return 'El Kernel no responde. Confirma que está arrancado en la URL indicada.';
  }
  return 'No se pudo conectar al Kernel. Revisa la URL y el token, y vuelve a intentarlo.';
}
